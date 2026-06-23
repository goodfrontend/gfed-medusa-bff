import { Router } from 'express';
import type { SignalStore } from '../store/signal-store.js';
import type { ProfileStore } from '../store/profile-store.js';
import { createSignalsHandler } from './signals.js';
import { createPersonalizeHandler } from './personalize.js';
import { createProfilesHandler } from './profiles.js';
import { healthHandler } from './health.js';
import { docsRouter } from './docs.js';

export function createRouter(signalStore: SignalStore, profileStore: ProfileStore): Router {
  const router = Router();

  // Docs (mounted before 404 handler)
  router.use(docsRouter);

  // Health
  router.get('/health', healthHandler);

  router.post('/api/signals', createSignalsHandler(signalStore));
  router.post('/api/personalize', createPersonalizeHandler(profileStore));
  router.get('/api/profiles/:deviceId', createProfilesHandler(profileStore, signalStore));

  return router;
}
