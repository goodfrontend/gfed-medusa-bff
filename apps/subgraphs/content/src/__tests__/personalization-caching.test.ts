import { KEY_NS } from '../config/personalization-redis';
import { featureStore } from '../services/personalization/feature-store';
import type { UserProfile } from '../services/personalization/feature-store';
import { signalProcessor } from '../services/personalization/signal-ingestion';

const mockStore = new Map<string, string>();
const mockSetStore = new Map<string, Set<string>>();
const mockListStore = new Map<string, string[]>();

jest.mock('../config/personalization-redis', () => {
  const mockRedisModule = {
    isOpen: true,
    get: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      mockStore.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (keys: string | string[]) => {
      const ks = Array.isArray(keys) ? keys : [keys];
      ks.forEach(k => mockStore.delete(k));
      return ks.length;
    }),
    sAdd: jest.fn(async (key: string, value: string) => {
      if (!mockSetStore.has(key)) mockSetStore.set(key, new Set());
      mockSetStore.get(key)!.add(value);
      return 1;
    }),
    sMembers: jest.fn(async (key: string) => {
      const s = mockSetStore.get(key);
      return s ? [...s] : [];
    }),
    rPush: jest.fn(async (key: string, value: string) => {
      if (!mockListStore.has(key)) mockListStore.set(key, []);
      mockListStore.get(key)!.push(value);
      return mockListStore.get(key)!.length;
    }),
    lLen: jest.fn(async (key: string) => mockListStore.get(key)?.length ?? 0),
    lRange: jest.fn(async (key: string) => mockListStore.get(key) ?? []),
    lTrim: jest.fn(async () => 'OK'),
    scanIterator: jest.fn(async function* () {
      const prefix = `bff:personalization:v1:decision:`;
      for (const key of mockStore.keys()) {
        if (key.startsWith(prefix)) yield key;
      }
    }),
  };

  return {
    getPersonalizationRedis: jest.fn().mockResolvedValue(mockRedisModule),
    KEY_NS: 'bff:personalization:v1:',
  };
});

describe('Personalization Caching', () => {
  const deviceId = 'test-device-123';
  const surface = 'homepage_hero';

  let profile: UserProfile;

  beforeEach(() => {
    mockStore.clear();
    mockSetStore.clear();
    mockListStore.clear();
    jest.clearAllMocks();
    profile = {
      deviceId,
      categoryAffinity: {},
      priceSensitivity: { score: 0.5, avgViewedPrice: 0, dealClickRate: 0 },
      intentSignals: { researchDepth: 0, cartToPurchaseRate: 0, returnRate: 0 },
      engagementLevel: 'LOW',
      lifecycleStage: 'NEW',
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      sessionCount: 1,
      orderCount: 0,
      recentProducts: [],
      lastSignalTimestamp: 0,
    };
  });

  describe('Decision Cache', () => {
    it('should store and retrieve a cached decision', async () => {
      await featureStore.save(profile);

      const decision = {
        components: [{ component: 'HeroBanner', priority: 1, propsOverrides: {}, score: 1, reasoning: 'test' }],
        reasoning: { intent: 'browse', confidence: 0.5, factors: [], modelVersion: 'rules-v1' },
        cacheKey: `decision:${deviceId}:${surface}`,
        servedAt: new Date().toISOString(),
      };

      await featureStore.cacheDecision(deviceId, surface, decision, 300);

      const cached = await featureStore.getCachedDecision(deviceId, surface);

      expect(cached).not.toBeNull();
      expect(cached?.cacheKey).toBe(decision.cacheKey);
      expect(cached?.components[0].component).toBe('HeroBanner');
    });

    it('should return null when no cached decision exists', async () => {
      const result = await featureStore.getCachedDecision(deviceId, surface);
      expect(result).toBeNull();
    });
  });

  describe('Cached Decision Invalidation', () => {
    it('should not throw when no cached decision exists', async () => {
      await featureStore.save(profile);

      const signal = {
        type: 'PAGE_VIEW',
        payload: {},
        url: '/test',
        timestamp: Date.now(),
      };
      mockStore.set(`${KEY_NS}profile:${deviceId}`, JSON.stringify(profile));

      await expect(
        signalProcessor.process(signal, deviceId)
      ).resolves.toBe(true);
    });

    it('should invalidate decision cache when signal is processed', async () => {
      await featureStore.save(profile);

      const decision = {
        components: [{ component: 'HeroBanner', priority: 1, propsOverrides: {}, score: 1, reasoning: 'test' }],
        reasoning: { intent: 'browse', confidence: 0.5, factors: [], modelVersion: 'rules-v1' },
        cacheKey: `decision:${deviceId}:${surface}`,
        servedAt: new Date().toISOString(),
      };
      await featureStore.cacheDecision(deviceId, surface, decision, 300);

      const cacheKey = `${KEY_NS}decision:${deviceId}:${surface}`;
      expect(mockStore.has(cacheKey)).toBe(true);

      const signal = {
        type: 'PAGE_VIEW',
        payload: {},
        url: '/test',
        timestamp: Date.now(),
      };
      mockStore.set(`${KEY_NS}profile:${deviceId}`, JSON.stringify(profile));
      await signalProcessor.process(signal, deviceId);

      expect(mockStore.has(cacheKey)).toBe(false);
    });
  });

  describe('Cache Shape Integrity', () => {
    it('should return cached decision with all PersonalizationResult fields', async () => {
      await featureStore.save(profile);

      const now = new Date().toISOString();
      const decision = {
        components: [
          { component: 'HeroBanner', contentId: 'banner-1', priority: 1, propsOverrides: { headline: 'Test' }, reasoning: 'match', score: 0.9 },
        ],
        reasoning: { intent: 'browse', confidence: 0.5, factors: ['cat1'], modelVersion: 'rules-v1' },
        cacheKey: `decision:${deviceId}:${surface}`,
        servedAt: now,
      };

      await featureStore.cacheDecision(deviceId, surface, decision, 300);
      const cached = await featureStore.getCachedDecision(deviceId, surface);

      expect(cached).toHaveProperty('cacheKey');
      expect(cached).toHaveProperty('components');
      expect(cached).toHaveProperty('reasoning');
      expect(cached).toHaveProperty('servedAt');
      expect(Array.isArray(cached?.components)).toBe(true);
      expect(cached?.components[0]).toHaveProperty('component');
      expect(cached?.components[0]).toHaveProperty('priority');
      expect(cached?.components[0]).toHaveProperty('propsOverrides');
      expect(cached?.components[0]).toHaveProperty('reasoning');
      expect(cached?.components[0]).toHaveProperty('score');
    });
  });

  describe('Decision Cache Key Tracking', () => {
    it('should track cached surfaces per device for O(1) invalidation', async () => {
      await featureStore.save(profile);

      const decision = {
        components: [{ component: 'HeroBanner', priority: 1, propsOverrides: {}, score: 1, reasoning: 'test' }],
        reasoning: { intent: 'browse', confidence: 0.5, factors: [], modelVersion: 'rules-v1' },
        cacheKey: `decision:${deviceId}:${surface}`,
        servedAt: new Date().toISOString(),
      };
      await featureStore.cacheDecision(deviceId, surface, decision, 300);

      const surfacesSetKey = `${KEY_NS}decision-surfaces:${deviceId}`;
      const surfaces = mockSetStore.get(surfacesSetKey);
      expect(surfaces).toBeDefined();
      expect(surfaces?.has(surface)).toBe(true);
    });
  });
});
