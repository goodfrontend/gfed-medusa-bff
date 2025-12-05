import type express from 'express';

import Medusa from '@medusajs/js-sdk';

export type GraphQLContext = {
  req: express.Request;
  res: express.Response;
  medusa: Medusa;
};
