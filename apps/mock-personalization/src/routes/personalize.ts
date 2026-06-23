import type { Request, Response } from 'express';
import type { ProfileStore } from '../store/profile-store.js';
import type { PersonalizeRequest } from '../types/personalization.js';
import { makeMockDecision } from '../engine/decision.js';

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

export function createPersonalizeHandler(profileStore: ProfileStore) {
  return function personalizeHandler(req: Request, res: Response): void {
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

    // Validate: deviceId required
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

    // Build profile from store (unknown deviceId gets default empty profile — not an error)
    const profile = profileStore.build(body.deviceId, body.userId as string | undefined);

    // Construct a PersonalizeRequest with defaults
    const personalizeRequest: PersonalizeRequest = {
      deviceId: body.deviceId,
      userId: body.userId as string | undefined,
      surface: (body.surface as string) ?? 'home',
      page: (body.page as string) ?? '/',
      productId: body.productId as string | undefined,
      category: body.category as string | undefined,
      price: body.price as number | undefined,
    };

    const decision = makeMockDecision(profile, personalizeRequest);

    res.status(200).json({
      success: true,
      data: decision,
    });
  };
}
