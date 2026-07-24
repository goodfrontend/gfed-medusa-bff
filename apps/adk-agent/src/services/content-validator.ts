import type { DecisionComponent, AvailableContent, ValidatedComponents } from '../types';
import {
  CONTENT_TYPE_HERO_BANNER,
  CONTENT_TYPE_HOME_BANNER,
  COMPONENT_HERO_BANNER,
  COMPONENT_FEATURED_CATEGORY_RAIL,
  COMPONENT_PERSONALIZED_BANNER,
} from '../config/constants';

/**
 * Validate and fix contentIds in components.
 * 
 * - FeaturedCategoryRail: contentId MUST be null
 * - HeroBanner: contentId must reference a valid heroBanner from availableContent
 * - PersonalizedBanner: contentId must reference a valid homeBanner from availableContent
 * - Invalid contentIds are replaced or components are removed if no valid content exists
 */
export function validateContentIds(
  components: DecisionComponent[],
  availableContent: AvailableContent[]
): ValidatedComponents {
  const replacedIds: string[] = [];
  const removedComponents: string[] = [];

  if (components.length === 0) {
    return { components: [], replacedIds, removedComponents };
  }

  // Build content maps by type
  const contentByType: Record<string, string> = {};
  const validContentIds = new Set<string>();

  for (const content of availableContent) {
    const type = content._type;
    const id = content._id;
    if (type && id) {
      // Store first matching content for each type
      if (!contentByType[type]) {
        contentByType[type] = id;
      }
    }
    if (id) {
      validContentIds.add(id);
    }
  }

  const validatedComponents: DecisionComponent[] = [];

  for (const component of components) {
    // FeaturedCategoryRail: always set contentId to null
    if (component.component === COMPONENT_FEATURED_CATEGORY_RAIL) {
      validatedComponents.push({
        ...component,
        contentId: null,
      });
      continue;
    }

    // HeroBanner: validate/replace contentId
    if (component.component === COMPONENT_HERO_BANNER) {
      const rawId = component.contentId;
      const isInvalid = rawId == null || rawId === '' || !validContentIds.has(rawId);

      if (isInvalid) {
        const replacementId = contentByType[CONTENT_TYPE_HERO_BANNER];
        if (replacementId) {
          if (rawId) {
            replacedIds.push(rawId);
          }
          validatedComponents.push({
            ...component,
            contentId: replacementId,
          });
        } else {
          removedComponents.push(component.component);
          // Skip adding this component
        }
      } else {
        validatedComponents.push(component);
      }
      continue;
    }

    // PersonalizedBanner: validate/replace contentId
    if (component.component === COMPONENT_PERSONALIZED_BANNER) {
      const rawId = component.contentId;
      const isInvalid = rawId == null || rawId === '' || !validContentIds.has(rawId);

      if (isInvalid) {
        const replacementId = contentByType[CONTENT_TYPE_HOME_BANNER];
        if (replacementId) {
          if (rawId) {
            replacedIds.push(rawId);
          }
          validatedComponents.push({
            ...component,
            contentId: replacementId,
          });
        } else {
          removedComponents.push(component.component);
          // Skip adding this component
        }
      } else {
        validatedComponents.push(component);
      }
      continue;
    }

    // Unknown component type - pass through
    validatedComponents.push(component);
  }

  return {
    components: validatedComponents,
    replacedIds,
    removedComponents,
  };
}
