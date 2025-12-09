import type express from 'express';

import { GraphQLContext } from '@graphql/types/context';
import Medusa from '@medusajs/js-sdk';

export function createContext({
  req,
  res,
}: {
  req: express.Request;
  res: express.Response;
}): GraphQLContext {
  const createMedusa = () => {
    const medusa = new Medusa({
      baseUrl: process.env.MEDUSA_API_URL || 'http://localhost:9000',
      globalHeaders: {
        'X-Publishable-API-Key':
          process.env.MEDUSA_PUBLISHABLE_KEY || 'pk_test',
      },
    });

    return medusa;
  };

  const medusa = createMedusa();

  return {
    req,
    res,
    medusa,
  };
}
