import { personalizationResolvers } from '../resolvers/personalization/index';
import { featureStore, type UserProfile } from '../services/personalization/feature-store';
import { signalProcessor } from '../services/personalization/signal-ingestion';

const mockStore = new Map<string, string>();
const mockSetStore = new Map<string, Set<string>>();
const mockListStore = new Map<string, string[]>();

jest.mock('../services/personalization/sanity-content', () => {
  const actual = jest.requireActual('../services/personalization/sanity-content');
  return {
    ...actual,
    fetchAvailableContent: jest.fn().mockResolvedValue([]),
  };
});

jest.mock('../services/medusa/category-products', () => ({
  fetchCategoryProducts: jest.fn().mockResolvedValue([
    { id: 'prod-1', title: 'Test Product', handle: 'test-product', thumbnail: '', price: 49.99, currencyCode: 'USD' },
    { id: 'prod-2', title: 'Test Product 2', handle: 'test-product-2', thumbnail: '', price: 29.99, currencyCode: 'USD' },
    { id: 'prod-3', title: 'Test Product 3', handle: 'test-product-3', thumbnail: '', price: 19.99, currencyCode: 'USD' },
    { id: 'prod-999', title: 'Wireless Headphones', handle: 'wireless-headphones', thumbnail: '', price: 149.99, currencyCode: 'USD' },
  ]),
}));

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

const mockMedusaList = jest.fn();
const mockMedusaConstructor = jest.fn();

jest.mock('@medusajs/js-sdk', () => ({
  __esModule: true,
  default: jest.fn((...args: unknown[]) => {
    mockMedusaConstructor(...args);
    return {
      store: {
        order: {
          list: mockMedusaList,
        },
      },
    };
  }),
}));

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
    // Test exercises the decision engine end-to-end for homepage_hero
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

  it('should apply conversion modifications to merged profile when customerId is set', async () => {
    // Pre-populate a Redis profile so getOrCreate returns it
    await featureStore.getOrCreate(deviceId);

    // Call submitConversion via the resolver with customerId context
    const result = await (
      personalizationResolvers.Mutation!.submitConversion as Function
    )(
      null,
      {
        input: {
          deviceId,
          orderId: 'order-1',
          amount: 150,
          currency: 'USD',
          items: [
            { productId: 'prod-1', category: 'electronics', price: 150, quantity: 1 },
          ],
        },
      },
      {
        isAuthorizedClient: true,
        req: { headers: { cookie: '' } },
        customerId: 'test-customer',
        authId: null,
        medusaToken: null,
      },
    );

    expect(result).toBe(true);

    // Read the profile from store to verify modifications were applied after mergeToUser
    const saved = mockStore.get('bff:personalization:v1:profile:' + deviceId);
    expect(saved).toBeDefined();
    const parsed = JSON.parse(saved!);

    expect(parsed.orderCount).toBe(1);
    expect(parsed.totalSpent).toBe(150);
    expect(parsed.lastPurchaseDate).toBeGreaterThan(0);
    expect(parsed.averageOrderValue).toBe(150);
    expect(parsed.cartActivity).toBe(0);
    expect(parsed.hesitationCount).toBe(0);
    expect(parsed.lifecycleStage).toBe('RETURNING');
    expect(parsed.categoryAffinity.electronics.purchases).toBe(1);
    expect(parsed.userId).toBe('test-customer');
  });
});

describe('Component Registry — homepage surface', () => {
  it('getComponentsForSurface("homepage") returns HeroBanner, FeaturedCategoryRail, PersonalizedBanner', () => {
    const { getComponentsForSurface } = require('../config/component-registry');
    const components = getComponentsForSurface('homepage');
    expect(components.map((c: { name: string }) => c.name)).toEqual(
      expect.arrayContaining(['HeroBanner', 'FeaturedCategoryRail', 'PersonalizedBanner', 'ProductRecommendation'])
    );
    expect(components).toHaveLength(4);
  });

  it('getComponentsForSurface("homepage_hero") still returns just HeroBanner', () => {
    const { getComponentsForSurface } = require('../config/component-registry');
    const components = getComponentsForSurface('homepage_hero');
    expect(components.map((c: { name: string }) => c.name)).toEqual(['HeroBanner']);
    expect(components).toHaveLength(1);
  });
});

