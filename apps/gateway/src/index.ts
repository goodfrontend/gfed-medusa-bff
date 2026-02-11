import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';

import {
  ApolloGateway,
  IntrospectAndCompose,
  RemoteGraphQLDataSource,
  SupergraphSdlUpdateFunction,
  type ServiceEndpointDefinition,
} from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express5';

import { sessionConfig } from './config/session';
import { sessionUpdatePlugin } from './plugins/sessionUpdate';

const isDev = process.env.NODE_ENV !== 'production';
const supergraphSdlUrl = process.env.SUPERGRAPH_SDL_URL?.trim();
const supergraphReloadToken = process.env.SUPERGRAPH_RELOAD_TOKEN;
const supergraphSdlToken = process.env.SUPERGRAPH_SDL_TOKEN;
const useRegistry = Boolean(supergraphSdlUrl);

const POLL_INTERVAL = 10000;
const SUPERGRAPH_FETCH_TIMEOUT_MS = 10000;
const RELOAD_ROUTE = '/admin/reload-supergraph';

async function fetchSupergraphSdl(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPERGRAPH_FETCH_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {};
    if (supergraphSdlToken) {
      headers.Authorization = `Bearer ${supergraphSdlToken}`;
      headers.Accept = 'application/vnd.github.raw';
    }

    const response = await fetch(url, { signal: controller.signal, headers });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch supergraph SDL: ${response.status} ${response.statusText}`
      );
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function isReloadAuthorized(req: express.Request) {
  if (!supergraphReloadToken) {
    return isDev;
  }

  const tokenHeader = req.header('authorization');
  if (!tokenHeader || !tokenHeader.startsWith('Bearer ')) {
    return false;
  }

  return tokenHeader.slice('Bearer '.length) === supergraphReloadToken;
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  let updateSupergraphSdl: SupergraphSdlUpdateFunction | null = null;
  let lastReloadAt: string | null = null;
  let lastReloadError: string | null = null;
  const buildService = ({ name, url }: ServiceEndpointDefinition) => {
    if (!url) {
      throw new Error(`Missing URL for subgraph "${name}".`);
    }

    return new RemoteGraphQLDataSource({
      url,
      willSendRequest({ request, context }) {
        // Pass cookie and session data to subgraphs
        if (context.req?.headers.cookie) {
          request.http?.headers.set('cookie', context.req.headers.cookie);
        }

        if (context.session) {
          request.http?.headers.set('x-session-data', JSON.stringify(context.session));
        }
      },
    });
  };

  const gateway = useRegistry
    ? new ApolloGateway({
        supergraphSdl: {
          async initialize({ update }) {
            updateSupergraphSdl = update;
            const supergraphSdl = await fetchSupergraphSdl(supergraphSdlUrl!);
            lastReloadAt = new Date().toISOString();
            lastReloadError = null;
            return { supergraphSdl };
          },
        },
        buildService,
      })
    : new ApolloGateway({
        supergraphSdl: new IntrospectAndCompose({
          subgraphs: [
            {
              name: 'products',
              url: process.env.PRODUCTS_URL || 'http://localhost:4001/graphql',
            },
            {
              name: 'customers',
              url: process.env.CUSTOMERS_URL || 'http://localhost:4002/graphql',
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
          ...(isDev && { pollIntervalInMs: POLL_INTERVAL }),
        }),
        buildService,
      });

  const server = new ApolloServer({
    gateway,
    introspection: isDev,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      sessionUpdatePlugin,
    ],
  });

  await server.start();

  const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',');

  app.use(
    cors<cors.CorsRequest>({
      origin: allowedOrigins,
      credentials: true,
    })
  );
  app.use(sessionConfig);
  app.use(express.json());
  if (useRegistry) {
    app.get(RELOAD_ROUTE, (req, res) => {
      if (!isReloadAuthorized(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      res.status(200).json({
        status: 'ok',
        initialized: Boolean(updateSupergraphSdl),
        lastReloadAt,
        lastReloadError,
        supergraphSdlUrl,
      });
    });

    app.post(RELOAD_ROUTE, async (req, res) => {
      if (!isReloadAuthorized(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!updateSupergraphSdl) {
        res.status(503).json({ error: 'Supergraph updater not initialized' });
        return;
      }

      try {
        const supergraphSdl = await fetchSupergraphSdl(supergraphSdlUrl!);
        updateSupergraphSdl(supergraphSdl);
        lastReloadAt = new Date().toISOString();
        lastReloadError = null;
        res.status(200).json({ status: 'reloaded' });
      } catch (error) {
        console.error('Failed to reload supergraph:', error);
        lastReloadError = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to reload supergraph' });
      }
    });
  }
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req, res }) => ({ req, res, session: req.session }),
    })
  );

  const port = process.env.PORT || 4000;
  await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));

  const { address } = httpServer.address() as AddressInfo;
  const hostname = address === '' || address === '::' ? 'localhost' : address;

  console.log(`🚀 Gateway ready at ${hostname}:${port}/graphql`);

  process.on('SIGTERM', () => {
    console.log('Shutting down...');
    httpServer.close(() => process.exit(0));
  });
}

startServer().catch((err) => {
  console.error('Failed to start gateway:', err);
  process.exit(1);
});
