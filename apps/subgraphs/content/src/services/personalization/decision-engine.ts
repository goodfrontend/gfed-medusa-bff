import {
  type ComponentDefinition,
  getComponentsForSurface,
} from '../../config/component-registry';
import type { UserProfile } from './feature-store';
import {
  type Intent,
  type IntentScore,
  classifyIntent,
} from './intent-classifier';
import { fetchAvailableContent, resolveAudienceFields } from './sanity-content';
import {
  type CategoryOption,
  type ProductPreview,
  fetchCategoryProducts,
} from '../medusa/category-products';
import { logger } from './logger';

interface DecisionComponent {
  component: string;
  contentId: string | null;
  propsOverrides: Record<string, unknown>;
  priority: number;
  reasoning: string;
  score: number;
}

export interface PersonalizationDecision {
  components: DecisionComponent[];
  reasoning: {
    intent: string;
    confidence: number;
    factors: string[];
    modelVersion: string;
  };
  cacheKey: string;
  servedAt?: string;
}

interface DecisionContext {
  surface: string;
}

interface Candidate {
  component: ComponentDefinition;
  content: Record<string, unknown> | null;
  score: number;
  reasoning: string;
  _category?: CategoryOption;
  _medusaProducts?: ProductPreview[];
}

export async function makeDecision(
  profile: UserProfile,
  context: DecisionContext
): Promise<PersonalizationDecision> {
  const { surface } = context;

  const intentScores = classifyIntent(profile);
  const primaryIntentScore = intentScores[0] ?? {
    intent: 'exploring' as Intent,
    score: 0,
  };
  const primaryIntent = primaryIntentScore.intent;
  const intentConfidence = primaryIntentScore.score;

  const componentDefs = getComponentsForSurface(surface);
  if (componentDefs.length === 0) {
    return emptyDecision(
      profile.deviceId,
      surface,
      primaryIntent,
      intentConfidence
    );
  }

  const sanityContent = await fetchAvailableContent(surface);
  const contentByType = groupByContentType(sanityContent);

  const relevantCategories = getRelevantCategories(profile);

  const candidates: Candidate[] = [];

  for (const comp of componentDefs) {
    if (comp.contentTypes.length === 0) {
      if (comp.name === 'FeaturedCategoryRail') {
        for (const cat of relevantCategories) {
          candidates.push({
            component: comp,
            content: null,
            ...scoreCandidate(profile, primaryIntent, comp, null, cat),
            _category: cat,
          });
        }
      } else {
        candidates.push({
          component: comp,
          content: null,
          ...scoreCandidate(profile, primaryIntent, comp, null),
        });
      }
      continue;
    }

    const matchingContent = comp.contentTypes.flatMap(
      (ct) => contentByType[ct] ?? []
    );
    const rows = matchingContent.length > 0 ? matchingContent : [null];

    for (const content of rows) {
      candidates.push({
        component: comp,
        content,
        ...scoreCandidate(profile, primaryIntent, comp, content),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const topCandidates = dedupeByComponent(candidates).slice(0, 4);

  for (const c of topCandidates) {
    if (c.component.name === 'FeaturedCategoryRail' && c._category) {
      try {
        c._medusaProducts = await fetchCategoryProducts(c._category.handle);
      } catch (err) {
        logger.warn({ err, category: c._category.handle }, 'Medusa fetch failed for category');
      }
    }
  }

  const selected: DecisionComponent[] = topCandidates
    .filter((c) => c.component.name !== 'FeaturedCategoryRail' || (c._medusaProducts?.length ?? 0) > 0)
    .map((c, i) => {
      const resolvedContent = c.content ? resolveAudienceFields(c.content) : null;
      return {
        component: c.component.name,
        contentId: (c.content?._id as string | undefined) ?? null,
        propsOverrides: {
          ...resolvedContent,
          ...buildPropsOverrides(
            c.component,
            profile,
            primaryIntent,
            {
              category: c._category,
              products: c._medusaProducts,
            }
          ),
        },
        priority: i + 1,
        reasoning: c.reasoning,
        score: c.score,
      };
    });

  if (selected.length === 0) {
    throw new Error('No components available — all component data sources failing for surface: ' + surface);
  }

  return {
    components: selected,
    reasoning: {
      intent: primaryIntent,
      confidence: Math.round(intentConfidence * 100) / 100,
      factors: explainDecision(primaryIntent, intentScores, profile, selected),
      modelVersion: 'rules-v1',
    },
    cacheKey: `decision:${profile.deviceId}:${surface}`,
  };
}

function dedupeByComponent(
  sorted: Candidate[]
) {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const row of sorted) {
    const id = `${row.component.name}:${row.content?._id ?? row._category?.handle ?? 'null'}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(row);
  }
  return out;
}

function scoreCandidate(
  profile: UserProfile,
  intent: Intent,
  component: ComponentDefinition,
  content: Record<string, unknown> | null,
  category?: CategoryOption,
): { score: number; reasoning: string } {
  let score = component.weight;
  const reasons: string[] = [];

  const intentBoost = scoreIntentMatch(component.name, intent);
  score += intentBoost;
  if (intentBoost > 0.5) {
    reasons.push(`Strong match for ${intent} intent`);
  }

  if (
    intent === 'price_shop' &&
    String(content?.badge ?? '')
      .toLowerCase()
      .includes('deal')
  ) {
    score += 1.0;
    reasons.push('Price-sensitive + deal content');
  }

  if (category && component.name === 'FeaturedCategoryRail') {
    const affBoost = Math.min(category.score * 0.3, 1.5);
    score += affBoost;
    if (affBoost > 0.5) {
      reasons.push(`High category affinity for ${category.name}`);
    }
  }

  if (profile.lifecycleStage === 'LOYAL') {
    if (component.name === 'HeroBanner') score += 0.3;
    if (component.name === 'FeaturedCategoryRail') score += 0.4;
  }
  if (profile.lifecycleStage === 'FREQUENT' && component.name === 'FeaturedCategoryRail') {
    score += 0.2;
    reasons.push('Frequent buyer category browsing');
  }

  if (profile.engagementLevel === 'HIGH') {
    if (component.name === 'FeaturedCategoryRail') score += 0.2;
  }

  if (profile.priceSensitivity.score > 0.6 && component.name === 'PersonalizedBanner') {
    score += 0.4;
    reasons.push('Price-sensitive user promotional banner');
  }

  if (profile.engagementLevel === 'LOW' && component.name === 'PersonalizedBanner') {
    score += 0.2;
    reasons.push('Engagement banner for low-engagement user');
  }

  if (component.name === 'HeroBanner') {
    if (profile.intentSignals.checkoutConversion > 0.5) {
      score += 0.2;
    }
    if ((profile.cartActivity ?? 0) > 0) {
      score += 0.2;
    }
  }

  if (component.name === 'PersonalizedBanner' && (profile.hesitationCount ?? 0) > 2) {
    score += 0.3;
    reasons.push('Hesitant user reassurance banner');
  }

  return {
    score: Math.max(0, Math.round(score * 100) / 100),
    reasoning: reasons.length ? reasons.join('; ') : 'Baseline score',
  };
}

function scoreIntentMatch(comp: string, intent: Intent): number {
  const map: Record<string, Partial<Record<Intent, number>>> = {
    HeroBanner: {
      buy_now: 1.0,
      exploring: 0.7,
      price_shop: 0.9,
      uncertain: 0.3,
    },
    FeaturedCategoryRail: {
      buy_now: 0.5,
      exploring: 1.0,
      price_shop: 0.6,
      uncertain: 0.4,
    },
    PersonalizedBanner: {
      buy_now: 0.3,
      exploring: 0.5,
      price_shop: 0.8,
      uncertain: 0.9,
    },
  };
  return map[comp]?.[intent] ?? 0.3;
}

function buildPropsOverrides(
  comp: ComponentDefinition,
  profile: UserProfile,
  intent: Intent,
  extra?: { category?: { handle: string; name: string }; products?: ProductPreview[] }
): Record<string, unknown> {
  if (comp.name === 'FeaturedCategoryRail') {
    return {
      title: extra?.category?.name ?? 'Featured',
      handle: extra?.category?.handle ?? '',
      products: extra?.products ?? [],
    };
  }

  if (comp.name === 'PersonalizedBanner') {
    return {};
  }

  const o: Record<string, unknown> = {};

  if (intent === 'buy_now') {
    o.cta = { label: 'Buy Now — Free Shipping' };
  } else if (intent === 'price_shop') {
    o.cta = { label: 'See the Deal' };
  } else if (intent === 'exploring') {
    o.cta = { label: 'Explore More' };
  }

  return o;
}

export function getRelevantCategories(profile: UserProfile): CategoryOption[] {
  const affinities = Object.entries(profile.categoryAffinity)
    .sort(([, a], [, b]) => b.score - a.score);

  if (affinities.length === 0) {
    return [
      { handle: 'mens', name: "Men's", score: 0 },
      { handle: 'womens', name: "Women's", score: 0 },
    ];
  }

  return affinities.slice(0, 4).map(([handle, data]) => ({
    handle,
    name: handle.charAt(0).toUpperCase() + handle.slice(1),
    score: data.score,
  }));
}


function explainDecision(
  intent: Intent,
  scores: IntentScore[],
  profile: UserProfile,
  components: DecisionComponent[]
): string[] {
  const f: string[] = [];
  const topScore = scores[0];
  if (!topScore) {
    return ['No intent scores'];
  }
  f.push(`Primary intent: ${intent} (${(topScore.score * 100).toFixed(0)}%)`);
  const topCat = getRelevantCategories(profile)[0];
  if (topCat) {
    f.push(`Top category: ${topCat.name} (${topCat.score.toFixed(2)})`);
  }
  if (profile.priceSensitivity.score > 0.6) {
    f.push('Price-sensitive');
  }
  if (profile.lifecycleStage === 'LOYAL') {
    f.push('Loyal customer');
  }
  if (profile.engagementLevel === 'HIGH') {
    f.push('High engagement');
  }
  if (profile.intentSignals.researchDepth > 2) {
    f.push('Deep researcher');
  }
  f.push(`Components: ${components.map((c) => c.component).join(', ')}`);
  return f;
}

function emptyDecision(
  deviceId: string,
  surface: string,
  intent: Intent,
  confidence: number
): PersonalizationDecision {
  return {
    components: [],
    reasoning: {
      intent,
      confidence,
      factors: ['No components for this surface'],
      modelVersion: 'rules-v1',
    },
    cacheKey: `decision:${deviceId}:${surface}`,
  };
}

function groupByContentType(
  content: Array<Record<string, unknown>>
): Record<string, Array<Record<string, unknown>>> {
  const map: Record<string, Array<Record<string, unknown>>> = {};
  for (const item of content) {
    const type = item._type as string;
    if (!type) {
      continue;
    }
    if (!map[type]) {
      map[type] = [];
    }
    map[type].push(item);
  }
  return map;
}
