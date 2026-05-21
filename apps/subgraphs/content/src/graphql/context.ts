import type express from 'express';

export type ContentGraphQLContext = {
  req: express.Request;
  isAuthorizedClient: boolean;
};
