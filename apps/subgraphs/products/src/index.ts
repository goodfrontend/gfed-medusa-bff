import cors from 'cors';
import express from 'express';
import gql from 'graphql-tag';
import http from 'http';

import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { expressMiddleware } from '@as-integrations/express5';

const typeDefs = gql`
  type Product @key(fields: "id") {
    id: ID!
    title: String!
  }

  type Query {
    products: [Product!]!
  }
`;

const resolvers = {
  Query: {
    products: () => [
      { id: '1', title: 'Test Product' },
      { id: '2', title: 'Another Product' },
    ],
  },
};

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

  app.use('/graphql', expressMiddleware(server));

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: 4001 }, resolve)
  );

  console.log(
    `Products subgraph server ready at http://localhost:4001/graphql`
  );
}

startServer().catch((error) => {
  console.error('Error starting products subgraph server:', error);
  process.exit(1);
});
