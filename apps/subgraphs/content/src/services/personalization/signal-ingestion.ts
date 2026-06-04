import { type UserProfile, featureStore } from './feature-store';
import { logger } from './logger';

const MAX_RESEARCH_DEPTH = 5;
const MAX_CART_ACTIVITY = 50;
const MAX_CATEGORY_SCORE = 5.0;
const MAX_HISTORY_LENGTH = 20;
const MAX_RECENT_PRODUCTS = 20;

const RESEARCH_DEPTH_QUERY_INCREMENT = 0.15;
const RESEARCH_DEPTH_CLICK_INCREMENT = 0.1;
const DEAL_CLICK_RATE_INCREMENT = 0.12;
const CHECKOUT_CONVERSION_INCREMENT = 0.15;
const CHECKOUT_CONVERSION_DECREMENT = 0.1;
const PRODUCT_VIEW_WEIGHT = 0.25;
const DEFAULT_CATEGORY_VIEW_WEIGHT = 0.15;
const PURCHASE_BONUS = 0.5;

const DEFAULT_AVG_VIEWED_PRICE = 50;
const DEAL_CLICK_RATE_WEIGHT = 0.5;
const PRICE_SENSITIVITY_HIGH_THRESHOLD = 80;
const PRICE_SENSITIVITY_MED_THRESHOLD = 40;
const PRICE_SENSITIVITY_HIGH_SCORE = 0.3;
const PRICE_SENSITIVITY_MED_SCORE = 0.2;

const LOW_ENGAGEMENT_MAX_SESSIONS = 2;
const LOW_ENGAGEMENT_MAX_VIEWS = 3;
const HIGH_ENGAGEMENT_MIN_SESSIONS = 10;
const HIGH_ENGAGEMENT_MIN_CART = 5;
const HIGH_ENGAGEMENT_MIN_VIEWS = 20;

const SCORE_DECAY_FACTOR = 0.95;
const MS_PER_HOUR = 1000 * 60 * 60;
const HOURS_PER_DAY = 24;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

interface QueuedSignal {
  type: string;
  payload: Record<string, unknown>;
  url: string;
  timestamp: number;
}

export class SignalProcessor {
  async process(
    signal: QueuedSignal,
    deviceId: string,
    userId?: string | null,
    profile?: UserProfile
  ): Promise<boolean> {
    logger.info(
      {
        signalType: signal.type,
        deviceId,
        userId: userId ?? undefined,
      },
      'Signal received'
    );

    if (userId) {
      profile = await featureStore.mergeToUser(deviceId, userId);
    } else if (!profile) {
      profile = await featureStore.getOrCreate(deviceId);
    }

    this.updateProfile(profile, signal);
    await featureStore.save(profile);

    logger.info(
      {
        signalType: signal.type,
        deviceId,
        engagementLevel: profile.engagementLevel,
      },
      'Signal processed'
    );
    return true;
  }

  private recalculateDerived(profile: UserProfile): void {
    const totalViews = Object.values(profile.categoryAffinity).reduce(
      (a, b) => a + b.views,
      0
    );
    const cartActivity = profile.cartActivity ?? 0;

    if (profile.sessionCount <= LOW_ENGAGEMENT_MAX_SESSIONS && cartActivity === 0 && totalViews < LOW_ENGAGEMENT_MAX_VIEWS) {
      profile.engagementLevel = 'LOW';
    } else if (
      profile.sessionCount > HIGH_ENGAGEMENT_MIN_SESSIONS ||
      cartActivity > HIGH_ENGAGEMENT_MIN_CART ||
      totalViews > HIGH_ENGAGEMENT_MIN_VIEWS
    ) {
      profile.engagementLevel = 'HIGH';
    } else {
      profile.engagementLevel = 'MEDIUM';
    }

    const { dealClickRate, avgViewedPrice } = profile.priceSensitivity;
    profile.priceSensitivity.score = Math.min(
      dealClickRate * DEAL_CLICK_RATE_WEIGHT +
        (avgViewedPrice > PRICE_SENSITIVITY_HIGH_THRESHOLD ? PRICE_SENSITIVITY_HIGH_SCORE : avgViewedPrice > PRICE_SENSITIVITY_MED_THRESHOLD ? PRICE_SENSITIVITY_MED_SCORE : 0),
      1
    );
  }

