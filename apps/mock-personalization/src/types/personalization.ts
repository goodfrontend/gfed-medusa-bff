import type { ApiResponse, Intent, Surface } from './common.js';

/**
 * Personalization request/response — the primary contract for the
 * POST /api/personalize endpoint.
 */

/** Request body for POST /api/personalize. */
export interface PersonalizeRequest {
  /** Required device identifier. */
  deviceId: string;
  /** Optional authenticated user. */
  userId?: string;
  /** The surface/section being personalized (e.g., 'home', 'product'). */
  surface: Surface;
  /** Page path or identifier within the surface. */
  page: string;
  /** If on a product page, the product ID. */
  productId?: string;
  /** If on a category page, the category handle. */
  category?: string;
  /** Product price context (for price-sensitive decisions). */
  price?: number;
}

/** Response body for POST /api/personalize on success. */
export interface PersonalizeResponse {
  /** Unique request ID for traceability. */
  requestId: string;
  /** Ordered array of recommended components (highest priority first). */
  components: PersonalizationComponent[];
  /** Explanation of why these components were chosen. */
  reasoning: PersonalizationReasoning;
  /** Cache key the BFF can use to short-circuit identical requests. */
  cacheKey: string;
  /** ISO-8601 timestamp of when this decision was served. */
  servedAt: string;
}

/** A single component recommendation within a personalization decision. */
export interface PersonalizationComponent {
  /** Component type name (matches BFF component registry). */
  component: string;
  /** CMS content ID if a specific content item was selected, or null. */
  contentId: string | null;
  /** Priority ordering within the response (1 = highest priority). */
  priority: number;
  /** Component-specific overrides (props to pass to the component). */
  propsOverrides: Record<string, unknown>;
  /** Human-readable explanation for this component's selection. */
  reasoning: string;
  /** Confidence score 0-1 for this component selection. */
  score: number;
}

/** Reasoning metadata attached to a personalization decision. */
export interface PersonalizationReasoning {
  /** Classified shopping intent. */
  intent: Intent;
  /** Confidence in the intent classification (0-1). */
  confidence: number;
  /** List of explanatory factors leading to this decision. */
  factors: string[];
  /** Model version identifier. */
  modelVersion: string;
}

/** Wrapped API response for personalization. */
export type PersonalizeApiResponse = ApiResponse<PersonalizeResponse>;
