import type express from 'express';

export type ContentGraphQLContext = {
  req: express.Request;
  isAuthorizedClient: boolean;
  authId?: string;
  customerId?: string;
  medusaToken?: string;
};

function parseSessionData(req: express.Request): Record<string, unknown> {
  const raw = req.headers['x-session-data'];
  if (typeof raw !== 'string') return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function createContext(req: express.Request): ContentGraphQLContext {
  const session = parseSessionData(req);
  return {
    req,
    isAuthorizedClient:
      !!process.env.BFF_API_KEY &&
      req.headers['x-bff-api-key'] === process.env.BFF_API_KEY,
    authId: session.authId as string | undefined,
    customerId: session.customerId as string | undefined,
    medusaToken: session.medusaToken as string | undefined,
  };
}
