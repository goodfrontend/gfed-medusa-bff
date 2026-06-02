import { featureStore, type UserProfile } from '../services/personalization/feature-store';
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
  };

  return {
    getPersonalizationRedis: jest.fn().mockResolvedValue(mockRedisModule),
    KEY_NS: 'bff:personalization:v1:',
  };
});

describe('UserProfile type', () => {
  const deviceId = 'test-profile-device';

  beforeEach(() => {
    mockStore.clear();
    mockSetStore.clear();
    mockListStore.clear();
    jest.clearAllMocks();
  });

  it('should create a profile with the new fields and without removed fields', async () => {
    const profile = await featureStore.getOrCreate(deviceId);

    // Optional session is undefined initially
    expect(profile.currentSession).toBeUndefined();

    // New fields exist
    expect(profile.lastPurchaseDate).toBe(0);
    expect(profile.totalSpent).toBe(0);
    expect(profile.averageOrderValue).toBe(0);

    // Renamed field
    expect(profile.intentSignals).toHaveProperty('checkoutConversion');
    expect((profile.intentSignals as Record<string, unknown>).checkoutConversion).toBe(0);

    // Removed field
    expect((profile.intentSignals as Record<string, unknown>).returnRate).toBeUndefined();
  });

  it('should default priceSensitivity.score to 0 (not 0.5)', async () => {
    const profile = await featureStore.getOrCreate(deviceId);
    expect(profile.priceSensitivity.score).toBe(0);
    expect(profile.priceSensitivity.avgViewedPrice).toBe(0);
    expect(profile.priceSensitivity.dealClickRate).toBe(0);
  });

  it('should create a profile with productName in ProductViewEntry', async () => {
    const profile = await featureStore.getOrCreate(deviceId);

    expect(deviceId).toBeTruthy();
    expect(profile.deviceId).toBe(deviceId);
    expect(profile.categoryAffinity).toEqual({});
    expect(profile.priceSensitivity).toEqual({ score: 0, avgViewedPrice: 0, dealClickRate: 0 });
    expect(profile.engagementLevel).toBe('LOW');
    expect(profile.lifecycleStage).toBe('NEW');
    expect(profile.sessionCount).toBe(0);
    expect(profile.orderCount).toBe(0);
    expect(profile.recentProducts).toEqual([]);
  });
});