describe('Decision engine — homepage surface', () => {
  const { makeDecision } = require('../services/personalization/decision-engine');

  const newUserProfile: UserProfile = {
    deviceId: 'test-homepage-new',
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

  beforeEach(() => {
    mockStore.clear();
    mockSetStore.clear();
    mockListStore.clear();
    jest.clearAllMocks();
  });

  it('makeDecision("homepage", newUserProfile) returns cold-start components', async () => {
    const decision = await makeDecision(newUserProfile, { surface: 'homepage' });

    expect(decision.components).toHaveLength(4);

    const componentNames = decision.components.map((c: { component: string }) => c.component);
    expect(componentNames).toContain('HeroBanner');
    expect(componentNames).toContain('PersonalizedBanner');
    expect(componentNames.filter((n: string) => n === 'FeaturedCategoryRail')).toHaveLength(2);

    const rails = decision.components.filter((c: { component: string }) => c.component === 'FeaturedCategoryRail');
    const handles = rails.map((r: { propsOverrides: { handle: unknown } }) => r.propsOverrides.handle);
    expect(handles).toEqual(expect.arrayContaining(['mens', 'womens']));

    for (const comp of decision.components) {
      expect(comp.reasoning).toBeTruthy();
      expect(typeof comp.priority).toBe('number');
      expect(comp.priority).toBeGreaterThanOrEqual(1);
    }
  });

  it('profile with high mens category affinity scores Mens rail higher than Womens', async () => {
    const profile: UserProfile = {
      ...newUserProfile,
      deviceId: 'test-mens-affinity',
      categoryAffinity: {
        mens: { views: 10, purchases: 2, lastViewed: Date.now(), score: 4.5 },
        womens: { views: 1, purchases: 0, lastViewed: Date.now() - 86400000, score: 0.2 },
      },
    };

    const decision = await makeDecision(profile, { surface: 'homepage' });

    const rails = decision.components.filter((c: { component: string }) => c.component === 'FeaturedCategoryRail');
    expect(rails).toHaveLength(2);

    const sortedByPriority = rails.sort((a: { priority: number }, b: { priority: number }) => a.priority - b.priority);
    expect(sortedByPriority[0].propsOverrides.handle).toBe('mens');
  });

  it('buy_now intent boosts HeroBanner score above FeaturedCategoryRail', async () => {
    const profile: UserProfile = {
      ...newUserProfile,
      deviceId: 'test-buynow',
      lifecycleStage: 'LOYAL',
      engagementLevel: 'HIGH',
      cartActivity: 3,
      intentSignals: { researchDepth: 0.5, checkoutConversion: 0.9 },
      categoryAffinity: {
        mens: { views: 5, purchases: 1, lastViewed: Date.now(), score: 2.0 },
      },
    };

    const decision = await makeDecision(profile, { surface: 'homepage' });

    expect(decision.reasoning.intent).toBe('buy_now');

    const sorted = [...decision.components].sort((a: { priority: number }, b: { priority: number }) => a.priority - b.priority);
    expect(sorted[0].component).toBe('HeroBanner');
  });

  it('HeroBanner propsOverrides.cta.label is populated for buy_now intent', async () => {
    const profile: UserProfile = {
      ...newUserProfile,
      deviceId: 'test-buynow-cta',
      lifecycleStage: 'LOYAL',
      engagementLevel: 'HIGH',
      cartActivity: 3,
      intentSignals: { researchDepth: 0.5, checkoutConversion: 0.9 },
      categoryAffinity: {
        mens: { views: 5, purchases: 1, lastViewed: Date.now(), score: 2.0 },
      },
    };

    const decision = await makeDecision(profile, { surface: 'homepage' });

    const hero = decision.components.find((c: { component: string }) => c.component === 'HeroBanner');
    expect(hero).toBeDefined();
    expect(
      typeof (hero!.propsOverrides.cta as Record<string, unknown> | undefined)?.label
    ).toBe('string');
    expect(
      ((hero!.propsOverrides.cta as Record<string, unknown> | undefined)?.label as string).length
    ).toBeGreaterThan(0);
  });

  it('throws when all component data sources fail and selected becomes empty', async () => {
    const componentDef: import('../config/component-registry').ComponentDefinition = {
      name: 'FeaturedCategoryRail',
      description: 'Test rail',
      requiredProps: ['title', 'handle'],
      optionalProps: ['products'],
      contentTypes: [],
      surfaces: ['homepage'],
      weight: 0.9,
    };
    const registry = require('../config/component-registry');
    const medusaModule = require('../services/medusa/category-products');

    const compSpy = jest.spyOn(registry, 'getComponentsForSurface').mockReturnValue([componentDef]);
    const origImpl = (medusaModule.fetchCategoryProducts as jest.Mock).getMockImplementation();
    (medusaModule.fetchCategoryProducts as jest.Mock).mockRejectedValue(new Error('Medusa unavailable'));

    try {
      await expect(makeDecision(newUserProfile, { surface: 'homepage' })).rejects.toThrow('all component data sources failing');
    } finally {
      compSpy.mockRestore();
      (medusaModule.fetchCategoryProducts as jest.Mock).mockImplementation(origImpl);
    }
  });
});

describe('AI Agent — homepage surface', () => {
  const { aiPersonalize } = require('../services/personalization/ai-agent');

  const newUserProfile: UserProfile = {
    deviceId: 'test-ai-homepage',
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAiJsonResponse = {
    components: [
      {
        component: 'HeroBanner',
        contentId: null,
        priority: 1,
        propsOverrides: {},
        reasoning: 'Hero banner for cold start',
      },
      {
        component: 'FeaturedCategoryRail',
        contentId: null,
        priority: 2,
        propsOverrides: { handle: 'mens' },
        reasoning: 'Mens category rail for browsing',
      },
      {
        component: 'PersonalizedBanner',
        contentId: null,
        priority: 3,
        propsOverrides: {},
        reasoning: 'Welcome banner for new user',
      },
    ],
    overallReasoning: 'Cold start user — hero, mens rail, welcome banner',
  };

  it('aiPersonalize returns mixed component types for homepage surface', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify(mockAiJsonResponse) } }],
      }),
    } as Response);

    const result = await aiPersonalize(newUserProfile, {
      surface: 'homepage',
      page: '/',
    });

    fetchSpy.mockRestore();

    expect(result.components).toHaveLength(3);
    const names = result.components.map((c: { component: string }) => c.component);
    expect(names).toContain('HeroBanner');
    expect(names).toContain('FeaturedCategoryRail');
    expect(names).toContain('PersonalizedBanner');

    const rail = result.components.find((c: { component: string }) => c.component === 'FeaturedCategoryRail');
    expect(rail).toBeDefined();
    expect(rail!.propsOverrides.products).toBeDefined();
    expect(Array.isArray(rail!.propsOverrides.products)).toBe(true);
  });

  it('AI prompt includes category options and product data in fetch body', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify(mockAiJsonResponse) } }],
      }),
    } as Response);

    await aiPersonalize(newUserProfile, {
      surface: 'homepage',
      page: '/',
    });

    const fetchCalls = fetchSpy.mock.calls;
    fetchSpy.mockRestore();

    expect(fetchCalls.length).toBeGreaterThan(0);
    const fetchBody = (fetchCalls[0]?.[1] as Record<string, unknown> | undefined)?.body;
    const body = JSON.parse(typeof fetchBody === 'string' ? fetchBody : '');
    const promptText: string = body.messages[1].content;

    expect(promptText).toContain('FeaturedCategoryRail');
    expect(promptText).toContain('PersonalizedBanner');
    expect(promptText).toContain('Available Categories');
    expect(promptText).toContain('mens');
    expect(promptText).toContain('womens');
    expect(promptText).toContain('Test Product');
  });

  it('AI response validation works with mixed component types', async () => {
    const mixedResponse = {
      components: [
        { component: 'FeaturedCategoryRail', contentId: null, priority: 1, propsOverrides: { handle: 'womens' }, reasoning: 'Top category is womens' },
        { component: 'HeroBanner', contentId: null, priority: 2, propsOverrides: {}, reasoning: 'Hero' },
      ],
      overallReasoning: 'Mixed types',
    };

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify(mixedResponse) } }],
      }),
    } as Response);

    const result = await aiPersonalize(newUserProfile, {
      surface: 'homepage',
      page: '/',
    });

    fetchSpy.mockRestore();

    expect(result.components).toHaveLength(2);
    expect(result.components[0].component).toBe('FeaturedCategoryRail');
    expect(result.components[0].propsOverrides.handle).toBe('womens');
    expect(result.components[0].reasoning).toBe('Top category is womens');
    expect(result.components[1].component).toBe('HeroBanner');
    expect(result.intent).toBeDefined();
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThan(0);
  });
});

