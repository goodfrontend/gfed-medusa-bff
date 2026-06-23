import type { Request, Response } from 'express';
import type { ProfileStore } from '../store/profile-store.js';
import type { SignalStore } from '../store/signal-store.js';
import { classifyIntent } from '../engine/intent.js';

export function createProfilesHandler(profileStore: ProfileStore, signalStore: SignalStore) {
  return function profilesHandler(req: Request, res: Response): void {
    const deviceId = req.params.deviceId;

    // Validate: deviceId param must be non-empty
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length === 0) {
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

    // Build profile (unknown deviceId returns default empty profile — not a 404)
    const profile = profileStore.build(deviceId);
    const intentScores = classifyIntent(profile);
    const signalCount = signalStore.getSignalCount(deviceId);

    res.status(200).json({
      success: true,
      data: {
        profile,
        intentScores,
        signalCount,
      },
    });
  };
}
