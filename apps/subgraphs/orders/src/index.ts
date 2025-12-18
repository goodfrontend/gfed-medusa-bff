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
import { resolvers } from '@graphql/resolvers';
import { typeDefs } from '@graphql/schemas';
import { createContext } from '@services/index';

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
    ],
    introspection: process.env.NODE_ENV !== 'production',
  });

  await server.start();

  app.use(cors<cors.CorsRequest>());

  app.use(express.json());

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req, res }) => createContext({ req, res }),
    })
  );

  const port = process.env.PORT || 4004;
  await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));

  const { address } = httpServer.address() as AddressInfo;
  const hostname = address === '' || address === '::' ? 'localhost' : address;

  console.log(`Orders subgraph server ready at ${hostname}:${port}/graphql`);
}

startServer().catch((error) => {
  console.error('Error starting orders subgraph server:', error);
  process.exit(1);
});
