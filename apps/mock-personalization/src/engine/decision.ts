import type { Intent } from '../types/common.js';
import type { UserProfile } from '../types/profile.js';
import type {
  PersonalizationComponent,
  PersonalizationReasoning,
  PersonalizeRequest,
  PersonalizeResponse,
} from '../types/personalization.js';
import { classifyIntent } from './intent.js';

const COMPONENT_SCORES: Record<number, number> = {
  1: 0.8,
  2: 0.5,
  3: 0.3,
};

const HEADLINES: Record<Intent | 'cold', { headline: string; cta: string }> = {
  buy_now: { headline: 'Ready to Checkout?', cta: 'Complete Your Purchase' },
  exploring: { headline: 'Discover More', cta: 'Explore Now' },
  price_shop: { headline: 'Hot Deals Just for You', cta: 'Shop the Sale' },
  uncertain: { headline: 'Need Help Deciding?', cta: 'See Our Favorites' },
  cold: { headline: 'Welcome!', cta: 'Start Shopping' },
};

/**
 * Deterministic mock decision maker.
 * Classifies intent from the profile and maps it to 1-3 mock components.
 * Always returns the same output for the same input.
 */
export function makeMockDecision(
  profile: UserProfile,
  request: PersonalizeRequest,
): PersonalizeResponse {
  const { deviceId, surface, page } = request;
  const intentScores = classifyIntent(profile);
  const primaryIntentScore = intentScores[0];

  // Cold start: empty profile or no intent scores
  const isColdStart =
    !primaryIntentScore ||
    (Object.keys(profile.categoryAffinity).length === 0 &&
      profile.intentSignals.researchDepth === 0 &&
      profile.intentSignals.checkoutConversion === 0);

  const { components, factors } = isColdStart
    ? buildColdStartComponents()
    : buildIntentComponents(profile, primaryIntentScore!.intent, intentScores);

  const reasoning: PersonalizationReasoning = {
    intent: isColdStart ? 'uncertain' : primaryIntentScore!.intent,
    confidence: isColdStart ? 0 : primaryIntentScore!.score,
    factors,
    modelVersion: 'mock-v0',
  };

  return {
    requestId: `req_${simpleHash(deviceId + surface + page + Date.now().toString().slice(0, 8))}`,
    components,
    reasoning,
    cacheKey: `personalization:${deviceId}:${surface}`,
    servedAt: new Date().toISOString(),
  };
}

function buildColdStartComponents(
): { components: PersonalizationComponent[]; factors: string[] } {
  const headline = HEADLINES.cold;
  const components: PersonalizationComponent[] = [
    {
      component: 'HeroBanner',
      contentId: null,
      priority: 1,
      propsOverrides: {
        headline: headline.headline,
        cta: headline.cta,
      },
      reasoning: 'Cold start — generic welcome for new visitor',
      score: COMPONENT_SCORES[1]!,
    },
    {
      component: 'FeaturedCategoryRail',
      contentId: null,
      priority: 2,
      propsOverrides: {
        title: "Men's",
        handle: 'mens',
        products: [],
      },
      reasoning: 'Cold start — default category rail for new visitor',
      score: COMPONENT_SCORES[2]!,
    },
  ];

  return {
    components,
    factors: [
      'Cold start — no profile data',
      'Showing generic welcome content',
    ],
  };
}

