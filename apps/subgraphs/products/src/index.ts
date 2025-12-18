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
import {
  HealthCheck,
  createErrorHandler,
  createLogger,
} from '@gfed-medusa/bff-lib-common';
import type { LogLevel } from '@gfed-medusa/bff-lib-common';
import { resolvers } from '@graphql/resolvers';
import { typeDefs } from '@graphql/schemas';
import { createContext } from '@services/index';

const logger = createLogger({
  serviceName: 'products-subgraph',
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  pretty: process.env.NODE_ENV === 'development',
});

const healthCheck = new HealthCheck('products-subgraph', '1.0.0');
healthCheck.register('self', async () => ({ status: 'healthy' }));

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
          return {
            async didEncounterErrors(requestContext) {
              for (const error of requestContext.errors) {
                logger.error(
                  {
                    err: error,
                    operation: requestContext.request.operationName,
                    variables: requestContext.request.variables,
                    path: error.path,
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

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req, res }) => createContext({ req, res, logger }),
    })
  );

  app.use(createErrorHandler(logger));

  const port = process.env.PORT || 4001;
  await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));

  const { address } = httpServer.address() as AddressInfo;
  const hostname = address === '' || address === '::' ? 'localhost' : address;

  logger.info(
    { port },
    `Products subgraph server ready at ${hostname}:${port}/graphql`
  );
}

startServer().catch((error) => {
  logger.error({ err: error }, 'Error starting products subgraph server');
  process.exit(1);
});
