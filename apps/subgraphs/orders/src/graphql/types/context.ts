import type express from 'express';
import { Session, SessionData } from 'express-session';

import Medusa from '@medusajs/js-sdk';

export type GraphQLContext = {
  req: express.Request;
  res: express.Response;
  session?: Session & Partial<SessionData>;
  medusa: Medusa;
};