  private updateProfile(profile: UserProfile, signal: QueuedSignal): void {
    if (profile.intentSignals.researchDepth > 0 && profile.lastSignalTimestamp) {
      const hoursSinceLastSignal = (signal.timestamp - profile.lastSignalTimestamp) / (1000 * 60 * 60);
      const daysSinceLastSignal = hoursSinceLastSignal / 24;
      const decayFactor = Math.pow(0.95, Math.max(0, daysSinceLastSignal));
      profile.intentSignals.researchDepth = profile.intentSignals.researchDepth * decayFactor;
    }

    switch (signal.type) {
      case 'PRODUCT_HOVER':
      case 'QUICK_VIEW_OPEN':
      case 'IMAGE_ZOOM':
      case 'REVIEWS_VIEW':
      case 'SIZE_GUIDE_VIEW':
        this.addCategoryView(profile, signal);
        break;

      case 'SEARCH_QUERY':
        profile.intentSignals.researchDepth = Math.min(
          MAX_RESEARCH_DEPTH,
          (profile.intentSignals.researchDepth ?? 0) + RESEARCH_DEPTH_QUERY_INCREMENT
        );
        if (!profile.searchHistory) {
          profile.searchHistory = [];
        }
        profile.searchHistory.push({
          query: String(signal.payload.query ?? ''),
          timestamp: signal.timestamp,
        });
        profile.searchHistory = profile.searchHistory.slice(-MAX_HISTORY_LENGTH);
        break;

      case 'SEARCH_RESULT_CLICK':
        profile.intentSignals.researchDepth = Math.min(
          MAX_RESEARCH_DEPTH,
          (profile.intentSignals.researchDepth ?? 0) + RESEARCH_DEPTH_CLICK_INCREMENT
        );
        break;

      case 'FILTER_APPLIED':
      case 'SORT_CHANGED': {
        if (
          signal.payload.sort === 'price-asc' ||
          String(signal.payload.filter ?? '').includes('under')
        ) {
          profile.priceSensitivity.dealClickRate = Math.min(
            1,
            (profile.priceSensitivity.dealClickRate ?? 0) + DEAL_CLICK_RATE_INCREMENT
          );
        }
        const priceRange = signal.payload.priceRange as
          | { max?: number }
          | undefined;
        if (priceRange?.max != null && typeof priceRange.max === 'number') {
          const ps = profile.priceSensitivity;
          ps.avgViewedPrice = ((ps.avgViewedPrice ?? DEFAULT_AVG_VIEWED_PRICE) + priceRange.max) / 2;
        }
        break;
      }

      case 'CART_ADD':
        profile.cartActivity = Math.min(MAX_CART_ACTIVITY, (profile.cartActivity ?? 0) + 1);
        break;

      case 'CART_REMOVE':
        profile.cartActivity = Math.max(0, (profile.cartActivity ?? 0) - 1);
        break;

      case 'CHECKOUT_START':
        profile.intentSignals.checkoutConversion = Math.min(
          1,
          (profile.intentSignals.checkoutConversion ?? 0) + CHECKOUT_CONVERSION_INCREMENT
        );
        break;

      case 'CHECKOUT_ABANDON':
        profile.intentSignals.checkoutConversion = Math.max(
          0,
          (profile.intentSignals.checkoutConversion ?? 0) - CHECKOUT_CONVERSION_DECREMENT
        );
        profile.hesitationCount = (profile.hesitationCount ?? 0) + 1;
        break;

      case 'PAGE_VIEW':
        this.addCategoryView(profile, signal);
        break;

      case 'PRODUCT_VIEW': {
        const category = String(signal.payload.category ?? '');
        const productId = String(signal.payload.productId ?? '');
        if (category && productId) {
          this.addCategoryView(profile, signal, PRODUCT_VIEW_WEIGHT);
          if (!profile.recentProducts) profile.recentProducts = [];
          profile.recentProducts.push({
            productId,
            productName: String(signal.payload.name ?? signal.payload.productName ?? ''),
            category,
            price: signal.payload.price as number | undefined,
            timestamp: signal.timestamp,
          });
          profile.recentProducts = profile.recentProducts.slice(-MAX_RECENT_PRODUCTS);

          if (typeof signal.payload.price === 'number') {
            const ps = profile.priceSensitivity;
            ps.avgViewedPrice = ps.avgViewedPrice === 0
              ? signal.payload.price
              : (ps.avgViewedPrice + signal.payload.price) / 2;
          }
        }
        break;
      }

      default:
        break;
    }

    if (
      signal.type === 'PAGE_VIEW' &&
      profile.lastSignalTimestamp &&
      signal.timestamp - profile.lastSignalTimestamp > SESSION_TIMEOUT_MS
    ) {
      profile.sessionCount = (profile.sessionCount ?? 0) + 1;
    } else if (signal.type === 'PAGE_VIEW' && !profile.lastSignalTimestamp) {
      profile.sessionCount = (profile.sessionCount ?? 0) + 1;
    }

    if (!profile.currentSession ||
        (profile.lastSignalTimestamp &&
         signal.timestamp - profile.lastSignalTimestamp > SESSION_TIMEOUT_MS)) {
      profile.currentSession = {
        startedAt: signal.timestamp,
        signalCount: 0,
        searches: [],
        productViews: [],
        cartAdds: 0,
      };
    }

    if (profile.currentSession) {
      profile.currentSession.signalCount = (profile.currentSession.signalCount ?? 0) + 1;

      if (signal.type === 'SEARCH_QUERY') {
        const query = String(signal.payload.query ?? '');
        if (query) {
          profile.currentSession.searches.unshift(query);
          profile.currentSession.searches = profile.currentSession.searches.slice(0, 5);
        }
      }

      if (signal.type === 'PRODUCT_VIEW') {
        const productId = String(signal.payload.productId ?? '');
        if (productId) {
          profile.currentSession.productViews.unshift(productId);
          profile.currentSession.productViews = profile.currentSession.productViews.slice(0, 10);
        }
        const category = String(signal.payload.category ?? '');
        if (category) {
          if (!profile.currentSession.firstCategory) {
            profile.currentSession.firstCategory = category;
          }
        }
      }

      if (signal.type === 'CART_ADD') {
        profile.currentSession.cartAdds = (profile.currentSession.cartAdds ?? 0) + 1;
      }
    }

    profile.lastSignalTimestamp = Math.max(
      profile.lastSignalTimestamp ?? 0,
      signal.timestamp
    );

    this.recalculateDerived(profile);
  }