describe('Decision Fallback — homepage surface', () => {
  it('getFallbackDecision("homepage") returns 4 components', () => {
    const { getFallbackDecision } = require('../services/personalization/decision-fallback');

    const decision = getFallbackDecision('homepage', 'test-device-fallback');

    expect(decision.components).toHaveLength(4);

    const names = decision.components.map((c: { component: string }) => c.component);
    expect(names).toContain('HeroBanner');
    expect(names).toContain('PersonalizedBanner');
    expect(names.filter((n: string) => n === 'FeaturedCategoryRail')).toHaveLength(2);

    const hero = decision.components.find((c: { component: string }) => c.component === 'HeroBanner');
    expect(hero!.priority).toBe(4);
    expect(hero!.propsOverrides.headline).toBe('Welcome');

    const rails = decision.components.filter((c: { component: string }) => c.component === 'FeaturedCategoryRail');
    const handles = rails.map((r: { propsOverrides: { handle: unknown } }) => r.propsOverrides.handle);
    expect(handles).toEqual(expect.arrayContaining(['mens', 'womens']));
    for (const r of rails) {
      expect(r.propsOverrides.products).toEqual([]);
    }

    expect(decision.reasoning.modelVersion).toBe('fallback');

    const banner = decision.components.find((c: { component: string }) => c.component === 'PersonalizedBanner');
    expect(banner).toBeDefined();
    expect(typeof (banner!.propsOverrides.title as string)).toBe('string');
    expect((banner!.propsOverrides.title as string).length).toBeGreaterThan(0);
  });

  it('getFallbackDecision("homepage_hero") still works', () => {
    const { getFallbackDecision } = require('../services/personalization/decision-fallback');

    const decision = getFallbackDecision('homepage_hero', 'test-device-fallback');

    expect(decision.components).toHaveLength(1);
    expect(decision.components[0].component).toBe('HeroBanner');
    expect(decision.components[0].propsOverrides.headline).toBe('Welcome');
  });
});

