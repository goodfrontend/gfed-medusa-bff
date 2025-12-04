import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import http from 'http';

import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express5';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: [
        {
          name: 'products',
          url: process.env.PRODUCTS_URL || 'http://localhost:4001/graphql',
        },
        {
          name: 'identity',
          url: process.env.IDENTITY_URL || 'http://localhost:4002/graphql',
        },
        {
          name: 'content',
          url: process.env.CONTENT_URL || 'http://localhost:4003/graphql',
        },
        {
          name: 'orders',
          url: process.env.ORDERS_URL || 'http://localhost:4004/graphql',
        },
      ],
    }),
  });

  const server = new ApolloServer({
    gateway,
    introspection: process.env.NODE_ENV !== 'production',
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.use(cors());
  app.use(express.json());
  app.use('/graphql', expressMiddleware(server));

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: 4000 }, resolve)
  );

  console.log(`🚀 Gateway ready at http://localhost:4000/graphql`);

  process.on('SIGTERM', () => {
    console.log('Shutting down...');
    httpServer.close(() => process.exit(0));
  });
}

startServer().catch((err) => {
  console.error('Failed to start gateway:', err);
  process.exit(1);
});
