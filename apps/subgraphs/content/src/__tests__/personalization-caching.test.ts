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
      ks.forEach((k) => mockStore.delete(k));
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
  };

  return {
    getPersonalizationRedis: jest.fn().mockResolvedValue(mockRedisModule),
    KEY_NS: 'bff:personalization:v1:',
  };
});

describe('Personalization Signal Processing', () => {
  const deviceId = 'test-device-123';
  let profile: UserProfile;

  beforeEach(() => {
    mockStore.clear();
    mockSetStore.clear();
    mockListStore.clear();
    jest.clearAllMocks();
    profile = {
      deviceId,
      categoryAffinity: {},
      priceSensitivity: { score: 0, avgViewedPrice: 0, dealClickRate: 0 },
      intentSignals: { researchDepth: 0, checkoutConversion: 0 },
      engagementLevel: 'LOW',
      lifecycleStage: 'NEW',
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      sessionCount: 1,
      orderCount: 0,
      recentProducts: [],
      lastSignalTimestamp: 0,
      lastPurchaseDate: 0,
      totalSpent: 0,
      averageOrderValue: 0,
    };
  });

  it('should process a signal without throwing when profile exists', async () => {
    await featureStore.save(profile);

    const signal = {
      type: 'PAGE_VIEW',
      payload: {},
      url: '/test',
      timestamp: Date.now(),
    };
    mockStore.set(`${KEY_NS}profile:${deviceId}`, JSON.stringify(profile));

    await expect(signalProcessor.process(signal, deviceId)).resolves.toBe(true);
  });
});
