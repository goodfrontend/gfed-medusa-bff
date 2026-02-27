import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import { AsyncLocalStorage } from 'node:async_hooks';

import {
  ApolloGateway,
  IntrospectAndCompose,
  RemoteGraphQLDataSource,
  type ServiceEndpointDefinition,
  SupergraphSdlUpdateFunction,
} from '@apollo/gateway';
import type {
  ApolloServerPlugin,
  GraphQLRequestListener,
} from '@apollo/server';
import { ApolloServer } from '@apollo/server';
import responseCachePlugin from '@apollo/server-plugin-response-cache';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import type { KeyValueCacheSetOptions } from '@apollo/utils.keyvaluecache';
import { expressMiddleware } from '@as-integrations/express5';
import Medusa from '@medusajs/js-sdk';

import { responseCache } from './config/cache';
import { client, getOpenIdConfigs, getPKCE } from './config/openid';
import { sessionConfig } from './config/session';
import { sessionUpdatePlugin } from './plugins/sessionUpdate';

type GatewayContext = {
  req: express.Request;
  res: express.Response;
  session: express.Request['session'];
};

const isDev = process.env.NODE_ENV !== 'production';
const supergraphSdlUrl = process.env.SUPERGRAPH_SDL_URL?.trim();
const supergraphReloadToken = process.env.SUPERGRAPH_RELOAD_TOKEN;
const supergraphSdlToken = process.env.SUPERGRAPH_SDL_TOKEN;
const useRegistry = Boolean(supergraphSdlUrl);

const POLL_INTERVAL = 10000;
const SUPERGRAPH_FETCH_TIMEOUT_MS = 10000;
const RELOAD_ROUTE = '/admin/reload-supergraph';
const DEPLOY_MARKER = 'prod-region-check-2026-02-27-r2';

async function fetchSupergraphSdl(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    SUPERGRAPH_FETCH_TIMEOUT_MS
  );

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
          request.http?.headers.set(
            'x-session-data',
            JSON.stringify(context.session)
          );
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

  const cacheContext = new AsyncLocalStorage<{ cacheHit: boolean }>();

  const baseCache = responseCache;
  const responseCacheWithTracking =
    baseCache && process.env.CACHE_DEBUG === 'true'
      ? {
          async get(key: string) {
            const value = await baseCache.get(key);
            const store = cacheContext.getStore();
            if (store && value !== undefined && value !== null) {
              store.cacheHit = true;
            }
            return value;
          },
          async set(
            key: string,
            value: string,
            options?: KeyValueCacheSetOptions
          ) {
            return baseCache.set(key, value, options);
          },
          async delete(key: string) {
            return baseCache.delete(key);
          },
        }
      : baseCache;

  const cacheDebugPlugin: ApolloServerPlugin<GatewayContext> = {
    async requestDidStart(): Promise<GraphQLRequestListener<GatewayContext> | void> {
      if (process.env.CACHE_DEBUG !== 'true') return;
      cacheContext.enterWith({ cacheHit: false });
      return {
        async willSendResponse({ contextValue }) {
          const store = cacheContext.getStore();
          if (contextValue?.res && store) {
            contextValue.res.setHeader(
              'x-cache',
              store.cacheHit ? 'HIT' : 'MISS'
            );
          }
        },
      };
    },
  };

  const server = new ApolloServer<GatewayContext>({
    gateway,
    introspection: isDev,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      sessionUpdatePlugin,
      responseCachePlugin({
        cache: responseCacheWithTracking,
        sessionId: async ({ contextValue }) =>
          contextValue.req.sessionID ?? null,
      }),
      cacheDebugPlugin,
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

  app.get('/health/live', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'gateway',
      deployMarker: DEPLOY_MARKER,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/auth/login', async (req, res) => {
    const { codeChallenge, codeVerifier } = await getPKCE();
    const { redirectTo, parameters } = await getOpenIdConfigs({
      codeChallenge,
    });

    // Save PKCE details to session (will need on auth callback)
    req.session.pkce = { codeVerifier, codeChallenge, nonce: parameters.nonce };

    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );

    res.redirect(redirectTo.toString());
  });

  app.get('/auth/callback', async (req, res) => {
    const currentUrl = new URL(`${process.env.BFF_URL}${req.url}`);

    const { codeChallenge, codeVerifier, nonce } = { ...req.session.pkce };
    const { config } = await getOpenIdConfigs({
      codeChallenge: codeChallenge!,
      nonce: nonce!,
    });

    let tokens:
      | (client.TokenEndpointResponse & client.TokenEndpointResponseHelpers)
      | undefined = undefined;

    try {
      tokens = await client.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedNonce: nonce,
        idTokenExpected: true,
      });
    } catch (e) {
      res.status(500).json({
        error: 'There was an error with the authorization code grant flow',
        message: JSON.stringify(e),
      });
    }

    const { id_token: idToken, access_token: accessToken } = { ...tokens };

    if (!idToken || typeof idToken !== 'string') {
      throw new Error(`Invalid id_token: ${idToken}`);
    }

    const claims = tokens?.claims();

    const { sub } = { ...claims };

    let emailAddress: string | undefined;
    let firstName: string | undefined;
    let lastName: string | undefined;

    if (sub) {
      const userInfo = await client.fetchUserInfo(config, accessToken!, sub);

      const { given_name, family_name, email } = { ...userInfo };

      firstName = given_name;
      lastName = family_name;
      emailAddress = email;
    }

    const medusa = new Medusa({
      baseUrl: process.env.MEDUSA_API_URL || 'http://localhost:9000',
      globalHeaders: {
        'X-Publishable-API-Key':
          process.env.MEDUSA_PUBLISHABLE_KEY || 'pk_test',
      },
    });

    let medusaRes: unknown = undefined;

    try {
      // Retrieve or create Medusa customer + create Medusa JWT for user
      medusaRes = await medusa.client.fetch('/store/external-oidc', {
        method: 'POST',
        body: {
          idToken,
        },
      });
    } catch (e) {
      res.status(500).json({
        error: 'There was an error fetching JWT from Medusa',
        message: JSON.stringify(e),
      });
    }

    const medusaToken = (medusaRes as { token?: string }).token;

    // Add session information + persist
    req.session.authId = sub;
    req.session.user = { email: emailAddress, firstName, lastName };
    req.session.medusaToken = medusaToken as string;
    req.session.isCustomerLoggedIn = true;

    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );

    // Redirect back to storefront after successful login
    res.redirect(process.env.STOREFRONT_URL || 'http://localhost:8080');
  });

  app.get('/auth/logout', async (req, res) => {
    const { codeChallenge, nonce } = { ...req.session.pkce };

    const { config } = await getOpenIdConfigs({
      codeChallenge: codeChallenge!,
      nonce: nonce!,
    });

    let logoutUri: URL | undefined;

    try {
      logoutUri = client.buildEndSessionUrl(config);
    } catch (e) {
      res.status(500).json({
        error: 'There was an error building the logout URL',
        message: JSON.stringify(e),
      });
    }

    res.redirect(logoutUri?.toString() ?? '/');
  });

  app.get('/auth/logout-callback', async (req, res) => {
    req.session.medusaToken = undefined;
    req.session.isCustomerLoggedIn = undefined;
    req.session.pkce = undefined;
    req.session.authId = undefined;

    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) reject(err);
        else {
          res.clearCookie('storefront.sid', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24,
          });
          resolve();
        }
      });
    });

    res.redirect(process.env.STOREFRONT_URL ?? 'http://localhost:8000');
  });

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
        lastReloadError =
          error instanceof Error ? error.message : 'Unknown error';
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