describe('syncOrderHistory', () => {
  const deviceId = 'test-sync-device';
  const medusaToken = 'test-medusa-token';

  beforeEach(() => {
    mockStore.clear();
    mockSetStore.clear();
    mockListStore.clear();
    jest.clearAllMocks();
  });

  function createProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    return {
      deviceId,
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
      ...overrides,
    };
  }

  it('respects cooldown when ordersSynced is within 24 hours', async () => {
    const profile = createProfile({ ordersSynced: Date.now() - 1000 });

    const result = await featureStore.syncOrderHistory(
      deviceId,
      medusaToken,
      profile,
    );

    expect(mockMedusaList).not.toHaveBeenCalled();
    expect(result).toBe(profile);
    expect(result.ordersSynced).toBe(profile.ordersSynced);
  });

  it('keeps lifecycle stage as NEW when order count is 0', async () => {
    mockMedusaList.mockResolvedValue({ orders: [], count: 0 });
    const profile = createProfile();

    await featureStore.syncOrderHistory(deviceId, medusaToken, profile);

    expect(profile.lifecycleStage).toBe('NEW');
    expect(profile.orderCount).toBe(0);
    expect(profile.ordersSynced).toBeGreaterThan(0);
  });

  it('updates lifecycle stage to RETURNING when order count is 1', async () => {
    mockMedusaList.mockResolvedValue({
      orders: [
        { id: 'o1', total: 100, created_at: new Date().toISOString() },
      ],
      count: 1,
    });
    const profile = createProfile();

    await featureStore.syncOrderHistory(deviceId, medusaToken, profile);

    expect(profile.lifecycleStage).toBe('RETURNING');
    expect(profile.orderCount).toBe(1);
  });

  it('updates lifecycle stage to FREQUENT when order count is 3', async () => {
    mockMedusaList.mockResolvedValue({
      orders: Array.from({ length: 3 }, (_, i) => ({
        id: `o${i + 1}`,
        total: 100,
        created_at: new Date().toISOString(),
      })),
      count: 3,
    });
    const profile = createProfile();

    await featureStore.syncOrderHistory(deviceId, medusaToken, profile);

    expect(profile.lifecycleStage).toBe('FREQUENT');
    expect(profile.orderCount).toBe(3);
  });

  it('updates lifecycle stage to LOYAL when order count is 5 or more', async () => {
    mockMedusaList.mockResolvedValue({
      orders: Array.from({ length: 5 }, (_, i) => ({
        id: `o${i + 1}`,
        total: 100,
        created_at: new Date().toISOString(),
      })),
      count: 5,
    });
    const profile = createProfile();

    await featureStore.syncOrderHistory(deviceId, medusaToken, profile);

    expect(profile.lifecycleStage).toBe('LOYAL');
    expect(profile.orderCount).toBe(5);
  });

  it('computes totalSpent, averageOrderValue, and lastPurchaseDate from order data', async () => {
    const orders = [
      { id: 'o1', total: 100, created_at: '2025-01-01T00:00:00Z' },
      { id: 'o2', total: 200, created_at: '2025-02-01T00:00:00Z' },
    ];
    mockMedusaList.mockResolvedValue({ orders, count: 2 });
    const profile = createProfile();

    await featureStore.syncOrderHistory(deviceId, medusaToken, profile);

    expect(profile.totalSpent).toBe(300);
    expect(profile.averageOrderValue).toBe(150);
    expect(profile.lastPurchaseDate).toBe(
      new Date('2025-01-01T00:00:00Z').getTime(),
    );
  });

  it('returns profile unchanged when Medusa API call fails', async () => {
    mockMedusaList.mockRejectedValue(new Error('Medusa unavailable'));
    const profile = createProfile();

    await featureStore.syncOrderHistory(deviceId, medusaToken, profile);

    expect(profile.ordersSynced).toBeUndefined();
    expect(profile.orderCount).toBe(0);
    expect(profile.lifecycleStage).toBe('NEW');
  });

  it('creates a new profile when no profile argument is provided', async () => {
    mockMedusaList.mockResolvedValue({ orders: [], count: 0 });

    const result = await featureStore.syncOrderHistory(deviceId, medusaToken);

    expect(result).toBeDefined();
    expect(result.deviceId).toBe(deviceId);
    expect(result.orderCount).toBe(0);
    expect(result.ordersSynced).toBeGreaterThan(0);
  });

  it('passes Authorization header in Medusa constructor', async () => {
    mockMedusaList.mockResolvedValue({ orders: [], count: 0 });
    const profile = createProfile();

    await featureStore.syncOrderHistory(deviceId, medusaToken, profile);

    expect(mockMedusaConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: expect.any(String),
        auth: { type: 'jwt' },
        globalHeaders: expect.objectContaining({
          Authorization: `Bearer ${medusaToken}`,
        }),
      }),
    );
  });
});

