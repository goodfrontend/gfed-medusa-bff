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

export interface DecisionComponent {
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

export interface DecisionContext {
  surface: string;
  page: string;
  productId?: string;
  cartValue?: number;
  category?: string;
  searchQuery?: string;
}

export async function makeDecision(
  profile: UserProfile,
  context: DecisionContext
): Promise<PersonalizationDecision> {
  const { surface } = context;

  const intentScores = classifyIntent(profile);
  const primaryIntentScore = intentScores[0] ?? {
    intent: 'browse' as Intent,
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

  const candidates: Array<{
    component: ComponentDefinition;
    content: Record<string, unknown> | null;
    score: number;
    reasoning: string;
  }> = [];

  for (const comp of componentDefs) {
    if (comp.contentTypes.length === 0) {
      candidates.push({
        component: comp,
        content: null,
        ...scoreCandidate(profile, primaryIntent, comp, null, context),
      });
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
        ...scoreCandidate(profile, primaryIntent, comp, content, context),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const topCandidates = dedupeByComponent(candidates).slice(0, 4);

  const selected: DecisionComponent[] = topCandidates.map((c, i) => {
    const resolvedContent = c.content ? resolveAudienceFields(c.content) : null;
    return {
      component: c.component.name,
      contentId: (c.content?._id as string | undefined) ?? null,
      propsOverrides: {
        ...resolvedContent,
        ...buildPropsOverrides(
          c.component,
          resolvedContent,
          profile,
          context,
          primaryIntent
        ),
      },
      priority: i + 1,
      reasoning: c.reasoning,
      score: c.score,
    };
  });

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
  sorted: Array<{
    component: ComponentDefinition;
    content: Record<string, unknown> | null;
    score: number;
    reasoning: string;
  }>
) {
  const seen = new Set<string>();
  const out: typeof sorted = [];
  for (const row of sorted) {
    const id = `${row.component.name}:${row.content?._id ?? 'null'}`;
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
  _context: DecisionContext
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

  return {
    score: Math.max(0, Math.round(score * 100) / 100),
    reasoning: reasons.length ? reasons.join('; ') : 'Baseline score',
  };
}

function scoreIntentMatch(comp: string, intent: Intent): number {
  const map: Record<string, Partial<Record<Intent, number>>> = {
    HeroBanner: {
      buy_now: 1.0,
      browse: 0.8,
      price_shop: 0.9,
      hesitant: 0.5,
      bounce: 0.1,
    },

  };
  return map[comp]?.[intent] ?? 0.3;
}

function buildPropsOverrides(
  comp: ComponentDefinition,
  _content: Record<string, unknown> | null,
  profile: UserProfile,
  _ctx: DecisionContext,
  intent: Intent
): Record<string, unknown> {
  const o: Record<string, unknown> = {};

  if (intent === 'buy_now') {
    o.ctaText = 'Buy Now — Free Shipping';
  } else if (intent === 'price_shop') {
    o.ctaText = 'See the Deal';
  } else if (intent === 'research') {
    o.ctaText = 'Compare Options';
  }

  return o;
}

function getTopCategory(
  profile: UserProfile
): { category: string; score: number } | null {
  let top: { category: string; score: number } | null = null;
  for (const [cat, d] of Object.entries(profile.categoryAffinity)) {
    const s = d.score ?? 0;
    if (!top || s > top.score) {
      top = { category: cat, score: s };
    }
  }
  return top;
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
  const tc = getTopCategory(profile);
  if (tc) {
    f.push(`Top category: ${tc.category} (${tc.score.toFixed(2)})`);
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
