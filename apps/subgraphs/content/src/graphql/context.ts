import type express from 'express';

type SessionData = {
  authId?: string;
  medusaToken?: string;
};

function parseSessionData(req: express.Request): SessionData {
  const raw = req.headers['x-session-data'];
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return {
      authId: parsed.authId,
      medusaToken: parsed.medusaToken,
    };
  } catch {
    return {};
  }
}

export type ContentGraphQLContext = {
  req: express.Request;
  isAuthorizedClient: boolean;
  authId?: string;
  medusaToken?: string;
};

export function createContext(req: express.Request): ContentGraphQLContext {
  const session = parseSessionData(req);
  return {
    req,
    isAuthorizedClient:
      !!process.env.BFF_API_KEY &&
      req.headers['x-bff-api-key'] === process.env.BFF_API_KEY,
    authId: session.authId,
    medusaToken: session.medusaToken,
  };
}
