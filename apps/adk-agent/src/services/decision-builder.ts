import {
  COMPONENT_FEATURED_CATEGORY_RAIL,
  COMPONENT_HERO_BANNER,
  COMPONENT_PERSONALIZED_BANNER,
  CONTENT_TYPE_HERO_BANNER,
  CONTENT_TYPE_HOME_BANNER,
  DEFAULT_CATEGORY_HANDLE,
  DEFAULT_CATEGORY_TITLE,
  FALLBACK_COMPONENT_PRIORITY,
  MIN_COMPONENTS_DEFAULT,
  MIN_COMPONENTS_HIGH_ENGAGEMENT,
  MIN_COMPONENTS_NEW_USER,
} from '../config/constants';
import type {
  AvailableContent,
  DecisionComponent,
  EngagementLevel,
  LifecycleStage,
} from '../types';

interface BuildDecisionResult {
  components: DecisionComponent[];
  addedFallbacks: string[];
}

/**
 * Enforce minimum component counts by adding fallback components.
 *
 * Minimums:
 * - HIGH engagement: 4 components
 * - NEW lifecycle: 3 components
 * - Default: 2 components
 *
 * Fallbacks are added in priority order:
 * 1. HeroBanner (if heroBanner content available)
 * 2. FeaturedCategoryRail (always available)
 * 3. PersonalizedBanner (if homeBanner content available)
 */
export function buildDecisionWithMinimums(
  components: DecisionComponent[],
  engagementLevel: EngagementLevel | undefined,
  availableContent: AvailableContent[],
  lifecycleStage?: LifecycleStage
): BuildDecisionResult {
  const addedFallbacks: string[] = [];

  // Determine minimum component count
  let minComponents = MIN_COMPONENTS_DEFAULT;

  // Check for HIGH engagement
  const isHighEngagement = engagementLevel === 'HIGH';
  if (isHighEngagement) {
    minComponents = MIN_COMPONENTS_HIGH_ENGAGEMENT;
  }

  // Check for NEW lifecycle (overrides engagement minimum if higher)
  if (lifecycleStage === 'NEW' && MIN_COMPONENTS_NEW_USER > minComponents) {
    minComponents = MIN_COMPONENTS_NEW_USER;
  }

  // If already meets minimum, return unchanged
  if (components.length >= minComponents) {
    return { components, addedFallbacks };
  }

  // Build content maps for fallbacks
  const contentByType: Record<string, string> = {};
  for (const content of availableContent) {
    const type = content._type;
    const id = content._id;
    if (type && id && !contentByType[type]) {
      contentByType[type] = id;
    }
  }

  // Track what component types we already have
  const existingTypes = new Set(components.map((c) => c.component));
  const existingHandles = new Set(
    components
      .filter((c) => c.component === COMPONENT_FEATURED_CATEGORY_RAIL)
      .map((c) => c.propsOverrides.handle as string)
      .filter(Boolean)
  );

  const result = [...components];

  // Add missing components until minimum met
  while (result.length < minComponents) {
    let added = false;

    // Try to add HeroBanner
    if (
      !existingTypes.has(COMPONENT_HERO_BANNER) &&
      contentByType[CONTENT_TYPE_HERO_BANNER]
    ) {
      result.push({
        component: COMPONENT_HERO_BANNER,
        contentId: contentByType[CONTENT_TYPE_HERO_BANNER],
        propsOverrides: {},
        priority: FALLBACK_COMPONENT_PRIORITY,
        score: 0,
        reasoning: 'Fallback: minimum component enforcement',
      });
      existingTypes.add(COMPONENT_HERO_BANNER);
      addedFallbacks.push(COMPONENT_HERO_BANNER);
      added = true;
    }

    // Try to add FeaturedCategoryRail
    if (!added && !existingHandles.has(DEFAULT_CATEGORY_HANDLE)) {
      result.push({
        component: COMPONENT_FEATURED_CATEGORY_RAIL,
        contentId: null,
        propsOverrides: {
          handle: DEFAULT_CATEGORY_HANDLE,
          title: DEFAULT_CATEGORY_TITLE,
        },
        priority: FALLBACK_COMPONENT_PRIORITY,
        score: 0,
        reasoning: 'Fallback: minimum component enforcement',
      });
      existingTypes.add(COMPONENT_FEATURED_CATEGORY_RAIL);
      existingHandles.add(DEFAULT_CATEGORY_HANDLE);
      addedFallbacks.push(COMPONENT_FEATURED_CATEGORY_RAIL);
      added = true;
    }

    // Try to add PersonalizedBanner
    if (
      !added &&
      !existingTypes.has(COMPONENT_PERSONALIZED_BANNER) &&
      contentByType[CONTENT_TYPE_HOME_BANNER]
    ) {
      result.push({
        component: COMPONENT_PERSONALIZED_BANNER,
        contentId: contentByType[CONTENT_TYPE_HOME_BANNER],
        propsOverrides: {},
        priority: FALLBACK_COMPONENT_PRIORITY,
        score: 0,
        reasoning: 'Fallback: minimum component enforcement',
      });
      existingTypes.add(COMPONENT_PERSONALIZED_BANNER);
      addedFallbacks.push(COMPONENT_PERSONALIZED_BANNER);
      added = true;
    }

    // If we couldn't add any more components, break to avoid infinite loop
    if (!added) {
      break;
    }
  }

  return { components: result, addedFallbacks };
}
