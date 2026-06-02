import type { UserProfile } from './feature-store';

export type Intent = 'buy_now' | 'exploring' | 'price_shop' | 'uncertain';

export interface IntentScore {
  intent: Intent;
  score: number;
}

export function classifyIntent(profile: UserProfile): IntentScore[] {
  const s: Record<Intent, number> = {
    buy_now: 0,
    exploring: 0,
    price_shop: 0,
    uncertain: 0,
  };

  const { intentSignals: is, priceSensitivity: ps } = profile;
  const af = profile.categoryAffinity;
  const totalViews = Object.values(af).reduce((a, b) => a + b.views, 0);
  const catCount = Object.keys(af).length;

  // buy_now: ready to purchase
  s.buy_now += clamp(is.checkoutConversion * 0.5, 0, 0.5);
  if (profile.lifecycleStage === 'LOYAL') s.buy_now += 0.2;
  if (profile.engagementLevel === 'HIGH') s.buy_now += 0.2;
  if ((profile.cartActivity ?? 0) > 0) s.buy_now += 0.2;

  // exploring: investigating, researching, or casually browsing
  s.exploring += clamp(is.researchDepth * 0.25, 0, 0.4);
  if (catCount > 3) s.exploring += 0.2;
  if (catCount > 2 && totalViews / Math.max(catCount, 1) < 3) s.exploring += 0.3;
  if (profile.lifecycleStage === 'NEW' && totalViews > 1) s.exploring += 0.2;

  // price_shop: deal-seeking
  s.price_shop += clamp(ps.dealClickRate * 0.5, 0, 0.4);
  s.price_shop += clamp(ps.score * 0.4, 0, 0.3);

  // uncertain: hesitant or about to bounce
  if (is.researchDepth > 2 && is.checkoutConversion < 0.2) s.uncertain += 0.4;
  if (ps.score > 0.6 && profile.engagementLevel === 'HIGH' && is.checkoutConversion < 0.3) s.uncertain += 0.3;
  if ((profile.hesitationCount ?? 0) > 2) s.uncertain += 0.3;
  if (totalViews <= 1 && is.checkoutConversion === 0) s.uncertain += 0.5;

  const total = Object.values(s).reduce((a, b) => a + b, 0) || 1;
  return (Object.entries(s) as [Intent, number][])
    .map(([intent, score]) => ({ intent, score: score / total }))
    .sort((a, b) => b.score - a.score);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