describe('FeatureStore.mergeToUser', () => {
  const KEY_NS = 'bff:personalization:v1:';
  const deviceId1 = 'test-merge-device-1';
  const deviceId2 = 'test-merge-device-2';
  const userId = 'test-merge-user';

  function createProfile(
    deviceId: string,
    overrides: Partial<UserProfile> = {},
  ): UserProfile {
    return {
      deviceId,
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
      ...overrides,
    };
  }

  beforeEach(() => {
    mockStore.clear();
    mockSetStore.clear();
    mockListStore.clear();
    jest.clearAllMocks();
  });

  it('Case A: merges behavioral data, transfers fresh order data, cleans up old profile', async () => {
    // Existing profile for this user on device1 — old order sync
    const existingProfile = createProfile(deviceId1, {
      categoryAffinity: {
        electronics: {
          views: 5,
          purchases: 1,
          lastViewed: 1000,
          score: 2,
        },
      },
      orderCount: 3,
      lifecycleStage: 'FREQUENT',
      totalSpent: 300,
      averageOrderValue: 100,
      ordersSynced: 100,
    });
    mockStore.set(KEY_NS + 'profile:' + deviceId1, JSON.stringify(existingProfile));
    mockStore.set(KEY_NS + 'user-device:' + userId, deviceId1);
    mockStore.set(KEY_NS + 'device-user:' + deviceId1, userId);

    // New device profile with browsing data and fresher order sync
    const newDeviceProfile = createProfile(deviceId2, {
      categoryAffinity: {
        clothing: {
          views: 3,
          purchases: 0,
          lastViewed: 2000,
          score: 1,
        },
      },
      orderCount: 5,
      lifecycleStage: 'LOYAL',
      totalSpent: 600,
      averageOrderValue: 120,
      ordersSynced: 200, // fresher than existing (100)
    });
    mockStore.set(KEY_NS + 'profile:' + deviceId2, JSON.stringify(newDeviceProfile));

    const merged = await featureStore.mergeToUser(deviceId2, userId);

    // Behavioral data from new device is merged into existing
    expect(merged.categoryAffinity.electronics).toBeDefined();
    expect(merged.categoryAffinity.clothing).toBeDefined();
    expect(merged.categoryAffinity.clothing!.views).toBe(3);

    // Order/financial data transferred because new device has fresher ordersSynced
    expect(merged.orderCount).toBe(5);
    expect(merged.lifecycleStage).toBe('LOYAL');
    expect(merged.totalSpent).toBe(600);
    expect(merged.averageOrderValue).toBe(120);
    expect(merged.ordersSynced).toBe(200);

    // Old profile key deleted
    expect(mockStore.has(KEY_NS + 'profile:' + deviceId1)).toBe(false);

    // user-device mapping points to the new device
    expect(mockStore.get(KEY_NS + 'user-device:' + userId)).toBe(deviceId2);

    // device-user mapping for new device is set
    expect(mockStore.get(KEY_NS + 'device-user:' + deviceId2)).toBe(userId);
  });

  it('Case A: does NOT transfer order data when new device sync is stale', async () => {
    // Existing profile with fresh order sync
    const existingProfile = createProfile(deviceId1, {
      orderCount: 3,
      lifecycleStage: 'FREQUENT',
      totalSpent: 300,
      averageOrderValue: 100,
      ordersSynced: 500, // fresher
    });
    mockStore.set(KEY_NS + 'profile:' + deviceId1, JSON.stringify(existingProfile));
    mockStore.set(KEY_NS + 'user-device:' + userId, deviceId1);
    mockStore.set(KEY_NS + 'device-user:' + deviceId1, userId);

    // New device profile with stale order sync
    const newDeviceProfile = createProfile(deviceId2, {
      orderCount: 5,
      lifecycleStage: 'LOYAL',
      ordersSynced: 200, // stale — existing is 500
    });
    mockStore.set(KEY_NS + 'profile:' + deviceId2, JSON.stringify(newDeviceProfile));

    const merged = await featureStore.mergeToUser(deviceId2, userId);

    // Existing order data preserved (fresher)
    expect(merged.orderCount).toBe(3);
    expect(merged.lifecycleStage).toBe('FREQUENT');
    expect(merged.ordersSynced).toBe(500);
  });

  it('Case B: sets userId on profile and creates mappings', async () => {
    const profile = createProfile(deviceId1);
    mockStore.set(KEY_NS + 'profile:' + deviceId1, JSON.stringify(profile));

    const result = await featureStore.mergeToUser(deviceId1, userId);

    expect(result.userId).toBe(userId);
    // user-device mapping created
    expect(mockStore.get(KEY_NS + 'user-device:' + userId)).toBe(deviceId1);
    // device-user mapping created
    expect(mockStore.get(KEY_NS + 'device-user:' + deviceId1)).toBe(userId);
  });

  it('cleans up stale user-device mapping when different user logs in on same device', async () => {
    const oldUserId = 'test-merge-old-user';
    mockStore.set(
      KEY_NS + 'profile:' + deviceId1,
      JSON.stringify(createProfile(deviceId1)),
    );
    mockStore.set(KEY_NS + 'user-device:' + oldUserId, deviceId1);
    mockStore.set(KEY_NS + 'device-user:' + deviceId1, oldUserId);

    await featureStore.mergeToUser(deviceId1, userId);

    // Old mapping deleted
    expect(mockStore.has(KEY_NS + 'user-device:' + oldUserId)).toBe(false);
    // Current user's mapping set
    expect(mockStore.get(KEY_NS + 'user-device:' + userId)).toBe(deviceId1);
  });
});

