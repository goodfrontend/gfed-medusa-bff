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
  type Identity @key(fields: "id") {
    id: ID!
    title: String!
  }

  type Query {
    identities: [Identity!]!
  }
`;

const resolvers = {
  Query: {
    identities: () => [
      { id: '1', title: 'Test Identity' },
      { id: '2', title: 'Another Identity' },
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
