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

import { type ContentGraphQLContext, createContext } from './graphql/context';
import { resolvers } from './resolvers';
import { typeDefs } from './schema';
import { logger } from './services/logger';
import { aiPersonalizeStream } from './services/personalization/ai-agent';
import {
  type DecisionRecord,
  featureStore,
} from './services/personalization/feature-store';

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

  app.post('/api/personalize/stream', async (req, res) => {
    const ctx = createContext(req);
    if (!ctx.isAuthorizedClient) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      deviceId,
      surface,
      context: pageContext,
    } = req.body as {
      deviceId?: string;
      surface?: string;
      context?: Record<string, unknown>;
    };

    if (!deviceId || !surface) {
      res.status(400).json({ error: 'deviceId and surface are required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let clientConnected = true;
    req.on('close', () => {
      clientConnected = false;
    });

    try {
      let profile = await featureStore.getOrCreate(deviceId);
      const effectiveUserId = ctx.customerId ?? ctx.authId;
      if (effectiveUserId) {
        profile = await featureStore.mergeToUser(deviceId, effectiveUserId);
      }

      const ctxInput = {
        surface,
        page: String(pageContext?.page ?? '/'),
        productId: pageContext?.productId as string | undefined,
        category: pageContext?.category as string | undefined,
        price: pageContext?.price as number | undefined,
      };

      for await (const event of aiPersonalizeStream(profile, ctxInput)) {
        if (!clientConnected) break;
        if (event.type === 'component') {
          try {
            res.write(
              `data: ${JSON.stringify({ type: 'component', data: event.data })}\n\n`
            );
          } catch {
            break;
          }
        } else if (event.type === 'result') {
          const parsed = JSON.parse(event.data);
          const reasoning = {
            intent: parsed.intent ?? 'exploring',
            confidence: parsed.confidence ?? 0,
            factors: [parsed.overallReasoning ?? ''],
            modelVersion: 'ai-v1',
          };

          // Save decision record for feedback loop
          const record: DecisionRecord = {
            components: [],
            surface,
            intent: reasoning.intent,
            servedAt: Date.now(),
          };
          profile.recentDecisions = [
            record,
            ...(profile.recentDecisions ?? []),
          ].slice(0, 10);
          featureStore
            .save(profile)
            .catch((err: unknown) =>
              logger.warn({ err }, 'Failed to save streaming decision record')
            );

          try {
            res.write(
              `data: ${JSON.stringify({ type: 'result', reasoning })}\n\n`
            );
          } catch {
            break;
          }
        }
      }
    } catch (err) {
      if (clientConnected) {
        logger.error({ err }, 'Streaming personalization error');
        try {
          res.write(
            `data: ${JSON.stringify({ type: 'error', message: 'Personalization failed' })}\n\n`
          );
        } catch {
          /* ignore write errors on closed connection */
        }
      }
    } finally {
      try {
        res.end();
      } catch {
        /* ignore close errors */
      }
    }
  });

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }): Promise<ContentGraphQLContext> =>
        createContext(req),
    })
  );

  const port = process.env.PORT || 4003;
  await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));

  const { address } = httpServer.address() as AddressInfo;
  const hostname = address === '' || address === '::' ? 'localhost' : address;

  logger.info(`Content subgraph server ready at ${hostname}:${port}/graphql`);
}

startServer().catch((error) => {
  logger.error({ err: error }, 'Error starting content subgraph server');
  process.exit(1);
});
