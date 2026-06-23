/**
 * Shared primitives and error contract.
 * These types define the common language between the BFF
 * and the external personalization service.
 */

/** Wrapped API error response. */
export interface ApiError {
  /** Machine-readable error code (e.g., 'VALIDATION_ERROR'). */
  code: string;
  /** Human-readable error message. */
  message: string;
  /** Optional field-level details for validation errors. */
  details?: Record<string, unknown>;
  /** Optional request ID for traceability. */
  requestId?: string;
}

/** Generic API response wrapper. */
export interface ApiResponse<T> {
  /** Whether the request succeeded. */
  success: boolean;
  /** Response payload on success. */
  data?: T;
  /** Error details on failure. */
  error?: ApiError;
}

/** Surface identifiers the service knows about. Extensible via string. */
export type Surface = 'home' | 'product' | 'category' | 'search' | 'cart' | 'checkout' | (string & {});

/** User lifecycle stages as classified by the external service. */
export type LifecycleStage = 'NEW' | 'RETURNING' | 'FREQUENT' | 'LOYAL';

/** Engagement level as classified by the external service. */
export type EngagementLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/** Shopping intent classifications. */
export type Intent = 'buy_now' | 'exploring' | 'price_shop' | 'uncertain';
