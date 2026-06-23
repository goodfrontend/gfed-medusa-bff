import type { LifecycleStage } from '../types/common.js';
import type { Signal } from '../types/signals.js';
import type {
  CategoryAffinityEntry,
  CurrentSession,
  ProductViewEntry,
  UserProfile,
} from '../types/profile.js';
import { SignalStore } from './signal-store.js';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_CATEGORY_SCORE = 5.0;
const MAX_RESEARCH_DEPTH = 5;
const MAX_CART_ACTIVITY = 50;
const MAX_HISTORY_LENGTH = 20;
const MAX_RECENT_PRODUCTS = 20;
const DEFAULT_CATEGORY_VIEW_WEIGHT = 0.15;
const PRODUCT_VIEW_WEIGHT = 0.25;

/**
 * Derives a UserProfile from accumulated signals.
 * Mirrors the logic in the BFF's signal-ingestion.ts and feature-store.ts
 * but simplified — no Redis, no Medusa, no time decay.
 */
export class ProfileStore {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly signalStore: SignalStore) {}

  /**
   * Build a UserProfile from all signals for the given deviceId.
   * Signals are processed in chronological order (oldest first).
   * Returns a default empty profile if no signals exist for the deviceId.
   */
  build(deviceId: string, userId?: string): UserProfile {
    const signals = this.signalStore.getSignals(deviceId);

    if (signals.length === 0) {
      return this.defaultProfile(deviceId, userId);
    }

    // getSignals returns newest first — reverse for chronological order
    const chronological = [...signals].reverse();
    return this.buildFromSignals(deviceId, userId, chronological);
  }

  private defaultProfile(deviceId: string, userId?: string): UserProfile {
    const now = Date.now();
    return {
      deviceId,
      userId,
      categoryAffinity: {},
      priceSensitivity: { score: 0, avgViewedPrice: 0, dealClickRate: 0 },
      intentSignals: { researchDepth: 0, checkoutConversion: 0 },
      engagementLevel: 'LOW',
      lifecycleStage: 'NEW',
      firstSeen: now,
      lastSeen: now,
      sessionCount: 0,
      orderCount: 0,
      searchHistory: [],
      cartActivity: 0,
      hesitationCount: 0,
      recentProducts: [],
      lastSignalTimestamp: 0,
    };
  }

  private buildFromSignals(
    deviceId: string,
    userId: string | undefined,
    signals: Signal[],
  ): UserProfile {
    const categoryAffinity: Record<string, CategoryAffinityEntry> = {};
    const priceSensitivity = { score: 0, avgViewedPrice: 0, dealClickRate: 0 };
    const intentSignals = { researchDepth: 0, checkoutConversion: 0 };
    let cartActivity = 0;
    let hesitationCount = 0;
    const searchHistory: Array<{ query: string; timestamp: number }> = [];
    const recentProducts: ProductViewEntry[] = [];
    let lastSignalTimestamp = 0;
    let firstSeen = 0;
    let sessionCount = 0;
    let currentSession: CurrentSession | undefined;

    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i]!;
      const ts = signal.timestamp;

      if (i === 0) {
        firstSeen = ts;
      }

      // Session tracking: count gaps > 30 min between consecutive signals
      if (lastSignalTimestamp > 0 && ts - lastSignalTimestamp > SESSION_TIMEOUT_MS) {
        sessionCount++;
        currentSession = this.newSession(ts);
      } else if (!currentSession) {
        currentSession = this.newSession(ts);
      }

      if (currentSession) {
        currentSession.signalCount++;
      }

      this.processSignalType(
        signal,
        categoryAffinity,
        priceSensitivity,
        intentSignals,
        recentProducts,
        searchHistory,
        currentSession,
      );

      // Update tracked counters based on signal type
      switch (signal.type) {
        case 'CART_ADD':
          cartActivity = Math.min(MAX_CART_ACTIVITY, cartActivity + 1);
          if (currentSession) currentSession.cartAdds++;
          break;
        case 'CART_REMOVE':
          cartActivity = Math.max(0, cartActivity - 1);
          break;
        case 'CHECKOUT_ABANDON':
          hesitationCount++;
          break;
        default:
          break;
      }

      lastSignalTimestamp = ts;
    }

    // Session count = gaps + 1 (initial session)
    sessionCount = sessionCount + 1;

    // Determine engagement level
    const totalViews = Object.values(categoryAffinity).reduce(
      (sum, entry) => sum + entry.views,
      0,
    );
    const engagementLevel = this.determineEngagementLevel(
      sessionCount,
      cartActivity,
      totalViews,
    );

    // Calculate price sensitivity score (mirrors BFF recalculateDerived)
    priceSensitivity.score = Math.min(
      priceSensitivity.dealClickRate * 0.5 +
        (priceSensitivity.avgViewedPrice > 80
          ? 0.3
          : priceSensitivity.avgViewedPrice > 40
            ? 0.2
            : 0),
      1,
    );

    return {
      deviceId,
      userId,
      categoryAffinity,
      priceSensitivity,
      intentSignals,
      engagementLevel,
      lifecycleStage: determineLifecycleStage(sessionCount, cartActivity),
      firstSeen,
      lastSeen: signals[signals.length - 1]!.timestamp,
      sessionCount,
      orderCount: 0,
      searchHistory,
      cartActivity,
      hesitationCount,
      recentProducts,
      lastSignalTimestamp,
      currentSession,
    };
  }

  private processSignalType(
    signal: Signal,
    categoryAffinity: Record<string, CategoryAffinityEntry>,
    priceSensitivity: { score: number; avgViewedPrice: number; dealClickRate: number },
    intentSignals: { researchDepth: number; checkoutConversion: number },
    recentProducts: ProductViewEntry[],
    searchHistory: Array<{ query: string; timestamp: number }>,
    currentSession: CurrentSession | undefined,
  ): void {
    switch (signal.type) {
      case 'PAGE_VIEW':
      case 'PRODUCT_HOVER':
      case 'QUICK_VIEW_OPEN':
      case 'IMAGE_ZOOM':
      case 'REVIEWS_VIEW':
      case 'SIZE_GUIDE_VIEW':
        this.addCategoryView(signal, categoryAffinity, DEFAULT_CATEGORY_VIEW_WEIGHT);
        break;

      case 'PRODUCT_VIEW':
        this.handleProductView(
          signal,
          categoryAffinity,
          priceSensitivity,
          recentProducts,
          currentSession,
        );
        break;

      case 'SEARCH_QUERY':
        intentSignals.researchDepth = Math.min(
          MAX_RESEARCH_DEPTH,
          intentSignals.researchDepth + 0.15,
        );
        {
          const query = String(signal.payload.query ?? '');
          if (query) {
            searchHistory.push({ query, timestamp: signal.timestamp });
            if (searchHistory.length > MAX_HISTORY_LENGTH) {
              searchHistory.splice(0, searchHistory.length - MAX_HISTORY_LENGTH);
            }
          }
          if (currentSession && query) {
            currentSession.searches.unshift(query);
            currentSession.searches = currentSession.searches.slice(0, 5);
          }
        }
        break;

      case 'SEARCH_RESULT_CLICK':
        intentSignals.researchDepth = Math.min(
          MAX_RESEARCH_DEPTH,
          intentSignals.researchDepth + 0.1,
        );
        break;

      case 'FILTER_APPLIED':
      case 'SORT_CHANGED':
        this.handleFilterSort(signal, priceSensitivity);
        break;

      case 'CART_ADD':
        break;

      case 'CART_REMOVE':
        break;

      case 'CHECKOUT_START':
        intentSignals.checkoutConversion = Math.min(
          1,
          intentSignals.checkoutConversion + 0.15,
        );
        break;

      case 'CHECKOUT_ABANDON':
        intentSignals.checkoutConversion = Math.max(
          0,
          intentSignals.checkoutConversion - 0.1,
        );
        break;

      default:
        break;
    }
  }

  private addCategoryView(
    signal: Signal,
    categoryAffinity: Record<string, CategoryAffinityEntry>,
    weight: number,
  ): void {
    const category =
      (signal.payload.category as string | undefined) ||
      this.extractCategoryFromUrl(signal.url);

    if (!category) {
      return;
    }

    if (!categoryAffinity[category]) {
      categoryAffinity[category] = {
        views: 0,
        purchases: 0,
        lastViewed: 0,
        score: 0,
      };
    }

    const aff = categoryAffinity[category]!;
    aff.views += 1;
    aff.lastViewed = signal.timestamp;
    aff.score = Math.min(aff.score + weight, MAX_CATEGORY_SCORE);
  }

  private handleProductView(
    signal: Signal,
    categoryAffinity: Record<string, CategoryAffinityEntry>,
    priceSensitivity: { score: number; avgViewedPrice: number; dealClickRate: number },
    recentProducts: ProductViewEntry[],
    currentSession: CurrentSession | undefined,
  ): void {
    const category =
      (signal.payload.category as string | undefined) ||
      this.extractCategoryFromUrl(signal.url);

    if (category) {
      this.addCategoryView(signal, categoryAffinity, PRODUCT_VIEW_WEIGHT);
    }

    const productId = String(signal.payload.productId ?? '');
    if (productId) {
      recentProducts.push({
        productId,
        productName:
          String(
            signal.payload.name ?? signal.payload.productName ?? '',
          ),
        category: category ?? '',
        price: signal.payload.price as number | undefined,
        timestamp: signal.timestamp,
      });
      if (recentProducts.length > MAX_RECENT_PRODUCTS) {
        recentProducts.splice(0, recentProducts.length - MAX_RECENT_PRODUCTS);
      }

      if (currentSession) {
        currentSession.productViews.unshift(productId);
        currentSession.productViews = currentSession.productViews.slice(0, 10);
        if (category && !currentSession.firstCategory) {
          currentSession.firstCategory = category;
        }
      }
    }

    if (typeof signal.payload.price === 'number') {
      const price = signal.payload.price;
      if (priceSensitivity.avgViewedPrice === 0) {
        priceSensitivity.avgViewedPrice = price;
      } else {
        priceSensitivity.avgViewedPrice =
          (priceSensitivity.avgViewedPrice + price) / 2;
      }
    }
  }

  private handleFilterSort(
    signal: Signal,
    priceSensitivity: { score: number; avgViewedPrice: number; dealClickRate: number },
  ): void {
    if (
      signal.payload.sort === 'price-asc' ||
      String(signal.payload.filter ?? '').includes('under')
    ) {
      priceSensitivity.dealClickRate = Math.min(
        1,
        priceSensitivity.dealClickRate + 0.12,
      );
    }

    const priceRange = signal.payload.priceRange as
      | { max?: number }
      | undefined;
    if (priceRange?.max != null && typeof priceRange.max === 'number') {
      if (priceSensitivity.avgViewedPrice === 0) {
        priceSensitivity.avgViewedPrice = priceRange.max;
      } else {
        priceSensitivity.avgViewedPrice =
          (priceSensitivity.avgViewedPrice + priceRange.max) / 2;
      }
    }
  }

  private extractCategoryFromUrl(url: string | undefined): string | null {
    if (!url) {
      return null;
    }
    const match = url.match(/\/(?:category|categories)\/([^/?]+)/);
    if (match?.[1]) {
      return match[1];
    }
    const queryMatch = url.match(/category=([^&]+)/);
    return queryMatch?.[1] ?? null;
  }

  private determineEngagementLevel(
    sessionCount: number,
    cartActivity: number,
    totalViews: number,
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (sessionCount <= 2 && cartActivity === 0 && totalViews < 3) {
      return 'LOW';
    }
    if (sessionCount > 10 || cartActivity > 5 || totalViews > 20) {
      return 'HIGH';
    }
    return 'MEDIUM';
  }

  private newSession(startedAt: number): CurrentSession {
    return {
      startedAt,
      signalCount: 0,
      searches: [],
      productViews: [],
      cartAdds: 0,
    };
  }
}

/**
 * Derives lifecycle stage from session count and cart activity.
 * Since this is a mock service without order tracking, cart activity
 * serves as a proxy for purchase behavior.
 */
function determineLifecycleStage(
  sessionCount: number,
  cartActivity: number,
): LifecycleStage {
  if (sessionCount > 20 || cartActivity > 10) return 'LOYAL';
  if (sessionCount > 10 || cartActivity > 5) return 'FREQUENT';
  if (sessionCount > 1 || cartActivity > 0) return 'RETURNING';
  return 'NEW';
}
