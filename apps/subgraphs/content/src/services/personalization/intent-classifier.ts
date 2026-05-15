import type { UserProfile } from './feature-store';

export type Intent =
  | 'buy_now'
  | 'research'
  | 'browse'
  | 'price_shop'
  | 'return'
  | 'hesitant'
  | 'bounce';

export interface IntentScore {
  intent: Intent;
  score: number;
}

/**
 * Deterministic rule-based intent classification (default when AI is off).
 */
export function classifyIntent(profile: UserProfile): IntentScore[] {
  const s: Record<Intent, number> = {
    buy_now: 0,
    research: 0,
    browse: 0,
    price_shop: 0,
    return: 0,
    hesitant: 0,
    bounce: 0,
  };

  const { intentSignals: is, priceSensitivity: ps } = profile;
  const af = profile.categoryAffinity;
  const totalViews = Object.values(af).reduce((a, b) => a + b.views, 0);
  const catCount = Object.keys(af).length;

  s.buy_now += clamp(is.cartToPurchaseRate * 0.5, 0, 0.5);
  if (profile.lifecycleStage === 'LOYAL') {
    s.buy_now += 0.2;
  }
  if (profile.engagementLevel === 'HIGH') {
    s.buy_now += 0.2;
  }

  s.research += clamp(is.researchDepth * 0.25, 0, 0.5);
  if (catCount > 3) {
    s.research += 0.2;
  }

  if (catCount > 2 && totalViews / Math.max(catCount, 1) < 2) {
    s.browse += 0.5;
  }
  if (profile.lifecycleStage === 'NEW') {
    s.browse += 0.3;
  }

  s.price_shop += clamp(ps.dealClickRate * 0.6, 0, 0.4);
  s.price_shop += clamp(ps.score * 0.4, 0, 0.3);

  s.return += clamp(is.returnRate * 0.8, 0, 0.6);

  if (is.researchDepth > 2 && is.cartToPurchaseRate < 0.2) {
    s.hesitant += 0.4;
  }
  if (ps.score > 0.6 && profile.engagementLevel === 'HIGH') {
    s.hesitant += 0.3;
  }

  if (totalViews <= 1 && is.cartToPurchaseRate === 0) {
    s.bounce += 0.7;
  }

  const total = Object.values(s).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(s)
    .map(([intent, score]) => ({
      intent: intent as Intent,
      score: score / total,
    }))
    .sort((a, b) => b.score - a.score);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