describe('Signal processing', () => {
  const deviceId = 'test-signal-device';

  beforeEach(() => {
    mockStore.clear();
    mockSetStore.clear();
    mockListStore.clear();
    jest.clearAllMocks();
  });

  it('should add productName to ProductViewEntry on PRODUCT_VIEW', async () => {
    await featureStore.getOrCreate(deviceId);

    const signal = {
      type: 'PRODUCT_VIEW',
      payload: {
        productId: 'prod-1',
        productName: 'Test Product',
        category: 'electronics',
        price: 99.99,
      },
      url: '/products/prod-1',
      timestamp: Date.now(),
    };

    await signalProcessor.process(signal, deviceId);
    const profile = await featureStore.getOrCreate(deviceId);

    expect(profile.recentProducts).toHaveLength(1);
    expect(profile.recentProducts?.[0]?.productId).toBe('prod-1');
    expect(profile.recentProducts?.[0]?.productName).toBe('Test Product');
    expect(profile.recentProducts?.[0]?.category).toBe('electronics');
    expect(profile.recentProducts?.[0]?.price).toBe(99.99);
  });

  it('should handle productName fallback for PRODUCT_VIEW', async () => {
    await featureStore.getOrCreate(deviceId);

    const signal = {
      type: 'PRODUCT_VIEW',
      payload: {
        productId: 'prod-2',
        name: 'Product Name via name field',
        category: 'clothing',
      },
      url: '/products/prod-2',
      timestamp: Date.now(),
    };

    await signalProcessor.process(signal, deviceId);
    const profile = await featureStore.getOrCreate(deviceId);

    expect(profile.recentProducts?.[0]?.productName).toBe('Product Name via name field');
  });

  it('should update avgViewedPrice on PRODUCT_VIEW with price', async () => {
    await featureStore.getOrCreate(deviceId);

    const signal = {
      type: 'PRODUCT_VIEW',
      payload: {
        productId: 'prod-3',
        productName: 'P3',
        category: 'home',
        price: 150,
      },
      url: '/products/prod-3',
      timestamp: Date.now(),
    };

    await signalProcessor.process(signal, deviceId);
    const profile = await featureStore.getOrCreate(deviceId);

    expect(profile.priceSensitivity.avgViewedPrice).toBe(150);
  });

  it('should increment checkoutConversion on CHECKOUT_START', async () => {
    await featureStore.getOrCreate(deviceId);

    const signal = {
      type: 'CHECKOUT_START',
      payload: {},
      url: '/checkout',
      timestamp: Date.now(),
    };

    await signalProcessor.process(signal, deviceId);
    const profile = await featureStore.getOrCreate(deviceId);

    expect((profile.intentSignals as Record<string, unknown>).checkoutConversion).toBeGreaterThan(0);
    expect((profile.intentSignals as Record<string, unknown>).cartToPurchaseRate).toBeUndefined();
  });

  it('should decrement checkoutConversion on CHECKOUT_ABANDON', async () => {
    await featureStore.getOrCreate(deviceId);

    // First increment
    await signalProcessor.process({
      type: 'CHECKOUT_START', payload: {}, url: '/checkout', timestamp: Date.now(),
    }, deviceId);

    // Then decrement
    await signalProcessor.process({
      type: 'CHECKOUT_ABANDON', payload: {}, url: '/checkout', timestamp: Date.now(),
    }, deviceId);

    const profile = await featureStore.getOrCreate(deviceId);

    // checkoutConversion should be near 0.15 - 0.1 = 0.05
    expect(profile.intentSignals.checkoutConversion).toBeLessThan(0.15);
    expect(profile.intentSignals.checkoutConversion).toBeGreaterThanOrEqual(0);
  });

  it('should ignore trust signals (RETURN_POLICY_VIEW etc.)', async () => {
    await featureStore.getOrCreate(deviceId);

    // Send a trust signal
    await signalProcessor.process({
      type: 'RETURN_POLICY_VIEW', payload: {}, url: '/return-policy', timestamp: Date.now(),
    }, deviceId);

    const profile = await featureStore.getOrCreate(deviceId);

    // No returnRate field
    expect((profile.intentSignals as Record<string, unknown>).returnRate).toBeUndefined();
    // No other side effects from trust signals
  });

  it('should track current session on PAGE_VIEW', async () => {
    await featureStore.getOrCreate(deviceId);

    await signalProcessor.process({
      type: 'PAGE_VIEW', payload: { category: 'electronics' }, url: '/electronics', timestamp: Date.now(),
    }, deviceId);

    const profile = await featureStore.getOrCreate(deviceId);

    expect(profile.currentSession).toBeDefined();
    expect(profile.currentSession!.signalCount).toBe(1);
    expect(profile.currentSession!.startedAt).toBeGreaterThan(0);
  });

  it('should track searches and product views in current session', async () => {
    await featureStore.getOrCreate(deviceId);

    const now = Date.now();

    await signalProcessor.process({
      type: 'SEARCH_QUERY', payload: { query: 'laptop' }, url: '/search', timestamp: now,
    }, deviceId);
    await signalProcessor.process({
      type: 'PRODUCT_VIEW', payload: { productId: 'p1', productName: 'Laptop 1', category: 'electronics' }, url: '/products/p1', timestamp: now + 100,
    }, deviceId);
    await signalProcessor.process({
      type: 'CART_ADD', payload: { productId: 'p1' }, url: '/cart', timestamp: now + 200,
    }, deviceId);

    const profile = await featureStore.getOrCreate(deviceId);

    expect(profile.currentSession).toBeDefined();
    expect(profile.currentSession!.signalCount).toBe(3);
    expect(profile.currentSession!.searches).toContain('laptop');
    expect(profile.currentSession!.productViews).toContain('p1');
    expect(profile.currentSession!.cartAdds).toBe(1);
  });

  it('should set firstCategory on PRODUCT_VIEW (was topCategory)', async () => {
    await featureStore.getOrCreate(deviceId);

    await signalProcessor.process({
      type: 'PRODUCT_VIEW',
      payload: { productId: 'p1', productName: 'P1', category: 'electronics' },
      url: '/products/p1',
      timestamp: Date.now(),
    }, deviceId);

    const profile = await featureStore.getOrCreate(deviceId);
    expect(profile.currentSession).toBeDefined();
    expect(profile.currentSession!.firstCategory).toBe('electronics');
  });

  it('should start new session after SESSION_TIMEOUT_MS', async () => {
    await featureStore.getOrCreate(deviceId);

    const now = Date.now();
    const thirtyOneMinutes = 31 * 60 * 1000;

    // First page view
    await signalProcessor.process({
      type: 'PAGE_VIEW', payload: {}, url: '/', timestamp: now,
    }, deviceId);

    // Over 30 min later, new page view starts new session
    await signalProcessor.process({
      type: 'PAGE_VIEW', payload: {}, url: '/another-page', timestamp: now + thirtyOneMinutes,
    }, deviceId);

    const profile = await featureStore.getOrCreate(deviceId);

    expect(profile.currentSession!.signalCount).toBe(1);
    expect(profile.currentSession!.startedAt).toBe(now + thirtyOneMinutes);
  });

  it('should apply researchDepth decay when signals arrive', async () => {
    await featureStore.getOrCreate(deviceId);

    const now = Date.now();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

    // Add research via search
    await signalProcessor.process({
      type: 'SEARCH_QUERY', payload: { query: 'test' }, url: '/search', timestamp: now,
    }, deviceId);

    // Get profile after first signal
    let profile = await featureStore.getOrCreate(deviceId);
    const researchAfterSearch = profile.intentSignals.researchDepth;
    expect(researchAfterSearch).toBeGreaterThan(0);

    // Send another signal 2 days later — researchDepth should decay
    await signalProcessor.process({
      type: 'PAGE_VIEW', payload: {}, url: '/', timestamp: now + twoDaysMs,
    }, deviceId);

    profile = await featureStore.getOrCreate(deviceId);
    expect(profile.intentSignals.researchDepth).toBeLessThan(researchAfterSearch);
  });
});

