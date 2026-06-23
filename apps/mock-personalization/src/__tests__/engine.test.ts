import { describe, it, expect } from 'vitest';
import { classifyIntent } from '../engine/intent.js';
import { makeMockDecision } from '../engine/decision.js';
import type { UserProfile } from '../types/profile.js';
import type { PersonalizeRequest } from '../types/personalization.js';

// ──────────────────────────────────────────────
// Intent Classifier Tests
// ──────────────────────────────────────────────

describe('classifyIntent', () => {
  function makeEmptyProfile(): UserProfile {
    return {
      deviceId: 'test-device',
      categoryAffinity: {},
      priceSensitivity: { score: 0, avgViewedPrice: 0, dealClickRate: 0 },
      intentSignals: { researchDepth: 0, checkoutConversion: 0 },
      engagementLevel: 'LOW',
      lifecycleStage: 'NEW',
      firstSeen: 0,
      lastSeen: 0,
      sessionCount: 0,
      orderCount: 0,
      searchHistory: [],
      cartActivity: 0,
      hesitationCount: 0,
      recentProducts: [],
      lastSignalTimestamp: 0,
    };
  }

  it('high checkoutConversion + cartActivity → buy_now is top intent', () => {
    const profile = makeEmptyProfile();
    profile.intentSignals.checkoutConversion = 0.8;
    profile.cartActivity = 5;
    profile.engagementLevel = 'HIGH';

    const scores = classifyIntent(profile);
    expect(scores[0]!.intent).toBe('buy_now');
  });

  it('many categories + high researchDepth → exploring is top intent', () => {
    const profile = makeEmptyProfile();
    profile.intentSignals.researchDepth = 4;
    profile.categoryAffinity = {
      electronics: { views: 2, purchases: 0, lastViewed: 1000, score: 0.5 },
      clothing: { views: 1, purchases: 0, lastViewed: 1000, score: 0.3 },
      books: { views: 1, purchases: 0, lastViewed: 1000, score: 0.2 },
      home: { views: 1, purchases: 0, lastViewed: 1000, score: 0.1 },
    };
    profile.lifecycleStage = 'NEW';

    const scores = classifyIntent(profile);
    expect(scores[0]!.intent).toBe('exploring');
  });

  it('high dealClickRate + priceSensitivity → price_shop is top intent', () => {
    const profile = makeEmptyProfile();
    profile.priceSensitivity.dealClickRate = 0.8;
    profile.priceSensitivity.score = 0.7;

    const scores = classifyIntent(profile);
    expect(scores[0]!.intent).toBe('price_shop');
  });

  it('high hesitation + low views → uncertain is top intent', () => {
    const profile = makeEmptyProfile();
    profile.hesitationCount = 3;
    profile.intentSignals.researchDepth = 3;
    profile.intentSignals.checkoutConversion = 0;
    // totalViews <= 1 → profile has at most 1 category view total
    profile.categoryAffinity = {
      electronics: { views: 1, purchases: 0, lastViewed: 1000, score: 0.15 },
    };

    const scores = classifyIntent(profile);
    expect(scores[0]!.intent).toBe('uncertain');
  });

  it('empty profile classifies uncertain as top due to no signals', () => {
    const profile = makeEmptyProfile();
    const scores = classifyIntent(profile);

    expect(scores).toHaveLength(4);
    // Empty profile: uncertain gets +0.5 from the "totalViews <= 1 && checkoutConversion === 0" branch
    expect(scores[0]!.intent).toBe('uncertain');
    expect(scores[0]!.score).toBeGreaterThan(0);
    // All other intents have 0 raw score, so their normalized scores are 0
    expect(scores[1]!.score).toBe(0);
    expect(scores[2]!.score).toBe(0);
    expect(scores[3]!.score).toBe(0);
  });

  it('scores sum to approximately 1', () => {
    const profile = makeEmptyProfile();
    profile.intentSignals.checkoutConversion = 0.8;
    profile.cartActivity = 5;
    profile.engagementLevel = 'HIGH';
    profile.priceSensitivity.dealClickRate = 0.3;

    const scores = classifyIntent(profile);
    const total = scores.reduce((sum, s) => sum + s.score, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});

// ──────────────────────────────────────────────
// Decision Engine Tests
// ──────────────────────────────────────────────

describe('makeMockDecision', () => {
  function makeEmptyProfile(): UserProfile {
    return {
      deviceId: 'test-device',
      categoryAffinity: {},
      priceSensitivity: { score: 0, avgViewedPrice: 0, dealClickRate: 0 },
      intentSignals: { researchDepth: 0, checkoutConversion: 0 },
      engagementLevel: 'LOW',
      lifecycleStage: 'NEW',
      firstSeen: 0,
      lastSeen: 0,
      sessionCount: 0,
      orderCount: 0,
      searchHistory: [],
      cartActivity: 0,
      hesitationCount: 0,
      recentProducts: [],
      lastSignalTimestamp: 0,
    };
  }

  function makeRequest(overrides: Partial<PersonalizeRequest> = {}): PersonalizeRequest {
    return {
      deviceId: 'test-device',
      surface: 'home',
      page: '/',
      ...overrides,
    };
  }

  it('deterministic: same input produces same output', () => {
    const profile = makeEmptyProfile();
    profile.categoryAffinity = {
      electronics: { views: 5, purchases: 1, lastViewed: 1000, score: 1.0 },
    };
    profile.intentSignals.checkoutConversion = 0.5;
    profile.cartActivity = 3;

    const request = makeRequest({ deviceId: 'det-device' });

    const result1 = makeMockDecision(profile, request);
    const result2 = makeMockDecision(profile, request);

    // Components and reasoning should be identical
    expect(result1.components).toEqual(result2.components);
    expect(result1.reasoning).toEqual(result2.reasoning);
    expect(result1.cacheKey).toBe(result2.cacheKey);
  });

  it('cold start (empty profile) returns HeroBanner + FeaturedCategoryRail', () => {
    const profile = makeEmptyProfile();
    const request = makeRequest({ deviceId: 'cold-device' });

    const result = makeMockDecision(profile, request);

    expect(result.components).toHaveLength(2);
    expect(result.components[0]!.component).toBe('HeroBanner');
    expect(result.components[1]!.component).toBe('FeaturedCategoryRail');
    expect(result.reasoning.factors).toContain('Cold start — no profile data');
  });

  it('buy_now intent returns HeroBanner with buy-now CTA', () => {
    const profile = makeEmptyProfile();
    profile.intentSignals.checkoutConversion = 0.8;
    profile.cartActivity = 5;
    profile.engagementLevel = 'HIGH';
    profile.categoryAffinity = {
      electronics: { views: 5, purchases: 1, lastViewed: 1000, score: 1.0 },
    };

    const request = makeRequest({ deviceId: 'buy-now-device' });
    const result = makeMockDecision(profile, request);

    expect(result.reasoning.intent).toBe('buy_now');
    expect(result.components[0]!.component).toBe('HeroBanner');
    // buy_now HeroBanner should have purchase-focused headline/cta
    const props = result.components[0]!.propsOverrides as Record<string, unknown>;
    expect(props.headline).toBe('Ready to Checkout?');
    expect(props.cta).toBe('Complete Your Purchase');
  });

  it('exploring intent returns FeaturedCategoryRail as first component', () => {
    const profile = makeEmptyProfile();
    profile.intentSignals.researchDepth = 4;
    profile.lifecycleStage = 'NEW';
    profile.categoryAffinity = {
      electronics: { views: 2, purchases: 0, lastViewed: 1000, score: 0.5 },
      clothing: { views: 1, purchases: 0, lastViewed: 1000, score: 0.3 },
      books: { views: 1, purchases: 0, lastViewed: 1000, score: 0.2 },
      home: { views: 1, purchases: 0, lastViewed: 1000, score: 0.1 },
    };

    const request = makeRequest({ deviceId: 'exploring-device' });
    const result = makeMockDecision(profile, request);

    expect(result.reasoning.intent).toBe('exploring');
    expect(result.components[0]!.component).toBe('FeaturedCategoryRail');
  });

  it('price_shop intent returns PersonalizedBanner as first component', () => {
    const profile = makeEmptyProfile();
    // Add category data to prevent cold-start detection while keeping price_shop dominant
    profile.categoryAffinity = {
      electronics: { views: 2, purchases: 0, lastViewed: 1000, score: 0.5 },
    };
    profile.intentSignals.checkoutConversion = 0.05; // small — prevents uncertain catch-all without boosting buy_now
    profile.priceSensitivity.dealClickRate = 0.8;
    profile.priceSensitivity.score = 0.7;

    const request = makeRequest({ deviceId: 'price-shop-device' });
    const result = makeMockDecision(profile, request);

    expect(result.reasoning.intent).toBe('price_shop');
    expect(result.components[0]!.component).toBe('PersonalizedBanner');
  });

  it('uncertain intent returns PersonalizedBanner (reassurance) as first component', () => {
    const profile = makeEmptyProfile();
    profile.hesitationCount = 3;
    profile.intentSignals.researchDepth = 3;
    profile.intentSignals.checkoutConversion = 0;
    profile.categoryAffinity = {
      electronics: { views: 1, purchases: 0, lastViewed: 1000, score: 0.15 },
    };

    const request = makeRequest({ deviceId: 'uncertain-device' });
    const result = makeMockDecision(profile, request);

    expect(result.reasoning.intent).toBe('uncertain');
    expect(result.components[0]!.component).toBe('PersonalizedBanner');
  });

  it('cacheKey format: personalization:${deviceId}:${surface} (no v1 prefix)', () => {
    const profile = makeEmptyProfile();
    const request = makeRequest({ deviceId: 'cache-test', surface: 'product' });

    const result = makeMockDecision(profile, request);
    expect(result.cacheKey).toBe('personalization:cache-test:product');
  });

  it('requestId is generated and present', () => {
    const profile = makeEmptyProfile();
    const request = makeRequest({ deviceId: 'req-id-test' });

    const result = makeMockDecision(profile, request);
    expect(result.requestId).toBeDefined();
    expect(typeof result.requestId).toBe('string');
    expect(result.requestId.length).toBeGreaterThan(0);
  });

  it('cold start has uncertain as reasoning intent with 0 confidence', () => {
    const profile = makeEmptyProfile();
    const request = makeRequest({ deviceId: 'cold-reasoning' });

    const result = makeMockDecision(profile, request);

    expect(result.reasoning.intent).toBe('uncertain');
    expect(result.reasoning.confidence).toBe(0);
    expect(result.reasoning.modelVersion).toBe('mock-v0');
  });
});
