import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { Session, SessionData } from 'express-session';
import http from 'http';
import type { AddressInfo } from 'net';

import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { expressMiddleware } from '@as-integrations/express5';
import { createErrorHandler } from '@gfed-medusa/bff-lib-common';
import { healthCheck } from '@services/health-check';
import { logger } from '@services/logger';

import { resolvers } from './graphql/resolvers';
import { typeDefs } from './graphql/schemas';
import { createContext } from './services';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
    plugins: [
      ...(process.env.NODE_ENV !== 'production'
        ? [ApolloServerPluginLandingPageLocalDefault()]
        : []),
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async requestDidStart() {
          const start = Date.now();
          return {
            async willSendResponse(requestContext) {
              const duration = Date.now() - start;
              logger.info(
                {
                  operation: requestContext.request.operationName,
                  duration,
                },
                'GraphQL request completed'
              );
            },
            async didEncounterErrors(requestContext) {
              for (const error of requestContext.errors) {
                logger.error(
                  {
                    err: error,
                    operation: requestContext.request.operationName,
                    variables: requestContext.request.variables,
                  },
                  'GraphQL error occurred'
                );
              }
            },
          };
        },
      },
    ],
    introspection: process.env.NODE_ENV !== 'production',
  });

  await server.start();

  const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',');

  app.use(
    cors<cors.CorsRequest>({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  app.use(express.json());

  app.get('/health', healthCheck.getHandler());
  app.get('/health/live', (_, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'customers-subgraph',
      timestamp: new Date().toISOString(),
    });
  });

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req, res }) => {
        let session: (Session & Partial<SessionData>) | null = null;

        // Retrieve session data from gateway
        if (req.headers['x-session-data']) {
          try {
            session = JSON.parse(req.headers['x-session-data'] as string);
          } catch (e) {
            session = {} as Session;
          }
        }

        return createContext({ req, res, session });
      },
    })
  );

  app.use(createErrorHandler(logger));

  const port = process.env.PORT || 4002;

  await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));

  const { address } = httpServer.address() as AddressInfo;
  const hostname = address === '' || address === '::' ? 'localhost' : address;

  logger.info(
    { port, env: process.env.NODE_ENV },
    `Products subgraph ready at ${hostname}:${port}/graphql`
  );

  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });
}

startServer().catch((error) => {
  logger.error({ err: error }, 'Failed to start customers subgraph');
  process.exit(1);
});
