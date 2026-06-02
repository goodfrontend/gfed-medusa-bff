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
  homepage: [
    {
      component: 'PersonalizedBanner',
      contentId: null,
      propsOverrides: { title: 'Welcome to Our Store', eyebrow: 'New Arrivals', description: 'Discover our latest collection', showPoweredBy: true },
      priority: 1,
      reasoning: 'Default promotional banner',
      score: 0,
    },
    {
      component: 'FeaturedCategoryRail',
      contentId: null,
      propsOverrides: { title: "Men's", handle: 'mens', products: [] },
      priority: 2,
      reasoning: "Men's category rail",
      score: 0,
    },
    {
      component: 'FeaturedCategoryRail',
      contentId: null,
      propsOverrides: { title: "Women's", handle: 'womens', products: [] },
      priority: 3,
      reasoning: "Women's category rail",
      score: 0,
    },
    {
      component: 'HeroBanner',
      contentId: null,
      propsOverrides: { headline: 'Welcome', cta: 'Shop Now' },
      priority: 4,
      reasoning: 'Generic hero',
      score: 0,
    }
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
      intent: 'exploring',
      confidence: 0,
      factors: ['Fallback: no data or engine error'],
      modelVersion: 'fallback',
    },
    cacheKey: `fallback:${deviceId}:${surface}`,
  };
}