function buildIntentComponents(
  profile: UserProfile,
  primaryIntent: Intent,
  intentScores: { intent: Intent; score: number }[],
): { components: PersonalizationComponent[]; factors: string[] } {
  const topCategories = getTopCategories(profile, 2);
  const fallbackCategory = { name: "Men's", handle: 'mens' };

  const components: PersonalizationComponent[] = [];
  const factors: string[] = [];

  factors.push(
    `Primary intent: ${primaryIntent} (${((intentScores[0]?.score ?? 0) * 100).toFixed(0)}%)`,
  );

  switch (primaryIntent) {
    case 'buy_now': {
      const cat = topCategories[0] ?? fallbackCategory;
      components.push(
        makeComponent('HeroBanner', 1, HEADLINES.buy_now, 'Ready-to-purchase user — conversion banner'),
        makeComponent('FeaturedCategoryRail', 2, {
          title: cat.name,
          handle: cat.handle,
          products: [],
        }, `Top category for purchase-intent user: ${cat.name}`),
        makeComponent('PersonalizedBanner', 3, {}, 'Conversion support banner'),
      );
      if ((profile.cartActivity ?? 0) > 0) {
        factors.push('High cart activity');
      }
      if (profile.engagementLevel === 'HIGH') {
        factors.push('High engagement');
      }
      break;
    }

    case 'exploring': {
      const cat1 = topCategories[0] ?? fallbackCategory;
      const cat2 = topCategories[1] ?? { name: "Women's", handle: 'womens' };
      components.push(
        makeComponent('FeaturedCategoryRail', 1, {
          title: cat1.name,
          handle: cat1.handle,
          products: [],
        }, `Exploring user — top category: ${cat1.name}`),
        makeComponent('FeaturedCategoryRail', 2, {
          title: cat2.name,
          handle: cat2.handle,
          products: [],
        }, `Exploring user — second category: ${cat2.name}`),
        makeComponent('HeroBanner', 3, HEADLINES.exploring, 'Discovery banner for exploring user'),
      );
      if (profile.intentSignals.researchDepth > 2) {
        factors.push('Deep researcher');
      }
      if (Object.keys(profile.categoryAffinity).length > 3) {
        factors.push('Exploring multiple categories');
      }
      break;
    }

    case 'price_shop': {
      components.push(
        makeComponent('PersonalizedBanner', 1, { badge: 'Deal' }, 'Price-sensitive user — deal banner'),
        makeComponent('HeroBanner', 2, HEADLINES.price_shop, 'Deal-seeking user banner'),
      );
      if (profile.priceSensitivity.score > 0.6) {
        factors.push('Price-sensitive');
      }
      if (profile.priceSensitivity.dealClickRate > 0.3) {
        factors.push('High deal click rate');
      }
      break;
    }

    case 'uncertain': {
      components.push(
        makeComponent('PersonalizedBanner', 1, {}, 'Reassurance banner for uncertain user'),
        makeComponent('HeroBanner', 2, HEADLINES.uncertain, 'Guidance banner for uncertain user'),
      );
      if ((profile.hesitationCount ?? 0) > 2) {
        factors.push('Multiple abandonments detected');
      }
      if (profile.intentSignals.researchDepth > 2 && profile.intentSignals.checkoutConversion < 0.2) {
        factors.push('High research, low conversion');
      }
      break;
    }

    default: {
      components.push(
        makeComponent('HeroBanner', 1, HEADLINES.cold, 'Fallback — generic welcome'),
      );
      break;
    }
  }

  return { components, factors };
}

function getTopCategories(
  profile: UserProfile,
  count: number,
): Array<{ name: string; handle: string }> {
  return Object.entries(profile.categoryAffinity)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, count)
    .map(([handle]) => ({
      name: handle.charAt(0).toUpperCase() + handle.slice(1),
      handle,
    }));
}

function makeComponent(
  component: string,
  priority: number,
  propsOverrides: Record<string, unknown>,
  reasoning: string,
): PersonalizationComponent {
  const heroProps: Record<string, unknown> = {};
  if (component === 'HeroBanner') {
    Object.assign(heroProps, {
      headline: propsOverrides.headline ?? HEADLINES.cold.headline,
      cta: propsOverrides.cta ?? HEADLINES.cold.cta,
    });
  }

  return {
    component,
    contentId: null,
    priority,
    propsOverrides: Object.keys(propsOverrides).length > 0
      ? (component === 'HeroBanner' ? heroProps : propsOverrides)
      : (component === 'HeroBanner' ? heroProps : {}),
    reasoning,
    score: COMPONENT_SCORES[priority] ?? 0.3,
  };
}

/**
 * Simple string hash function for deterministic request IDs.
 * Produces an 8-character base-36 string from the input.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}
