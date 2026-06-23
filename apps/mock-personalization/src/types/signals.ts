import type { ApiResponse } from './common.js';

/**
 * Signal types — what the BFF sends to the external personalization service
 * to record user behavior events.
 */

/** Known user behavior signal types. */
export type SignalType =
  | 'PAGE_VIEW'
  | 'PRODUCT_VIEW'
  | 'PRODUCT_HOVER'
  | 'QUICK_VIEW_OPEN'
  | 'IMAGE_ZOOM'
  | 'REVIEWS_VIEW'
  | 'SIZE_GUIDE_VIEW'
  | 'SEARCH_QUERY'
  | 'SEARCH_RESULT_CLICK'
  | 'FILTER_APPLIED'
  | 'SORT_CHANGED'
  | 'CART_ADD'
  | 'CART_REMOVE'
  | 'CHECKOUT_START'
  | 'CHECKOUT_ABANDON';

/** Request body for POST /api/signals. */
export interface SignalRequest {
  /** The type of user behavior signal. */
  type: SignalType;
  /** Signal-type-specific payload. Fields depend on signal type. */
  payload: Record<string, unknown>;
  /** Required device identifier (anonymous or pseudonymous). */
  deviceId: string;
  /** Optional authenticated user identifier. */
  userId?: string;
  /** The URL where the signal was generated. */
  url?: string;
  /** Unix timestamp (ms) when the signal occurred. Defaults to server time. */
  timestamp?: number;
  /** Page identifier (e.g., 'home', 'product/abc123'). */
  page?: string;
}

/** Response body for POST /api/signals on success. */
export interface SignalResponse {
  /** Whether the signal was successfully recorded. */
  success: boolean;
  /** Unique identifier for the recorded signal. */
  signalId: string;
  /** ISO-8601 timestamp of when the signal was processed. */
  processedAt: string;
}

/** Full signal record stored by the service. */
export interface Signal {
  id: string;
  type: SignalType;
  payload: Record<string, unknown>;
  deviceId: string;
  userId?: string;
  url?: string;
  timestamp: number;
  page?: string;
  processedAt: string;
}

/** Wrapped API response for signal submission. */
export type SignalApiResponse = ApiResponse<SignalResponse>;