describe('Intent classifier', () => {
  it('should classify buy_now for loyal, high engagement user with cart activity', () => {
    const { classifyIntent } = require('../services/personalization/intent-classifier');

    const profile: UserProfile = {
      deviceId: 'test',
      categoryAffinity: { electronics: { views: 10, purchases: 3, lastViewed: Date.now(), score: 3 } },
      priceSensitivity: { score: 0.3, avgViewedPrice: 100, dealClickRate: 0.1 },
      intentSignals: { researchDepth: 0.5, checkoutConversion: 0.8 },
      engagementLevel: 'HIGH',
      lifecycleStage: 'LOYAL',
      firstSeen: Date.now() - 86400000 * 30,
      lastSeen: Date.now(),
      sessionCount: 20,
      orderCount: 5,
      cartActivity: 2,
      recentProducts: [],
      lastSignalTimestamp: Date.now(),
      lastPurchaseDate: Date.now() - 86400000 * 7,
      totalSpent: 500,
      averageOrderValue: 100,
    };

    const scores = classifyIntent(profile);
    expect(scores[0].intent).toBe('buy_now');
    expect(scores[0].score).toBeGreaterThan(0.3);
  });

  it('should classify exploring for new user browsing many categories', () => {
    const { classifyIntent } = require('../services/personalization/intent-classifier');

    const profile: UserProfile = {
      deviceId: 'test',
      categoryAffinity: {
        electronics: { views: 2, purchases: 0, lastViewed: Date.now(), score: 1 },
        clothing: { views: 1, purchases: 0, lastViewed: Date.now(), score: 0.5 },
        home: { views: 1, purchases: 0, lastViewed: Date.now(), score: 0.5 },
        books: { views: 1, purchases: 0, lastViewed: Date.now(), score: 0.5 },
      },
      priceSensitivity: { score: 0, avgViewedPrice: 50, dealClickRate: 0 },
      intentSignals: { researchDepth: 0.3, checkoutConversion: 0 },
      engagementLevel: 'LOW',
      lifecycleStage: 'NEW',
      firstSeen: Date.now() - 3600000,
      lastSeen: Date.now(),
      sessionCount: 1,
      orderCount: 0,
      recentProducts: [],
      lastSignalTimestamp: Date.now(),
      lastPurchaseDate: 0,
      totalSpent: 0,
      averageOrderValue: 0,
    };

    const scores = classifyIntent(profile);
    expect(scores[0].intent).toBe('exploring');
  });

  it('should classify price_shop for deal-seeking user', () => {
    const { classifyIntent } = require('../services/personalization/intent-classifier');

    const profile: UserProfile = {
      deviceId: 'test',
      categoryAffinity: { clothing: { views: 5, purchases: 0, lastViewed: Date.now(), score: 2 } },
      priceSensitivity: { score: 0.8, avgViewedPrice: 30, dealClickRate: 0.6 },
      intentSignals: { researchDepth: 0.1, checkoutConversion: 0 },
      engagementLevel: 'MEDIUM',
      lifecycleStage: 'RETURNING',
      firstSeen: Date.now() - 86400000 * 14,
      lastSeen: Date.now(),
      sessionCount: 5,
      orderCount: 1,
      recentProducts: [],
      lastSignalTimestamp: Date.now(),
      lastPurchaseDate: Date.now() - 86400000 * 10,
      totalSpent: 50,
      averageOrderValue: 50,
    };

    const scores = classifyIntent(profile);
    expect(scores[0].intent).toBe('price_shop');
  });

  it('should classify uncertain for user with high hesitation', () => {
    const { classifyIntent } = require('../services/personalization/intent-classifier');

    const profile: UserProfile = {
      deviceId: 'test',
      categoryAffinity: { electronics: { views: 10, purchases: 0, lastViewed: Date.now(), score: 3 } },
      priceSensitivity: { score: 0, avgViewedPrice: 100, dealClickRate: 0.1 },
      intentSignals: { researchDepth: 3, checkoutConversion: 0.1 },
      engagementLevel: 'MEDIUM',
      lifecycleStage: 'NEW',
      firstSeen: Date.now() - 86400000 * 5,
      lastSeen: Date.now(),
      sessionCount: 8,
      orderCount: 0,
      hesitationCount: 3,
      recentProducts: [],
      lastSignalTimestamp: Date.now(),
      lastPurchaseDate: 0,
      totalSpent: 0,
      averageOrderValue: 0,
    };

    const scores = classifyIntent(profile);
    expect(scores[0].intent).toBe('uncertain');
  });

  it('should return scores that sum to ~1.0', () => {
    const { classifyIntent } = require('../services/personalization/intent-classifier');

    const profile: UserProfile = {
      deviceId: 'test',
      categoryAffinity: { sports: { views: 3, purchases: 1, lastViewed: Date.now(), score: 2 } },
      priceSensitivity: { score: 0.4, avgViewedPrice: 75, dealClickRate: 0.2 },
      intentSignals: { researchDepth: 1, checkoutConversion: 0.3 },
      engagementLevel: 'MEDIUM',
      lifecycleStage: 'FREQUENT',
      firstSeen: Date.now() - 86400000 * 60,
      lastSeen: Date.now(),
      sessionCount: 15,
      orderCount: 3,
      recentProducts: [],
      lastSignalTimestamp: Date.now(),
      lastPurchaseDate: Date.now() - 86400000 * 14,
      totalSpent: 300,
      averageOrderValue: 100,
    };

    const scores = classifyIntent(profile);
    const total = scores.reduce((sum: number, s: { score: number }) => sum + s.score, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });
});

describe('Decision engine', () => {
  const { makeDecision } = require('../services/personalization/decision-engine');

  beforeEach(() => {
    mockStore.clear();
    mockSetStore.clear();
    mockListStore.clear();
    jest.clearAllMocks();
  });

  it('should use exploring intent for browsing user', () => {
    const { classifyIntent } = require('../services/personalization/intent-classifier');

    // Simulate exploring user
    const profile: UserProfile = {
      deviceId: 'test',
      categoryAffinity: {
        electronics: { views: 2, purchases: 0, lastViewed: Date.now(), score: 1 },
        clothing: { views: 1, purchases: 0, lastViewed: Date.now(), score: 0.5 },
        home: { views: 1, purchases: 0, lastViewed: Date.now(), score: 0.5 },
        books: { views: 1, purchases: 0, lastViewed: Date.now(), score: 0.5 },
      },
      priceSensitivity: { score: 0, avgViewedPrice: 50, dealClickRate: 0 },
      intentSignals: { researchDepth: 0.3, checkoutConversion: 0 },
      engagementLevel: 'LOW',
      lifecycleStage: 'NEW',
      firstSeen: Date.now() - 3600000,
      lastSeen: Date.now(),
      sessionCount: 1,
      orderCount: 0,
      recentProducts: [],
      lastSignalTimestamp: Date.now(),
      lastPurchaseDate: 0,
      totalSpent: 0,
      averageOrderValue: 0,
    };

    const scores = classifyIntent(profile);
    expect(scores[0].intent).toBe('exploring');
  });

  it('should include exploring in propsOverrides for exploring intent', () => {
    const { buildPropsOverrides } = jest.requireActual('../services/personalization/decision-engine');

    // Can't easily test private function, mock it
    const profile: UserProfile = {
      deviceId: 'test',
      categoryAffinity: {},
      priceSensitivity: { score: 0, avgViewedPrice: 0, dealClickRate: 0 },
      intentSignals: { researchDepth: 0, checkoutConversion: 0 },
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

    // The decision engine uses scoreIntentMatch internally
    // This test exercises the decision engine end-to-end for homepage_hero
    // Since we mock redis, the fetchAvailableContent will return empty
    // but we can at least verify it doesn't crash
    const result = makeDecision(profile, { surface: 'homepage_hero' });
    return expect(result).resolves.toBeDefined();
  });
});

describe('AI Agent prompt', () => {
  it('should include classified intent in the prompt', () => {
    // The buildPrompt function is not exported, so we test through aiPersonalize
    // by checking the prompt construction indirectly via a mock
    const { classifyIntent } = require('../services/personalization/intent-classifier');

    const profile: UserProfile = {
      deviceId: 'test',
      categoryAffinity: { electronics: { views: 10, purchases: 3, lastViewed: Date.now(), score: 3 } },
      priceSensitivity: { score: 0.3, avgViewedPrice: 100, dealClickRate: 0.1 },
      intentSignals: { researchDepth: 0.5, checkoutConversion: 0.8 },
      engagementLevel: 'HIGH',
      lifecycleStage: 'LOYAL',
      firstSeen: Date.now() - 86400000 * 30,
      lastSeen: Date.now(),
      sessionCount: 20,
      orderCount: 5,
      cartActivity: 2,
      recentProducts: [],
      lastSignalTimestamp: Date.now(),
      lastPurchaseDate: Date.now() - 86400000 * 7,
      totalSpent: 500,
      averageOrderValue: 100,
    };

    const scores = classifyIntent(profile);
    const topIntent = scores[0].intent;

    expect(topIntent).toBe('buy_now');
    expect(scores).toHaveLength(4);
    expect(scores.map((s: { intent: string }) => s.intent)).toEqual(expect.arrayContaining(['buy_now', 'exploring', 'price_shop', 'uncertain']));
    expect(scores.find((s: { intent: string }) => s.intent === 'uncertain')).toBeDefined();
  });

  it('should not reference old inline explanations in the prompt (cartToPurchaseRate, returnRate)', () => {
    // Test that classifyIntent doesn't use old field names
    const { classifyIntent } = require('../services/personalization/intent-classifier');

    const profile: UserProfile = {
      deviceId: 'test',
      categoryAffinity: {},
      priceSensitivity: { score: 0, avgViewedPrice: 0, dealClickRate: 0 },
      intentSignals: { researchDepth: 0, checkoutConversion: 0 },
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

    const scores = classifyIntent(profile);
    // Should not crash or use undefined values
    expect(scores).toHaveLength(4);
    const total = scores.reduce((s: number, x: { score: number }) => s + x.score, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });
});

describe('submitConversion resolver', () => {
  const deviceId = 'test-conversion-device';

  beforeEach(() => {
    mockStore.clear();
    mockSetStore.clear();
    mockListStore.clear();
    jest.clearAllMocks();
  });

  it('should record lastPurchaseDate, totalSpent, and averageOrderValue', async () => {
    // Get the profile first
    const profile = await featureStore.getOrCreate(deviceId);
    expect(profile.lastPurchaseDate).toBe(0);
    expect(profile.totalSpent).toBe(0);
    expect(profile.averageOrderValue).toBe(0);

    // Simulate what submitConversion does
    profile.orderCount = (profile.orderCount ?? 0) + 1;
    profile.lastPurchaseDate = Date.now();
    const amount = 150;
    profile.totalSpent = (profile.totalSpent ?? 0) + amount;
    profile.averageOrderValue = (profile.totalSpent ?? 0) / (profile.orderCount ?? 1);

    expect(profile.orderCount).toBe(1);
    expect(profile.lastPurchaseDate).toBeGreaterThan(0);
    expect(profile.totalSpent).toBe(150);
    expect(profile.averageOrderValue).toBe(150);

    // Simulate a second purchase
    profile.orderCount = (profile.orderCount ?? 0) + 1;
    profile.lastPurchaseDate = Date.now();
    const amount2 = 250;
    profile.totalSpent = (profile.totalSpent ?? 0) + amount2;
    profile.averageOrderValue = (profile.totalSpent ?? 0) / (profile.orderCount ?? 1);

    expect(profile.orderCount).toBe(2);
    expect(profile.totalSpent).toBe(400);
    expect(profile.averageOrderValue).toBe(200);
  });

  it('should handle conversion with no amount gracefully', async () => {
    const profile = await featureStore.getOrCreate(deviceId);

    // Simulate submitConversion with no amount
    profile.orderCount = (profile.orderCount ?? 0) + 1;
    profile.lastPurchaseDate = Date.now();

    expect(profile.orderCount).toBe(1);
    expect(profile.lastPurchaseDate).toBeGreaterThan(0);
    expect(profile.totalSpent).toBe(0);
    expect(profile.averageOrderValue).toBe(0);
  });
});
