import {
  KEY_NS,
  getPersonalizationRedis,
} from '../../config/personalization-redis';

const PROFILE_KEY = `${KEY_NS}profile:`;
const PROFILE_TTL = 90 * 24 * 60 * 60;

export interface CategoryAffinityEntry {
  views: number;
  purchases: number;
  lastViewed: number;
  score: number;
}

export interface ProductViewEntry {
  productId: string;
  productName: string;
  category: string;
  price?: number;
  timestamp: number;
}

export interface CurrentSession {
  startedAt: number;
  signalCount: number;
  searches: string[];
  productViews: string[];
  cartAdds: number;
  firstCategory?: string;
}

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
  engagementLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  lifecycleStage: 'NEW' | 'RETURNING' | 'FREQUENT' | 'LOYAL';
  firstSeen: number;
  lastSeen: number;
  sessionCount: number;
  /** Completed orders attributed to this profile. */
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

export class FeatureStore {
  async getOrCreate(deviceId: string): Promise<UserProfile> {
    const redis = await getPersonalizationRedis();
    const data = await redis.get(`${PROFILE_KEY}${deviceId}`);
    if (data) {
      const raw = JSON.parse(data);
      return this.migrateProfile(raw);
    }

    const profile: UserProfile = {
      deviceId,
      categoryAffinity: {},
      priceSensitivity: { score: 0, avgViewedPrice: 0, dealClickRate: 0 },
      intentSignals: {
        researchDepth: 0,
        checkoutConversion: 0,
      },
      engagementLevel: 'LOW',
      lifecycleStage: 'NEW',
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      sessionCount: 0,
      orderCount: 0,
      recentProducts: [],
      lastSignalTimestamp: 0,
      lastPurchaseDate: 0,
      totalSpent: 0,
      averageOrderValue: 0,
    };
    await this.save(profile);
    return profile;
  }

  async save(profile: UserProfile): Promise<void> {
    const redis = await getPersonalizationRedis();
    profile.lastSeen = Date.now();
    await redis.set(
      `${PROFILE_KEY}${profile.deviceId}`,
      JSON.stringify(profile),
      {
        EX: PROFILE_TTL,
      }
    );
  }

  private migrateProfile(raw: Record<string, unknown>): UserProfile {
    if (raw.intentSignals && typeof raw.intentSignals === 'object') {
      const is = raw.intentSignals as Record<string, unknown>;
      if ('cartToPurchaseRate' in is && !('checkoutConversion' in is)) {
        is.checkoutConversion = is.cartToPurchaseRate;
      }
      delete is.cartToPurchaseRate;
      delete is.returnRate;
    }

    if (Array.isArray(raw.recentProducts)) {
      for (const entry of raw.recentProducts as Record<string, unknown>[]) {
        if (!('productName' in entry)) {
          entry.productName = '';
        }
      }
    }

    return raw as unknown as UserProfile;
  }

  async getByUserId(userId: string): Promise<UserProfile | null> {
    const redis = await getPersonalizationRedis();
    const deviceId = await redis.get(`${KEY_NS}user-device:${userId}`);
    if (!deviceId) {
      return null;
    }
    return this.getOrCreate(deviceId);
  }

  async mergeToUser(deviceId: string, userId: string): Promise<UserProfile> {
    const profile = await this.getOrCreate(deviceId);
    const redis = await getPersonalizationRedis();
    const existingDeviceId = await redis.get(`${KEY_NS}user-device:${userId}`);

    if (existingDeviceId && existingDeviceId !== deviceId) {
      const existingProfile = await this.getOrCreate(existingDeviceId);
      for (const [cat, data] of Object.entries(
        existingProfile.categoryAffinity
      )) {
        if (!profile.categoryAffinity[cat]) {
          profile.categoryAffinity[cat] = { ...data };
        } else {
          const a = profile.categoryAffinity[cat];
          a.views += data.views;
          a.purchases += data.purchases;
          a.lastViewed = Math.max(a.lastViewed, data.lastViewed);
          a.score = Math.max(a.score, data.score);
        }
      }
      profile.sessionCount += existingProfile.sessionCount;
      profile.orderCount =
        (profile.orderCount ?? 0) + (existingProfile.orderCount ?? 0);
    }
    profile.userId = userId;
    await this.save(profile);
    await redis.set(`${KEY_NS}user-device:${userId}`, deviceId, {
      EX: PROFILE_TTL,
    });
    return profile;
  }

}

export const featureStore = new FeatureStore();
