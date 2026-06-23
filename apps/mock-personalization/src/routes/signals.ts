import type { Request, Response } from 'express';
import type { SignalStore } from '../store/signal-store.js';
import type { SignalType } from '../types/signals.js';

const VALID_SIGNAL_TYPES: SignalType[] = [
  'PAGE_VIEW',
  'PRODUCT_VIEW',
  'PRODUCT_HOVER',
  'QUICK_VIEW_OPEN',
  'IMAGE_ZOOM',
  'REVIEWS_VIEW',
  'SIZE_GUIDE_VIEW',
  'SEARCH_QUERY',
  'SEARCH_RESULT_CLICK',
  'FILTER_APPLIED',
  'SORT_CHANGED',
  'CART_ADD',
  'CART_REMOVE',
  'CHECKOUT_START',
  'CHECKOUT_ABANDON',
];

/** Validates that the given value is a non-empty string. */
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** Validates that the given value is a known SignalType. */
function isValidSignalType(v: unknown): v is SignalType {
  return VALID_SIGNAL_TYPES.includes(v as SignalType);
}

export function createSignalsHandler(signalStore: SignalStore) {
  return function signalsHandler(req: Request, res: Response): void {
    const body = req.body;

    // Validate: body must be an object and not null / array
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be JSON',
        },
      });
      return;
    }

    // Validate: deviceId must be non-empty string
    if (!isNonEmptyString(body.deviceId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'deviceId is required',
          details: { field: 'deviceId' },
        },
      });
      return;
    }

    // Validate: type must be a known SignalType
    if (!isValidSignalType(body.type)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid signal type',
          details: {
            field: 'type',
            validTypes: VALID_SIGNAL_TYPES,
          },
        },
      });
      return;
    }

    const signalId = signalStore.addSignal({
      type: body.type,
      payload: (body.payload as Record<string, unknown>) ?? {},
      deviceId: body.deviceId,
      userId: body.userId as string | undefined,
      url: body.url as string | undefined,
      timestamp: (body.timestamp as number) ?? Date.now(),
      page: body.page as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: {
        success: true,
        signalId,
        processedAt: new Date().toISOString(),
      },
    });
  };
}
