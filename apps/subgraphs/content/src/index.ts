import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';

import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { expressMiddleware } from '@as-integrations/express5';

import { logger } from './services/logger';

import type { ContentGraphQLContext } from './graphql/context';
import { startFlushSignalsJob } from './jobs/flush-signals';
import { resolvers } from './resolvers';
import { typeDefs } from './schema';

const DEPLOY_MARKER = 'gateway-deploy-check-2026-03-18-r3';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer<ContentGraphQLContext>({
    schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
    plugins: [
      ...(process.env.NODE_ENV !== 'production'
        ? [ApolloServerPluginLandingPageLocalDefault()]
        : []),
      ApolloServerPluginDrainHttpServer({ httpServer }),
    ],
    introspection: process.env.NODE_ENV !== 'production',
  });

  await server.start();

  app.use(cors<cors.CorsRequest>());

  app.use(express.json());

  app.get('/health/live', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'content-subgraph',
      deployMarker: DEPLOY_MARKER,
      timestamp: new Date().toISOString(),
    });
  });

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }): Promise<ContentGraphQLContext> => ({
        req,
        isAuthorizedClient:
          !!process.env.BFF_API_KEY &&
          req.headers['x-bff-api-key'] === process.env.BFF_API_KEY,
      }),
    })
  );

  const port = process.env.PORT || 4003;
  await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));

  if (process.env.REDIS_URL?.trim()) {
    startFlushSignalsJob();
  } else {
    logger.warn(
      '[content-subgraph] REDIS_URL not set — personalization flush job disabled'
    );
  }

  const { address } = httpServer.address() as AddressInfo;
  const hostname = address === '' || address === '::' ? 'localhost' : address;

  logger.info(`Content subgraph server ready at ${hostname}:${port}/graphql`);
}

startServer().catch((error) => {
  logger.error({ err: error }, 'Error starting content subgraph server');
  process.exit(1);
});
