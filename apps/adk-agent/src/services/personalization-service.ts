import type {
  Profile,
  AvailableContent,
  AvailableProduct,
  DecisionComponent,
  IntentClassification,
  PersonalizationDecision,
  AgentContext,
  EngagementLevel,
} from '../types';
import { classifyIntent } from './intent-classifier';
import { validateContentIds } from './content-validator';
import { buildDecisionWithMinimums } from './decision-builder';
import { MOMENTUM_SCORE_HIGH_ENGAGEMENT } from '../config/constants';

interface PersonalizationResult {
  decision: PersonalizationDecision;
  intentClassification: IntentClassification;
  context: AgentContext;
}

/**
 * Main personalization orchestration service.
 * 
 * 1. Classifies intent from profile
 * 2. Validates contentIds in agent output
 * 3. Enforces minimum component counts
 */
export function personalize(
  profile: Profile,
  availableContent: AvailableContent[],
  availableProducts: AvailableProduct[]
): PersonalizationResult {
  // Step 1: Classify intent
  const intentClassification = classifyIntent(profile);

  // Step 2: Determine engagement level for minimums
  const engagementLevel = determineEngagementLevel(profile);

  // Step 3: Build fallback decision with minimums
  // (This is the deterministic fallback, not the LLM output)
  const fallbackComponents = buildFallbackComponents(
    profile,
    availableContent,
    intentClassification.intent
  );

  // Step 4: Validate contentIds
  const validated = validateContentIds(fallbackComponents, availableContent);

  // Step 5: Enforce minimums
  const { components: finalComponents } = buildDecisionWithMinimums(
    validated.components,
    engagementLevel,
    availableContent,
    profile.lifecycleStage
  );

  // Build final decision
  const decision: PersonalizationDecision = {
    components: finalComponents,
    reasoning: {
      intent: intentClassification.intent,
      confidence: intentClassification.confidence,
      factors: intentClassification.factors,
      modelVersion: 'adk-v1',
    },
  };

  return {
    decision,
    intentClassification,
    context: {
      profile,
      availableContent,
      availableProducts,
      deviceId: '',
      intent: intentClassification.intent,
    },
  };
}

/**
 * Determine engagement level from profile signals.
 */
function determineEngagementLevel(profile: Profile): EngagementLevel {
  const momentumScore = profile.momentumScore ?? 0;
  const cartActivity = profile.cartActivity ?? 0;
  const behavioralLifecycle = profile.behavioralLifecycle ?? '';
  const lifecycleStage = profile.lifecycleStage ?? '';

  if (
    momentumScore > MOMENTUM_SCORE_HIGH_ENGAGEMENT ||
    cartActivity > 0 ||
    behavioralLifecycle === 'LOYAL' ||
    lifecycleStage === 'LOYAL'
  ) {
    return 'HIGH';
  }

  if (profile.engagementLevel) {
    return profile.engagementLevel;
  }

  return 'LOW';
}

/**
 * Build fallback components based on intent and available content.
 */
function buildFallbackComponents(
  profile: Profile,
  availableContent: AvailableContent[],
  intent: string
): DecisionComponent[] {
  const components: DecisionComponent[] = [];

  // Build content maps
  const contentByType: Record<string, string> = {};
  for (const content of availableContent) {
    if (!contentByType[content._type]) {
      contentByType[content._type] = content._id;
    }
  }

  // Add components based on intent
  if (intent === 'buy_now' || intent === 'exploring') {
    // HeroBanner for buy_now/exploring
    if (contentByType['heroBanner']) {
      components.push({
        component: 'HeroBanner',
        contentId: contentByType['heroBanner'],
        propsOverrides: {},
        priority: 1,
        score: 0.8,
        reasoning: `Fallback: ${intent} intent`,
      });
    }

    // FeaturedCategoryRail
    components.push({
      component: 'FeaturedCategoryRail',
      contentId: null,
      propsOverrides: { handle: 'mens', title: 'Shop Men' },
      priority: 2,
      score: 0.7,
      reasoning: `Fallback: ${intent} intent`,
    });
  }

  if (intent === 'price_shop' || intent === 'uncertain') {
    // PersonalizedBanner for price_shop/uncertain
    if (contentByType['homeBanner']) {
      components.push({
        component: 'PersonalizedBanner',
        contentId: contentByType['homeBanner'],
        propsOverrides: {},
        priority: 1,
        score: 0.8,
        reasoning: `Fallback: ${intent} intent`,
      });
    }

    // FeaturedCategoryRail
    components.push({
      component: 'FeaturedCategoryRail',
      contentId: null,
      propsOverrides: { handle: 'mens', title: 'Shop Men' },
      priority: 2,
      score: 0.7,
      reasoning: `Fallback: ${intent} intent`,
    });
  }

  // Ensure at least one component
  if (components.length === 0) {
    components.push({
      component: 'FeaturedCategoryRail',
      contentId: null,
      propsOverrides: { handle: 'mens', title: 'Shop Men' },
      priority: 1,
      score: 0.5,
      reasoning: 'Fallback: default',
    });
  }

  return components;
}