  private addCategoryView(
    profile: UserProfile,
    signal: QueuedSignal,
    weight = DEFAULT_CATEGORY_VIEW_WEIGHT
  ): void {
    const category =
      (signal.payload.category as string | undefined) ||
      this.extractCategoryFromUrl(signal.url);
    if (!category) {
      return;
    }
    if (!profile.categoryAffinity[category]) {
      profile.categoryAffinity[category] = {
        views: 0,
        purchases: 0,
        lastViewed: 0,
        score: 0,
      };
    }
    const aff = profile.categoryAffinity[category];
    const previousLastViewed = aff.lastViewed;

    if (aff.score > 0 && previousLastViewed > 0) {
      const hoursSinceLastView =
        (signal.timestamp - previousLastViewed) / MS_PER_HOUR;
      const daysSinceLastView = hoursSinceLastView / HOURS_PER_DAY;
      const decayFactor = Math.pow(SCORE_DECAY_FACTOR, Math.max(0, daysSinceLastView));
      aff.score = aff.score * decayFactor;
    }

    aff.views += 1;
    aff.lastViewed = signal.timestamp;

    const viewIncrement = weight;
    const purchaseBonus = aff.purchases > 0 ? PURCHASE_BONUS : 0;
    aff.score = Math.min(aff.score + viewIncrement + purchaseBonus, MAX_CATEGORY_SCORE);
  }

  private extractCategoryFromUrl(url: string): string | null {
    const match = url.match(/\/(?:category|categories)\/([^/?]+)/);
    if (match?.[1]) {
      return match[1];
    }
    const match2 = url.match(/category=([^&]+)/);
    return match2?.[1] ?? null;
  }
}

export const signalProcessor = new SignalProcessor();
