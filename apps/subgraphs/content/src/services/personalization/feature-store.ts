import {
  KEY_NS,
  getPersonalizationRedis,
} from '../../config/personalization-redis';

const PROFILE_KEY = `${KEY_NS}profile:`;
const PROFILE_TTL = 90 * 24 * 60 * 60;
const DECISION_KEY = `${KEY_NS}decision:`;
const OUTCOMES_KEY = `${KEY_NS}outcomes:`;

export interface CategoryAffinityEntry {
  views: number;
  purchases: number;
  lastViewed: number;
  score: number;
}

export interface ProductViewEntry {
  productId: string;
  category: string;
  price?: number;
  timestamp: number;
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
    cartToPurchaseRate: number;
    returnRate: number;
  };
  engagementLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  lifecycleStage: 'NEW' | 'RETURNING' | 'FREQUENT' | 'LOYAL';
  firstSeen: number;
  lastSeen: number;
  sessionCount: number;
  /** Completed orders attributed to this profile (conversion webhooks). */
  orderCount?: number;
  searchHistory?: Array<{ query: string; timestamp: number }>;
  cartActivity?: number;
  hesitationCount?: number;
  recentProducts?: ProductViewEntry[];
  lastSignalTimestamp?: number;
}

export class FeatureStore {
  async getCachedDecision(
    deviceId: string,
    surface: string
  ): Promise<Record<string, unknown> | null> {
    const redis = await getPersonalizationRedis();
    const key = `${DECISION_KEY}${deviceId}:${surface}`;
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  }

  async getOrCreate(deviceId: string): Promise<UserProfile> {
    const redis = await getPersonalizationRedis();
    const data = await redis.get(`${PROFILE_KEY}${deviceId}`);
    if (data) {
      return JSON.parse(data) as UserProfile;
    }

    const profile: UserProfile = {
      deviceId,
      categoryAffinity: {},
      priceSensitivity: { score: 0.5, avgViewedPrice: 0, dealClickRate: 0 },
      intentSignals: {
        researchDepth: 0,
        cartToPurchaseRate: 0,
        returnRate: 0,
      },
      engagementLevel: 'LOW',
      lifecycleStage: 'NEW',
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      sessionCount: 0,
      orderCount: 0,
      recentProducts: [],
      lastSignalTimestamp: 0,
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

  async cacheDecision(
    deviceId: string,
    surface: string,
    result: unknown,
    ttl = 300
  ): Promise<void> {
    const redis = await getPersonalizationRedis();
    const key = `${DECISION_KEY}${deviceId}:${surface}`;
    await redis.set(key, JSON.stringify(result), { EX: ttl });
    await redis.sAdd(`${KEY_NS}decision-surfaces:${deviceId}`, surface);
  }

  async recordDecision(
    deviceId: string,
    decision: Record<string, unknown>
  ): Promise<void> {
    const redis = await getPersonalizationRedis();
    const key = `${KEY_NS}history:${deviceId}`;
    await redis.rPush(
      key,
      JSON.stringify({ ...decision, timestamp: Date.now() })
    );
    await redis.lTrim(key, -100, -1);
  }

  async recordOutcome(
    deviceId: string,
    surface: string,
    components: unknown[],
    converted: boolean
  ): Promise<void> {
    const redis = await getPersonalizationRedis();
    const key = `${OUTCOMES_KEY}${deviceId}`;
    await redis.rPush(
      key,
      JSON.stringify({
        surface,
        components,
        converted,
        timestamp: Date.now(),
      })
    );
    await redis.lTrim(key, -500, -1);
  }
}

export const featureStore = new FeatureStore();
