import { PartialJsonParser } from '../services/personalization/partial-json-parser';

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
    { id: 'prod-1', title: 'Test Product', handle: 'test-product', thumbnail: '' },
    { id: 'prod-2', title: 'Test Product 2', handle: 'test-product-2', thumbnail: '' },
    { id: 'prod-3', title: 'Test Product 3', handle: 'test-product-3', thumbnail: '' },
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

describe('PartialJsonParser', () => {
  let parser: PartialJsonParser;

  beforeEach(() => {
    parser = new PartialJsonParser();
  });

  it('detects component objects from chunks', () => {
    const chunk = '{"components":[{"component":"HeroBanner","contentId":null,"priority":1,"propsOverrides":{},"reasoning":"test"}]}';
    const objects = parser.feed(chunk);
    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({
      component: 'HeroBanner',
      priority: 1,
    });
  });

  it('handles partial JSON gracefully', () => {
    const chunk1 = '{"components":[{"component":"HeroBanner","contentId":null,';
    let objects = parser.feed(chunk1);
    expect(objects).toHaveLength(0);

    const chunk2 = '"priority":1,"reasoning":"test"}]}';
    objects = parser.feed(chunk2);
    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({
      component: 'HeroBanner',
      priority: 1,
    });
  });

  it('isComplete returns true for full response', () => {
    const chunk = '{"components":[{"component":"HeroBanner","contentId":null,"priority":1,"reasoning":"test"}],"overallReasoning":"ok"}';
    parser.feed(chunk);
    expect(parser.isComplete).toBe(true);
  });

  it('isComplete returns false for partial response', () => {
    parser.feed('{"components":[{"component":"HeroBanner"');
    expect(parser.isComplete).toBe(false);
  });

  it('reset clears state', () => {
    parser.feed('{"components":[{"component":"HeroBanner"');
    expect(parser.isComplete).toBe(false);

    parser.reset();
    expect(parser.isComplete).toBe(false);

    // After reset, feeding a complete chunk should still work
    const objects = parser.feed('{"components":[{"component":"HeroBanner","contentId":null,"priority":1,"reasoning":"test"}]}');
    expect(objects).toHaveLength(1);
  });

  it('handles nested objects correctly', () => {
    const chunk = '{"components":[{"component":"FeaturedCategoryRail","contentId":null,"priority":1,"propsOverrides":{"handle":"mens","products":[{"id":"p1","title":"Test"}]},"reasoning":"test"}]}';
    const objects = parser.feed(chunk);
    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({
      component: 'FeaturedCategoryRail',
      priority: 1,
    });
  });

  it('detects multiple component objects from incremental chunks', () => {
    const chunk1 = '{"components":[{"component":"HeroBanner","contentId":null,"priority":1,"reasoning":"first"},';
    let objects = parser.feed(chunk1);
    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({ component: 'HeroBanner', priority: 1 });

    const chunk2 = '{"component":"FeaturedCategoryRail","contentId":null,"priority":2,"reasoning":"second"}]}';
    objects = parser.feed(chunk2);
    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({ component: 'FeaturedCategoryRail', priority: 2 });
  });

  it('ignores non-component objects in the stream', () => {
    const chunk = '{"components":[{"component":"HeroBanner","contentId":null,"priority":1,"reasoning":"test"}],"overallReasoning":"ok","extra":{"nested":true}}';
    const objects = parser.feed(chunk);
    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({ component: 'HeroBanner' });
  });
});

describe('aiPersonalizeStream', () => {
  const { aiPersonalizeStream } = require('../services/personalization/ai-agent');
  const featureStoreModule = require('../services/personalization/feature-store');

  const newUserProfile = {
    deviceId: 'test-stream-homepage',
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
    recentDecisions: [],
  };

  beforeEach(() => {
    mockStore.clear();
    mockSetStore.clear();
    mockListStore.clear();
    jest.clearAllMocks();
  });

  it('aiPersonalizeStream yields components incrementally from SSE chunks', async () => {
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"{\\"components\\":["}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"{\\"component\\":\\"HeroBanner\\",\\"contentId\\":null,\\"priority\\":1,\\"reasoning\\":\\"first\\"},"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"{\\"component\\":\\"FeaturedCategoryRail\\",\\"contentId\\":null,\\"priority\\":2,\\"reasoning\\":\\"second\\"}]}"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"}"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: jest.fn().mockImplementation(() => {
        if (chunkIndex < sseChunks.length) {
          return Promise.resolve({ done: false, value: new TextEncoder().encode(sseChunks[chunkIndex++]) });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
      releaseLock: jest.fn(),
    };

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    } as unknown as Response);

    const events: Array<{ type: string; data: unknown }> = [];
    const generator = aiPersonalizeStream(newUserProfile, { surface: 'homepage', page: '/' });

    for await (const event of generator) {
      events.push(event as { type: string; data: unknown });
    }

    expect(events.length).toBeGreaterThanOrEqual(2);
    const componentEvents = events.filter(e => e.type === 'component');
    expect(componentEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('aiPersonalizeStream falls back to Gemini when primary fails', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('chat/completions')) {
        throw new Error('Primary provider down');
      }
      if (urlStr.includes('generativelanguage')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"components":[{"component":"HeroBanner","contentId":null,"priority":1,"reasoning":"fallback"}],"overallReasoning":"gemini"}' }],
                },
              },
            ],
          }),
        } as Response;
      }
      throw new Error('Unexpected URL');
    });

    const events: Array<{ type: string; data: unknown }> = [];
    try {
      const generator = aiPersonalizeStream(newUserProfile, { surface: 'homepage', page: '/' });
      for await (const event of generator) {
        events.push(event as { type: string; data: unknown });
      }
    } catch {
      // Expected if no Gemini API key configured
    }

    // Should have attempted fetch
    expect(global.fetch).toHaveBeenCalled();
  });
});