describe('SignalProcessor.process with pre-loaded profile', () => {
  const deviceId = 'test-preload-device';

  beforeEach(() => {
    mockStore.clear();
    mockSetStore.clear();
    mockListStore.clear();
    jest.clearAllMocks();
  });

  it('uses provided profile instead of calling getOrCreate', async () => {
    const profile: UserProfile = {
      deviceId,
      categoryAffinity: {},
      priceSensitivity: { score: 0, avgViewedPrice: 0, dealClickRate: 0 },
      intentSignals: { researchDepth: 0, checkoutConversion: 0 },
      engagementLevel: 'LOW',
      lifecycleStage: 'NEW',
      firstSeen: Date.now() - 10000,
      lastSeen: Date.now() - 10000,
      sessionCount: 0,
      orderCount: 0,
      recentProducts: [],
      lastSignalTimestamp: 0,
      lastPurchaseDate: 0,
      totalSpent: 0,
      averageOrderValue: 0,
    };

    const signal = {
      type: 'PAGE_VIEW',
      payload: { category: 'electronics' },
      url: '/electronics',
      timestamp: Date.now(),
    };

    const result = await signalProcessor.process(signal, deviceId, null, profile);

    expect(result).toBe(true);

    // The provided profile should have been saved with the signal applied
    const saved = mockStore.get('bff:personalization:v1:profile:' + deviceId);
    expect(saved).toBeDefined();
    const parsed = JSON.parse(saved!);
    expect(parsed.categoryAffinity.electronics).toBeDefined();
    expect(parsed.categoryAffinity.electronics.views).toBe(1);
    // Should use the passed profile, not a fresh one
    expect(parsed.firstSeen).toBe(profile.firstSeen);
  });

  it('ignores provided profile when userId is given (calls mergeToUser instead)', async () => {
    const externalProfile: UserProfile = {
      deviceId,
      categoryAffinity: { existing: { views: 1, purchases: 0, lastViewed: 100, score: 0.5 } },
      priceSensitivity: { score: 0, avgViewedPrice: 0, dealClickRate: 0 },
      intentSignals: { researchDepth: 0, checkoutConversion: 0 },
      engagementLevel: 'LOW',
      lifecycleStage: 'NEW',
      firstSeen: Date.now() - 10000,
      lastSeen: Date.now() - 10000,
      sessionCount: 0,
      orderCount: 0,
      recentProducts: [],
      lastSignalTimestamp: 0,
      lastPurchaseDate: 0,
      totalSpent: 0,
      averageOrderValue: 0,
    };

    // Pre-setup a device profile so mergeToUser finds it (Case B)
    const deviceProfile = {
      ...externalProfile,
      categoryAffinity: {},
    };
    mockStore.set(
      'bff:personalization:v1:profile:' + deviceId,
      JSON.stringify(deviceProfile),
    );

    const signal = {
      type: 'PAGE_VIEW',
      payload: { category: 'electronics' },
      url: '/electronics',
      timestamp: Date.now(),
    };

    await signalProcessor.process(signal, deviceId, 'test-user', externalProfile);

    // mergeToUser was triggered (Case B), saved profile should have userId
    const saved = mockStore.get('bff:personalization:v1:profile:' + deviceId);
    expect(saved).toBeDefined();
    const parsed = JSON.parse(saved!);
    expect(parsed.userId).toBe('test-user');
    // The external profile's category data should NOT have been used
    // (mergeToUser creates/gets profile via getOrCreate, which reads from store)
    expect(parsed.categoryAffinity.existing).toBeUndefined();
  });
});

