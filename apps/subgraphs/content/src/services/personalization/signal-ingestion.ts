import {
  KEY_NS,
  getPersonalizationRedis,
} from '../../config/personalization-redis';
import { type UserProfile, featureStore } from './feature-store';
import {
  MEDUSA_PERSONALIZATION_PATHS,
  postPersonalizationWebhook,
} from './medusa-webhooks';
import { logger } from './logger';

const MAX_RESEARCH_DEPTH = 5;
const MAX_CART_ACTIVITY = 50;
const MAX_CATEGORY_SCORE = 5.0;
const MAX_HISTORY_LENGTH = 20;
const MAX_RECENT_PRODUCTS = 20;

const RESEARCH_DEPTH_QUERY_INCREMENT = 0.15;
const RESEARCH_DEPTH_CLICK_INCREMENT = 0.1;
const DEAL_CLICK_RATE_INCREMENT = 0.12;
const CART_TO_PURCHASE_INCREMENT = 0.15;
const CART_TO_PURCHASE_DECREMENT = 0.1;
const RETURN_RATE_INCREMENT = 0.08;
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
    userId?: string | null
  ): Promise<boolean> {
    const redis = await getPersonalizationRedis();
    const queueKey = `${KEY_NS}signal-queue:${deviceId}`;
    const queueLength = await redis.rPush(queueKey, JSON.stringify(signal));
    await redis.sAdd(`${KEY_NS}signal-queue:index`, deviceId);

    logger.info(
      {
        signalType: signal.type,
        deviceId,
        userId: userId ?? undefined,
        queueLength,
      },
      'Signal queued'
    );

    if (userId) {
      await featureStore.mergeToUser(deviceId, userId);
    }

    const profile = await featureStore.getOrCreate(deviceId);
    this.updateProfile(profile, signal);
    await featureStore.save(profile);

    await this.invalidateDecisionCache(deviceId);

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

  private async invalidateDecisionCache(deviceId: string): Promise<void> {
    const redis = await getPersonalizationRedis();
    const pattern = `${KEY_NS}decision:${deviceId}:*`;
    let keysToDelete: string[] = [];
    for await (const key of redis.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      keysToDelete.push(String(key));
      if (keysToDelete.length >= 500) {
        await redis.del(keysToDelete);
        keysToDelete = [];
      }
    }
    if (keysToDelete.length > 0) {
      await redis.del(keysToDelete);
    }
  }

  /**
   * Sends queued signals to Medusa. Only clears the queue after a successful POST.
   */
  async flushQueue(deviceId: string): Promise<number> {
    const redis = await getPersonalizationRedis();
    const key = `${KEY_NS}signal-queue:${deviceId}`;
    const count = await redis.lLen(key);
    if (count === 0) {
      return 0;
    }

    const items = await redis.lRange(key, 0, -1);
    const signals: QueuedSignal[] = items.map(
      (i) => JSON.parse(i) as QueuedSignal
    );

    const profile = await featureStore.getOrCreate(deviceId);
    const userId = profile.userId;

    const payload = {
      signals: signals.map((s) => ({
        device_id: deviceId,
        ...(userId ? { user_id: userId } : {}),
        signal_type: s.type,
        payload: s.payload ?? {},
        ...(s.url ? { url: s.url } : {}),
        timestamp: s.timestamp,
      })),
    };

    await postPersonalizationWebhook(
      MEDUSA_PERSONALIZATION_PATHS.signals,
      payload
    );
    await redis.del(key);

    const uniqueSignalTypes = [...new Set(signals.map((s) => s.type))];
    logger.info(
      {
        deviceId,
        signalCount: signals.length,
        signalTypes: uniqueSignalTypes,
      },
      'Queue flushed'
    );
    return signals.length;
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
        profile.intentSignals.cartToPurchaseRate = Math.min(
          1,
          (profile.intentSignals.cartToPurchaseRate ?? 0) + CART_TO_PURCHASE_INCREMENT
        );
        break;

      case 'CHECKOUT_ABANDON':
        profile.intentSignals.cartToPurchaseRate = Math.max(
          0,
          (profile.intentSignals.cartToPurchaseRate ?? 0) - CART_TO_PURCHASE_DECREMENT
        );
        profile.hesitationCount = (profile.hesitationCount ?? 0) + 1;
        break;

      case 'RETURN_POLICY_VIEW':
      case 'TRUST_BADGE_CLICK':
      case 'SECURITY_INFO_VIEW':
        profile.intentSignals.returnRate = Math.min(
          1,
          (profile.intentSignals.returnRate ?? 0) + RETURN_RATE_INCREMENT
        );
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
            category,
            price: signal.payload.price as number | undefined,
            timestamp: signal.timestamp,
          });
          profile.recentProducts = profile.recentProducts.slice(-MAX_RECENT_PRODUCTS);
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
