import type { UserProfile } from '../services/personalization/feature-store';
import { enrichProfileForAdk } from '../services/personalization/profile-enricher';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    deviceId: 'test-device',
    categoryAffinity: {},
    priceSensitivity: { score: 0, avgViewedPrice: 0, dealClickRate: 0 },
    intentSignals: { researchDepth: 0, checkoutConversion: 1 },
    engagementLevel: 'LOW',
    lifecycleStage: 'NEW',
    firstSeen: Date.now() - 86400000,
    lastSeen: Date.now(),
    sessionCount: 1,
    ...overrides,
  };
}

describe('enrichProfileForAdk', () => {
  it('promotes NEW profile with sessionCount=6, cartActivity=4 to RETURNING', () => {
    const profile = makeProfile({
      lifecycleStage: 'NEW',
      sessionCount: 6,
      cartActivity: 4,
    });

    const enriched = enrichProfileForAdk(profile);

    expect(enriched.behavioralLifecycle).toBe('RETURNING');
  });

  it('returns NEW for truly new user with sessionCount=2, cartActivity=0', () => {
    const profile = makeProfile({
      lifecycleStage: 'NEW',
      sessionCount: 2,
      cartActivity: 0,
    });

    const enriched = enrichProfileForAdk(profile);

    expect(enriched.behavioralLifecycle).toBe('NEW');
  });

  it('computes momentumScore > 0.5 for active session', () => {
    const profile = makeProfile({
      sessionCount: 10,
      firstSeen: Date.now() - 86400000 * 30, // 30 days ago
      currentSession: {
        startedAt: Date.now() - 600000, // 10 min ago
        signalCount: 20,
        searches: [],
        productViews: ['p1', 'p2', 'p3'],
        cartAdds: 2,
      },
    });

    const enriched = enrichProfileForAdk(profile);

    expect(enriched.momentumScore).toBeGreaterThan(0.5);
  });

  it('returns 0.5 for momentumScore when no currentSession', () => {
    const profile = makeProfile({
      sessionCount: 5,
      currentSession: undefined,
    });

    const enriched = enrichProfileForAdk(profile);

    expect(enriched.momentumScore).toBe(0.5);
  });

  it('computes low sessionQuality for bounce (signalCount=1, no product views)', () => {
    const profile = makeProfile({
      currentSession: {
        startedAt: Date.now() - 300000,
        signalCount: 1,
        searches: [],
        productViews: [],
        cartAdds: 0,
      },
    });

    const enriched = enrichProfileForAdk(profile);

    expect(enriched.sessionQuality).toBeLessThan(0.2);
  });

  it('computes high sessionQuality for deep browse (15 signals, 5 views, 2 cart adds)', () => {
    const profile = makeProfile({
      currentSession: {
        startedAt: Date.now() - 1200000,
        signalCount: 15,
        searches: ['shirt', 'pants'],
        productViews: ['p1', 'p2', 'p3', 'p4', 'p5'],
        cartAdds: 2,
      },
    });

    const enriched = enrichProfileForAdk(profile);

    expect(enriched.sessionQuality).toBeGreaterThanOrEqual(0.7);
  });

  it('computes hesitationScore = 0.5 for hesitationCount of 5', () => {
    const profile = makeProfile({
      hesitationCount: 5,
      intentSignals: { researchDepth: 3, checkoutConversion: 0.5 },
      sessionCount: 10,
    });

    const enriched = enrichProfileForAdk(profile);

    expect(enriched.hesitationScore).toBe(0.5);
  });

  it('detects couponUsageCount from searchHistory containing sale/coupon keywords', () => {
    const profile = makeProfile({
      searchHistory: [
        { query: 'summer sale dresses', timestamp: Date.now() },
        { query: 'shoes', timestamp: Date.now() },
        { query: 'coupon code 2026', timestamp: Date.now() },
        { query: 'discount furniture', timestamp: Date.now() },
      ],
    });

    const enriched = enrichProfileForAdk(profile);

    expect(
      enriched.priceSensitivity.enhanced.couponUsageCount
    ).toBeGreaterThanOrEqual(3);
  });

  it('uses dealClickRate as saleClickRatio in enhanced price sensitivity', () => {
    const profile = makeProfile({
      priceSensitivity: {
        score: 0.8,
        avgViewedPrice: 25,
        dealClickRate: 0.7,
      },
    });

    const enriched = enrichProfileForAdk(profile);

    expect(enriched.priceSensitivity.enhanced.saleClickRatio).toBe(0.7);
  });
});
