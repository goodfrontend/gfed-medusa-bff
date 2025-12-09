import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { Session, SessionData } from 'express-session';
import http from 'http';

import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { expressMiddleware } from '@as-integrations/express5';

import { customerResolvers } from './graphql/resolvers';
import { typeDefs } from './graphql/schemas';
import { createContext } from './services';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    schema: buildSubgraphSchema([{ typeDefs, resolvers: customerResolvers }]),
    plugins: [
      ...(process.env.NODE_ENV !== 'production'
        ? [ApolloServerPluginLandingPageLocalDefault()]
        : []),
      ApolloServerPluginDrainHttpServer({ httpServer }),
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

        console.log('CUSTOMERS: Incoming', { session });

        return createContext({ req, res, session });
      },
    })
  );

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: 4002 }, resolve)
  );

  console.log(
    `Identity subgraph server ready at http://localhost:4002/graphql`
  );
}

startServer().catch((error) => {
  console.error('Error starting identity subgraph server:', error);
  process.exit(1);
});
