import type { ApiResponse, EngagementLevel, Intent, LifecycleStage } from './common.js';

/**
 * User profile — what the external service maintains per device/user.
 * Exposed via GET /api/profiles/:deviceId for debugging.
 */

/** Category affinity score for a single category. */
export interface CategoryAffinityEntry {
  views: number;
  purchases: number;
  lastViewed: number;
  score: number;
}

/** Record of a product view. */
export interface ProductViewEntry {
  productId: string;
  productName: string;
  category: string;
  price?: number;
  timestamp: number;
}

/** Current session tracking data. */
export interface CurrentSession {
  startedAt: number;
  signalCount: number;
  searches: string[];
  productViews: string[];
  cartAdds: number;
  firstCategory?: string;
}

/** Full user profile maintained by the external personalization service. */
export interface UserProfile {
  deviceId: string;
  userId?: string;
  categoryAffinity: Record<string, CategoryAffinityEntry>;
  priceSensitivity: {
    score: number;
    avgViewedPrice: number;
    dealClickRate: number;
  };
  intentSignals: {
    researchDepth: number;
    checkoutConversion: number;
  };
  engagementLevel: EngagementLevel;
  lifecycleStage: LifecycleStage;
  firstSeen: number;
  lastSeen: number;
  sessionCount: number;
  orderCount?: number;
  searchHistory?: Array<{ query: string; timestamp: number }>;
  cartActivity?: number;
  hesitationCount?: number;
  recentProducts?: ProductViewEntry[];
  lastSignalTimestamp?: number;
  currentSession?: CurrentSession;
  lastPurchaseDate?: number;
  totalSpent?: number;
  averageOrderValue?: number;
}

/** Scored intent for a single intent type. */
export interface IntentScore {
  intent: Intent;
  score: number;
}

/** Response body for GET /api/profiles/:deviceId on success. */
export interface ProfileDebugResponse {
  profile: UserProfile;
  intentScores: IntentScore[];
  signalCount: number;
}

/** Wrapped API response for profile debug endpoint. */
export type ProfileApiResponse = ApiResponse<ProfileDebugResponse>;
