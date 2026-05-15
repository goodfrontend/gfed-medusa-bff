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
    {
      component: 'ProductCarousel',
      contentId: null,
      propsOverrides: { title: 'Trending Now', strategy: 'trending' },
      priority: 2,
      reasoning: 'Trending products',
      score: 0,
    },
  ],
  category_page: [
    {
      component: 'CategoryGrid',
      contentId: null,
      propsOverrides: {},
      priority: 1,
      reasoning: 'Category grid',
      score: 0,
    },
    {
      component: 'ProductCarousel',
      contentId: null,
      propsOverrides: { strategy: 'bestsellers' },
      priority: 2,
      reasoning: 'Bestsellers',
      score: 0,
    },
  ],
  product_detail: [
    {
      component: 'ReviewCarousel',
      contentId: null,
      propsOverrides: {},
      priority: 1,
      reasoning: 'Reviews',
      score: 0,
    },
    {
      component: 'UpsellBlock',
      contentId: null,
      propsOverrides: { strategy: 'also_viewed' },
      priority: 2,
      reasoning: 'Also viewed',
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
      component: 'UpsellBlock',
      contentId: null,
      propsOverrides: { strategy: 'frequently_bought_together' },
      priority: 1,
      reasoning: 'Upsell',
      score: 0,
    },
    {
      component: 'TrustBar',
      contentId: null,
      propsOverrides: {
        badges: [{ label: 'Secure Payment' }, { label: 'Easy Returns' }],
      },
      priority: 2,
      reasoning: 'Trust',
      score: 0,
    },
  ],
  search_results: [
    {
      component: 'ProductCarousel',
      contentId: null,
      propsOverrides: { strategy: 'relevance' },
      priority: 1,
      reasoning: 'Relevance sort',
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
