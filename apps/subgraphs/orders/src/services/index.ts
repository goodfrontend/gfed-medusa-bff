import type express from 'express';
import { Session, SessionData } from 'express-session';

import { GraphQLContext } from '@graphql/types/context';
import Medusa from '@medusajs/js-sdk';

export function createContext({
  req,
  res,
  session,
}: {
  req: express.Request;
  res: express.Response;
  session: (Session & Partial<SessionData>) | null;
}): GraphQLContext {
  const createMedusa = (session: (Session & Partial<SessionData>) | null) => {
    const medusaToken = session?.medusaToken;

    const medusa = new Medusa({
      baseUrl: process.env.MEDUSA_API_URL || 'http://localhost:9000',
      globalHeaders: {
        'x-publishable-api-key':
          process.env.MEDUSA_PUBLISHABLE_KEY || 'pk_test',
        ...(medusaToken
          ? { Authorization: `Bearer ${medusaToken}` }
          : undefined),
      },
    });

    if (medusaToken) medusa.client.setToken(medusaToken);

    return medusa;
  };

  const medusa = createMedusa(session);

  return {
    req,
    res,
    session: session ?? undefined,
    medusa,
  };
}
