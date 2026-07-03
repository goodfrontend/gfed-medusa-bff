import Medusa from '@medusajs/js-sdk';

import {
  KEY_NS,
  getPersonalizationRedis,
} from '../../config/personalization-redis';

import { logger } from './logger';

const PROFILE_KEY = `${KEY_NS}profile:`;
const PROFILE_TTL = 90 * 24 * 60 * 60;
const SYNC_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DEVICE_USER_KEY = `${KEY_NS}device-user:`;
const USER_DEVICE_KEY = `${KEY_NS}user-device:`;

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

export interface DecisionRecord {
  components: string[];
  surface: string;
  intent: string;
  servedAt: number;
  conversionAttributed?: {
    orderId: string;
    amount: number;
    attributedAt: number;
  };
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
  /** Timestamp of last Medusa order sync (used with SYNC_COOLDOWN_MS to avoid repeated calls). */
  ordersSynced?: number;
  /** Last 10 personalization decisions served to this user, newest first. */
  recentDecisions?: DecisionRecord[];
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
      recentDecisions: [],
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
    const deviceId = await redis.get(`${USER_DEVICE_KEY}${userId}`);
    if (!deviceId) {
      return null;
    }
    return this.getOrCreate(deviceId);
  }

  async mergeToUser(deviceId: string, userId: string): Promise<UserProfile> {
    const redis = await getPersonalizationRedis();
    const existingDeviceId = await redis.get(`${USER_DEVICE_KEY}${userId}`);

    // Clean up stale user-device mapping: if this device was previously
    // associated with a different userId, remove the old mapping to prevent
    // data bleed between users sharing a device.
    const previousUserId = await redis.get(`${DEVICE_USER_KEY}${deviceId}`);
    if (previousUserId && previousUserId !== userId) {
      await redis.del(`${USER_DEVICE_KEY}${previousUserId}`);
    }

    if (existingDeviceId && existingDeviceId !== deviceId) {
      // Case A: User already has a profile on a different device
      const [existingProfile, newDeviceProfile] = await Promise.all([
        this.getOrCreate(existingDeviceId),
        this.getOrCreate(deviceId),
      ]);

      // Merge anonymous behavioral data from the new device into the
      // existing authenticated profile so browsing data accumulated on
      // the new device before login is not lost.

      // categoryAffinity — merge entries from new device into existing
      for (const [cat, entry] of Object.entries(newDeviceProfile.categoryAffinity)) {
        if (!existingProfile.categoryAffinity[cat]) {
          existingProfile.categoryAffinity[cat] = { ...entry };
        } else {
          const existing = existingProfile.categoryAffinity[cat];
          existing.views += entry.views;
          existing.purchases += entry.purchases;
          if (entry.lastViewed > existing.lastViewed) {
            existing.lastViewed = entry.lastViewed;
          }
          if (entry.score > existing.score) {
            existing.score = entry.score;
          }
        }
      }

      // priceSensitivity — average the avgViewedPrice, take max for others
      if (newDeviceProfile.priceSensitivity.avgViewedPrice > 0) {
        const ps = existingProfile.priceSensitivity;
        const nps = newDeviceProfile.priceSensitivity;
        if (ps.avgViewedPrice === 0) {
          ps.avgViewedPrice = nps.avgViewedPrice;
          ps.score = nps.score;
          ps.dealClickRate = nps.dealClickRate;
        } else {
          ps.avgViewedPrice = (ps.avgViewedPrice + nps.avgViewedPrice) / 2;
          ps.score = Math.max(ps.score, nps.score);
          ps.dealClickRate = Math.max(ps.dealClickRate, nps.dealClickRate);
        }
      }

      // recentProducts — deduplicate by productId
      if (newDeviceProfile.recentProducts?.length) {
        const existingIds = new Set(
          existingProfile.recentProducts?.map((p) => p.productId) ?? [],
        );
        for (const product of newDeviceProfile.recentProducts) {
          if (!existingIds.has(product.productId)) {
            existingProfile.recentProducts = existingProfile.recentProducts ?? [];
            existingProfile.recentProducts.push(product);
          }
        }
      }

      // searchHistory — append and cap at 20
      if (newDeviceProfile.searchHistory?.length) {
        existingProfile.searchHistory = [
          ...(existingProfile.searchHistory ?? []),
          ...newDeviceProfile.searchHistory,
        ].slice(-20);
      }

      // sessionCount — keep the higher value
      existingProfile.sessionCount = Math.max(
        existingProfile.sessionCount ?? 0,
        newDeviceProfile.sessionCount ?? 0,
      );

      // intentSignals — take the max per field
      existingProfile.intentSignals = {
        researchDepth: Math.max(
          existingProfile.intentSignals.researchDepth,
          newDeviceProfile.intentSignals.researchDepth,
        ),
        checkoutConversion: Math.max(
          existingProfile.intentSignals.checkoutConversion,
          newDeviceProfile.intentSignals.checkoutConversion,
        ),
      };

      // Transfer order/financial data from the new device if it has fresher
      // order sync data (e.g., when syncOrderHistory ran before mergeToUser).
      if (
        newDeviceProfile.ordersSynced &&
        (!existingProfile.ordersSynced ||
          newDeviceProfile.ordersSynced > existingProfile.ordersSynced)
      ) {
        existingProfile.orderCount = newDeviceProfile.orderCount;
        existingProfile.lifecycleStage = newDeviceProfile.lifecycleStage;
        existingProfile.totalSpent = newDeviceProfile.totalSpent;
        existingProfile.averageOrderValue = newDeviceProfile.averageOrderValue;
        existingProfile.lastPurchaseDate = newDeviceProfile.lastPurchaseDate;
        existingProfile.ordersSynced = newDeviceProfile.ordersSynced;
      }

      existingProfile.deviceId = deviceId;
      existingProfile.userId = userId;
      await this.save(existingProfile);
      await redis.del(`${PROFILE_KEY}${existingDeviceId}`);
      await redis.set(`${USER_DEVICE_KEY}${userId}`, deviceId, {
        EX: PROFILE_TTL,
      });
      await redis.set(`${DEVICE_USER_KEY}${deviceId}`, userId, {
        EX: PROFILE_TTL,
      });
      return existingProfile;
    }

    // Case B: No existing profile for this user on a different device
    const profile = await this.getOrCreate(deviceId);
    profile.userId = userId;
    await this.save(profile);
    await redis.set(`${USER_DEVICE_KEY}${userId}`, deviceId, {
      EX: PROFILE_TTL,
    });
    await redis.set(`${DEVICE_USER_KEY}${deviceId}`, userId, {
      EX: PROFILE_TTL,
    });
    return profile;
  }

  async syncOrderHistory(
    deviceId: string,
    medusaToken: string,
    profile?: UserProfile
  ): Promise<UserProfile> {
    profile = profile ?? await this.getOrCreate(deviceId);

    if (
      profile.ordersSynced &&
      Date.now() - profile.ordersSynced < SYNC_COOLDOWN_MS
    ) {
      return profile;
    }

    try {
      const medusa = new Medusa({
        baseUrl: process.env.MEDUSA_API_URL || 'http://localhost:9000',
        auth: {
          type: 'jwt',
        },
        globalHeaders: {
          'x-publishable-api-key':
            process.env.MEDUSA_PUBLISHABLE_KEY || 'pk_test',
          ...(medusaToken
            ? { Authorization: `Bearer ${medusaToken}` }
            : undefined),
        },
      });

      const { orders, count } = await medusa.store.order.list({
        limit: 100,
        fields: 'id,total,created_at',
      });

      profile.orderCount = count;

      if (count >= 5) {
        profile.lifecycleStage = 'LOYAL';
      } else if (count >= 2) {
        profile.lifecycleStage = 'FREQUENT';
      } else if (count >= 1) {
        profile.lifecycleStage = 'RETURNING';
      }

      if (orders?.length && count > 0) {
        const firstOrder = orders[0]!;
        let totalSpent = 0;
        for (const order of orders) {
          totalSpent += Number(order.total ?? 0);
        }
        profile.totalSpent = totalSpent;
        profile.averageOrderValue = totalSpent / count;
        profile.lastPurchaseDate = firstOrder.created_at
          ? new Date(firstOrder.created_at).getTime()
          : Date.now();
      }

      profile.ordersSynced = Date.now();

      await this.save(profile);

      logger.info(
        { deviceId, orderCount: count },
        'Order history synced from Medusa'
      );
    } catch (err) {
      logger.warn(
        { err, deviceId },
        'Failed to sync order history from Medusa'
      );
    }

    return profile;
  }
}

export const featureStore = new FeatureStore();
