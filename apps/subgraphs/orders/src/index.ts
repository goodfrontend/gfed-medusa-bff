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
  type Order @key(fields: "id") {
    id: ID!
    title: String!
  }

  type Query {
    orders: [Order!]!
  }
`;

const resolvers = {
  Query: {
    orders: () => [
      { id: '1', title: 'Test Order' },
      { id: '2', title: 'Another Order' },
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
    httpServer.listen({ port: 4004 }, resolve)
  );

  console.log(`Orders subgraph server ready at http://localhost:4004/graphql`);
}

startServer().catch((error) => {
  console.error('Error starting orders subgraph server:', error);
  process.exit(1);
});