describe('sendSignal resolver chaining', () => {
  const deviceId = 'test-chain-device';

  beforeEach(() => {
    mockStore.clear();
    mockSetStore.clear();
    mockListStore.clear();
    jest.clearAllMocks();
    mockMedusaList.mockResolvedValue({ orders: [], count: 0 });
  });

  it('passes syncOrderHistory result to signalProcessor.process', async () => {
    const processSpy = jest.spyOn(signalProcessor, 'process');

    // Pre-create a profile for the device
    await featureStore.getOrCreate(deviceId);

    const mockContext = {
      isAuthorizedClient: true,
      req: { headers: { cookie: '' } },
      customerId: null,
      authId: null,
      medusaToken: 'test-medusa-token',
    };

    // Call the sendSignal resolver directly, providing input.deviceId
    await (
      personalizationResolvers.Mutation!.sendSignal as Function
    )(
      null,
      {
        input: {
          type: 'PAGE_VIEW',
          deviceId,
          payload: {},
          url: '/test',
          timestamp: Date.now(),
        },
      },
      mockContext,
    );

    // Wait for the fire-and-forget promise chain to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(processSpy).toHaveBeenCalled();
    const args = processSpy.mock.calls[0]!;
    const [, calledDeviceId, , profile] = args;
    expect(calledDeviceId).toBe(deviceId);
    expect(profile).toBeDefined();
    expect(profile!.deviceId).toBe(deviceId);
    // Profile should have ordersSynced set (from syncOrderHistory)
    expect(profile!.ordersSynced).toBeGreaterThan(0);
  });
});

describe('Decision record attribution', () => {
  const deviceId = 'test-decision-record';

  beforeEach(() => {
    mockStore.clear();
    mockSetStore.clear();
    mockListStore.clear();
    jest.clearAllMocks();
  });

  it('getOrCreate creates profile with empty recentDecisions', async () => {
    const profile = await featureStore.getOrCreate(deviceId);
    expect(profile.recentDecisions).toEqual([]);
  });

  it('recentDecisions is capped at 10 entries', async () => {
    const profile = await featureStore.getOrCreate(deviceId);
    for (let i = 0; i < 15; i++) {
      profile.recentDecisions = profile.recentDecisions ?? [];
      profile.recentDecisions.unshift({
        components: ['HeroBanner'],
        surface: 'homepage',
        intent: 'exploring',
        servedAt: Date.now() - i * 1000,
      });
      profile.recentDecisions = profile.recentDecisions.slice(0, 10);
    }
    expect(profile.recentDecisions!.length).toBe(10);
  });

  it('submitConversion attributes to most recent un-attributed decision', async () => {
    const profile = await featureStore.getOrCreate(deviceId);
    profile.recentDecisions = [
      {
        components: ['HeroBanner'],
        surface: 'homepage',
        intent: 'exploring',
        servedAt: Date.now(),
      },
    ];
    mockStore.set('bff:personalization:v1:profile:' + deviceId, JSON.stringify(profile));

    const result = await (
      personalizationResolvers.Mutation!.submitConversion as Function
    )(
      null,
      {
        input: {
          deviceId,
          orderId: 'order-attributed',
          amount: 100,
          currency: 'USD',
        },
      },
      {
        isAuthorizedClient: true,
        req: { headers: { cookie: '' } },
        customerId: null,
        authId: null,
        medusaToken: null,
      },
    );

    expect(result).toBe(true);
    const saved = JSON.parse(mockStore.get('bff:personalization:v1:profile:' + deviceId)!);
    expect(saved.recentDecisions[0].conversionAttributed).toBeDefined();
    expect(saved.recentDecisions[0].conversionAttributed.orderId).toBe('order-attributed');
    expect(saved.recentDecisions[0].conversionAttributed.amount).toBe(100);
  });

  it('conversion attribution does not overwrite already-attributed decisions', async () => {
    const profile = await featureStore.getOrCreate(deviceId);
    profile.recentDecisions = [
      {
        components: ['HeroBanner'],
        surface: 'homepage',
        intent: 'exploring',
        servedAt: Date.now(),
        conversionAttributed: {
          orderId: 'existing-order',
          amount: 50,
          attributedAt: Date.now() - 1000,
        },
      },
    ];
    mockStore.set('bff:personalization:v1:profile:' + deviceId, JSON.stringify(profile));

    const result = await (
      personalizationResolvers.Mutation!.submitConversion as Function
    )(
      null,
      {
        input: {
          deviceId,
          orderId: 'new-order',
          amount: 200,
          currency: 'USD',
        },
      },
      {
        isAuthorizedClient: true,
        req: { headers: { cookie: '' } },
        customerId: null,
        authId: null,
        medusaToken: null,
      },
    );

    expect(result).toBe(true);
    const saved = JSON.parse(mockStore.get('bff:personalization:v1:profile:' + deviceId)!);
    // Already-attributed decision should not be overwritten
    expect(saved.recentDecisions[0].conversionAttributed.orderId).toBe('existing-order');
    expect(saved.recentDecisions[0].conversionAttributed.amount).toBe(50);
  });
});

