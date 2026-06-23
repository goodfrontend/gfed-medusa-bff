import type { Request, Response } from 'express';

export function healthHandler(req: Request, res: Response): void {
  res.json({
    status: 'healthy',
    service: 'mock-personalization',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
}
