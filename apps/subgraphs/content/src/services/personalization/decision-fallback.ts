import type { PersonalizationDecision } from './decision-engine';

const FALLBACKS: Record<
  string,
  Array<{
    component: string;
    contentId: null;
    propsOverrides: Record<string, unknown>;
    priority: number;
    reasoning: string;
    score: number;
  }>
> = {
  homepage_hero: [
    {
      component: 'HeroBanner',
      contentId: null,
      propsOverrides: { headline: 'Welcome', cta: 'Shop Now' },
      priority: 1,
      reasoning: 'Generic hero',
      score: 0,
    },
  ],
  checkout: [
    {
      component: 'TrustBar',
      contentId: null,
      propsOverrides: {
        badges: [
          { label: 'Secure Payment' },
          { label: 'Money-Back Guarantee' },
          { label: 'Free Shipping' },
          { label: 'Easy Returns' },
        ],
      },
      priority: 1,
      reasoning: 'Trust at checkout',
      score: 0,
    },
  ],
  cart_page: [
    {
      component: 'TrustBar',
      contentId: null,
      propsOverrides: {
        badges: [{ label: 'Secure Payment' }, { label: 'Easy Returns' }],
      },
      priority: 1,
      reasoning: 'Trust',
      score: 0,
    },
  ],
};

export function getFallbackDecision(
  surface: string,
  deviceId: string
): PersonalizationDecision {
  const rows = FALLBACKS[surface] ?? [];
  return {
    components: rows.map((r) => ({
      component: r.component,
      contentId: r.contentId,
      propsOverrides: r.propsOverrides,
      priority: r.priority,
      reasoning: r.reasoning,
      score: r.score,
    })),
    reasoning: {
      intent: 'browse',
      confidence: 0,
      factors: ['Fallback: no data or engine error'],
      modelVersion: 'fallback',
    },
    cacheKey: `fallback:${deviceId}:${surface}`,
  };
}