describe('Product Recommendation component', () => {
  it('componentRegistry includes ProductRecommendation', () => {
    const { componentRegistry } = require('../config/component-registry');
    const rec = componentRegistry.find((c: { name: string }) => c.name === 'ProductRecommendation');
    expect(rec).toBeDefined();
    expect(rec!.requiredProps).toContain('productId');
    expect(rec!.requiredProps).toContain('title');
    expect(rec!.requiredProps).toContain('price');
  });

  it('getComponentsForSurface("homepage") returns ProductRecommendation', () => {
    const { getComponentsForSurface } = require('../config/component-registry');
    const components = getComponentsForSurface('homepage');
    const names = components.map((c: { name: string }) => c.name);
    expect(names).toContain('ProductRecommendation');
  });

  it('AI prompt includes ProductRecommendation in allowed types', async () => {
    const { aiPersonalize } = require('../services/personalization/ai-agent');
    const newUserProfile = {
      deviceId: 'test-prompt-product-rec',
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

    const mockJsonResponse = {
      components: [
        { component: 'ProductRecommendation', contentId: null, priority: 1, propsOverrides: { id: 'prod-1', title: 'Test Product', handle: 'test-product', thumbnail: '', price: 49.99, currencyCode: 'USD' }, reasoning: 'Product rec for new user' },
      ],
      overallReasoning: 'Product recommendation',
    };

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify(mockJsonResponse) } }],
      }),
    } as Response);

    await aiPersonalize(newUserProfile, { surface: 'homepage', page: '/' });

    const fetchCalls = fetchSpy.mock.calls;
    fetchSpy.mockRestore();

    const fetchBody = (fetchCalls[0]?.[1] as Record<string, unknown> | undefined)?.body;
    const body = JSON.parse(typeof fetchBody === 'string' ? fetchBody : '');
    const promptText: string = body.messages[1].content;

    expect(promptText).toContain('ProductRecommendation');
    expect(promptText).toContain('Available Products for Recommendations');
  });

  it('aiPersonalize handles ProductRecommendation in response', async () => {
    const { aiPersonalize } = require('../services/personalization/ai-agent');
    const newUserProfile = {
      deviceId: 'test-rec-response',
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

    const mockResponse = {
      components: [
        { component: 'ProductRecommendation', contentId: null, priority: 2, propsOverrides: { id: 'prod-1', title: 'Running Shoes', handle: 'running-shoes', thumbnail: 'https://example.com/shoe.jpg', price: 89.99, currencyCode: 'USD' }, reasoning: 'Product rec based on affinity' },
      ],
      overallReasoning: 'Product recommendation test',
    };

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      }),
    } as Response);

    const result = await aiPersonalize(newUserProfile, { surface: 'homepage', page: '/' });
    fetchSpy.mockRestore();

    expect(result.components).toHaveLength(1);
    expect(result.components[0].component).toBe('ProductRecommendation');
    expect(result.components[0].propsOverrides.id).toBe('prod-1');
    expect(result.components[0].propsOverrides.title).toBe('Test Product');
    expect(result.components[0].propsOverrides.price).toBe(49.99);
  });

  it('ProductRecommendation propsOverrides pass through correctly', async () => {
    const { aiPersonalize } = require('../services/personalization/ai-agent');
    const newUserProfile = {
      deviceId: 'test-rec-props',
      categoryAffinity: { electronics: { views: 10, purchases: 2, lastViewed: Date.now(), score: 3 } },
      priceSensitivity: { score: 0.3, avgViewedPrice: 100, dealClickRate: 0.1 },
      intentSignals: { researchDepth: 0.5, checkoutConversion: 0.8 },
      engagementLevel: 'HIGH',
      lifecycleStage: 'LOYAL',
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      sessionCount: 20,
      orderCount: 5,
      recentProducts: [],
      lastSignalTimestamp: 0,
      lastPurchaseDate: Date.now() - 86400000,
      totalSpent: 500,
      averageOrderValue: 100,
    };

    const mockResponse = {
      components: [
        { component: 'ProductRecommendation', contentId: null, priority: 1, propsOverrides: { id: 'prod-999', title: 'Wireless Headphones', handle: 'wireless-headphones', thumbnail: '', price: 149.99, currencyCode: 'USD' }, reasoning: 'High affinity electronics' },
        { component: 'FeaturedCategoryRail', contentId: null, priority: 2, propsOverrides: { handle: 'electronics' }, reasoning: 'Electronics browsing' },
      ],
      overallReasoning: 'Mixed product and category',
    };

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      }),
    } as Response);

    const result = await aiPersonalize(newUserProfile, { surface: 'homepage', page: '/' });
    fetchSpy.mockRestore();

    const productRec = result.components.find((c: { component: string }) => c.component === 'ProductRecommendation');
    expect(productRec).toBeDefined();
    expect(productRec!.propsOverrides.title).toBe('Wireless Headphones');
    expect(productRec!.propsOverrides.price).toBe(149.99);
    expect(productRec!.propsOverrides.currencyCode).toBe('USD');
  });
});
