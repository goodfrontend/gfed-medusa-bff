import type { UserProfile } from './feature-store';

export interface AdkEnrichedProfile extends UserProfile {
  /** Behavioral lifecycle: promoted if sessionCount > 5 and cartActivity > 3 */
  behavioralLifecycle: 'NEW' | 'RETURNING' | 'FREQUENT' | 'LOYAL';
  /** Current session activity rate vs trailing avg. 0-1. High = accelerating. */
  momentumScore: number;
  /** Quality of current session signals. 0-1. Bounces score near 0. */
  sessionQuality: number;
  /** Derived from cart add/remove cycles, product comparison patterns, checkout abandons. 0-1. */
  hesitationScore: number;
  /** Enhanced price sensitivity with additional computed signals. */
  priceSensitivity: UserProfile['priceSensitivity'] & {
    enhanced: {
      /** Total coupon/promo uses from signals */
      couponUsageCount: number;
      /** Ratio of sale-item views to total product views */
      saleClickRatio: number;
    };
  };
}

export function enrichProfileForAdk(profile: UserProfile): AdkEnrichedProfile {
  return {
    ...profile,
    behavioralLifecycle: computeBehavioralLifecycle(profile),
    momentumScore: computeMomentumScore(profile),
    sessionQuality: computeSessionQuality(profile),
    hesitationScore: computeHesitationScore(profile),
    priceSensitivity: computeEnhancedPriceSensitivity(profile),
  };
}

function computeBehavioralLifecycle(
  profile: UserProfile
): AdkEnrichedProfile['behavioralLifecycle'] {
  const { lifecycleStage, sessionCount, cartActivity = 0 } = profile;

  if (lifecycleStage === 'FREQUENT' && sessionCount > 30 && cartActivity > 15) {
    return 'LOYAL';
  }
  if (lifecycleStage === 'RETURNING' && sessionCount > 15 && cartActivity > 8) {
    return 'FREQUENT';
  }
  if (lifecycleStage === 'NEW' && sessionCount > 10 && cartActivity > 5) {
    return 'FREQUENT';
  }
  if (lifecycleStage === 'NEW' && sessionCount > 5 && cartActivity > 3) {
    return 'RETURNING';
  }

  return lifecycleStage;
}

function computeMomentumScore(profile: UserProfile): number {
  const { currentSession, sessionCount, firstSeen } = profile;

  if (!currentSession || sessionCount === 0 || !currentSession.startedAt) {
    return 0.5;
  }

  const totalHours = Math.max(1, (Date.now() - firstSeen) / 3_600_000);
  const trailingRate = sessionCount / totalHours;

  const currentHours = Math.max(
    0.001,
    (Date.now() - currentSession.startedAt) / 3_600_000
  );
  const currentRate = 1 / currentHours;

  const denom = currentRate + trailingRate + 0.01;

  if (currentRate > trailingRate) {
    return Math.min(1, 0.5 + ((currentRate - trailingRate) / denom) * 0.5);
  }

  return Math.max(0, 0.5 - ((trailingRate - currentRate) / denom) * 0.5);
}

function computeSessionQuality(profile: UserProfile): number {
  const { currentSession } = profile;

  if (!currentSession) {
    return 0.5;
  }

  const signalCount = currentSession.signalCount;
  const productViews = currentSession.productViews ?? [];
  const cartAdds = currentSession.cartAdds ?? 0;

  const base = Math.min(1, signalCount / 20);
  const viewBonus = Math.min(1, productViews.length / 5) * 0.3;
  const cartBonus = Math.min(1, cartAdds / 3) * 0.2;

  let score = base + viewBonus + cartBonus;

  if (signalCount === 0 || (signalCount === 1 && productViews.length === 0)) {
    score *= 0.1;
  }

  return Math.min(1, Math.max(0, score));
}

function computeHesitationScore(profile: UserProfile): number {
  const hesitationCount = profile.hesitationCount ?? 0;
  let score = Math.min(1, hesitationCount / 10);

  const checkoutConversion = profile.intentSignals?.checkoutConversion ?? 1;
  if (checkoutConversion < 0.3 && (profile.sessionCount ?? 0) > 3) {
    score = Math.min(1, score + 0.15);
  }

  return score;
}

function computeEnhancedPriceSensitivity(
  profile: UserProfile
): AdkEnrichedProfile['priceSensitivity'] {
  const searchHistory = profile.searchHistory ?? [];
  const couponPattern = /(coupon|promo|discount|sale|deal|code)/i;
  const couponUsageCount = searchHistory.filter((entry) =>
    couponPattern.test(entry.query)
  ).length;

  const saleClickRatio = profile.priceSensitivity?.dealClickRate ?? 0;

  return {
    ...profile.priceSensitivity,
    enhanced: {
      couponUsageCount,
      saleClickRatio,
    },
  };
}
