import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { SignalStore } from './store/signal-store.js';
import type { ProfileStore } from './store/profile-store.js';
import { createRouter } from './routes/index.js';

export function createApp(signalStore: SignalStore, profileStore: ProfileStore): Express {
  const app = express();

  // Middleware
  app.use(cors({ origin: process.env['CORS_ORIGIN'] ?? '*' }));
  app.use(express.json({ strict: false }));

  // Routes
  app.use(createRouter(signalStore, profileStore));

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route not found: ${req.method} ${req.path}`,
      },
    });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  void _next;
    // Body-parser errors (malformed JSON, etc.)
    if ('status' in err && typeof (err as Record<string, unknown>).status === 'number') {
      const status = (err as Record<string, unknown>).status as number;
      if (status === 400) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be JSON',
          },
        });
        return;
      }
    }

    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  return app;
}
