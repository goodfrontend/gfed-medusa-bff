# @gfed-medusa/bff-lib-common

Shared observability utilities for the GFED Medusa BFF monorepo, including logging, error handling, and health checks.

## Installation

Install the package from npm:

```bash
pnpm add @gfed-medusa/bff-lib-common
```

For monorepo or local development (to use what's latest), you can use workspace dependencies:

```json
{
  "dependencies": {
    "@gfed-medusa/bff-lib-common": "workspace:*"
  }
}
```

## Usage

### Logger

Create a structured logger for your subgraph:

```typescript
import { createLogger, createChildLogger, type LogLevel } from '@gfed-medusa/bff-lib-common';

// Initialize logger for your subgraph
const logger = createLogger({
  serviceName: 'products-subgraph',
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  pretty: process.env.NODE_ENV === 'development',
});

// Basic logging
logger.info('Products subgraph starting');
logger.info({ port: 4001 }, 'Server listening on port 4001');

// Logging in resolvers
const resolvers = {
  Query: {
    products: () => {
      logger.info('Fetching all products');
      return productService.getAll();
    },
    product: (_: unknown, { id }: { id: string }) => {
      logger.info({ productId: id }, 'Fetching product by ID');
      return productService.getById(id);
    },
  },
};

// Child logger with request context
app.use((req, res, next) => {
  req.logger = createChildLogger(logger, {
    requestId: req.headers['x-request-id'] || crypto.randomUUID(),
    path: req.path,
  });
  next();
});
```

### Error Handling

Handle errors consistently across your subgraph:

```typescript
import {
  NotFoundError,
  ValidationError,
  createErrorHandler,
  asyncHandler
} from '@gfed-medusa/bff-lib-common';

// In your GraphQL resolvers
const resolvers = {
  Query: {
    product: (_: unknown, { id }: { id: string }) => {
      if (!id || id.trim() === '') {
        throw new ValidationError('Product ID is required');
      }

      const product = productService.getById(id);
      if (!product) {
        throw new NotFoundError('Product not found', { productId: id });
      }

      return product;
    },
  },
};
```

### Health Checks

Add health check endpoints for monitoring:

```typescript
import { HealthCheck, checkHttpEndpoint } from '@gfed-medusa/bff-lib-common';

// Create health check with custom checks
const healthCheck = new HealthCheck('products-subgraph', '1.0.0');

// Check database connection
healthCheck.register('database', async () => {
  try {
    await productService.healthCheck(); // or db.ping()
    return { status: 'healthy' };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database check failed'
    };
  }
});

// Check external Medusa API
healthCheck.register('medusa-api', async () => {
  return await checkHttpEndpoint(
    process.env.MEDUSA_API_URL + '/health',
    5000 // 5 second timeout
  );
});

// Add health endpoints
app.get('/health', healthCheck.getHandler());

// Simple liveness probe (always returns healthy if app is running)
app.get('/health/live', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'products-subgraph',
    timestamp: new Date().toISOString()
  });
});
```

## Complete Integration Examples

### Products Subgraph with Full Observability

Here's a complete, production-ready example of the products subgraph with all observability features:

```typescript
import cors from 'cors';
import express from 'express';
import gql from 'graphql-tag';
import http from 'http';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { expressMiddleware } from '@as-integrations/express5';
import {
  createLogger,
  createErrorHandler,
  NotFoundError,
  ValidationError,
  HealthCheck,
  checkHttpEndpoint,
} from '@gfed-medusa/bff-lib-common';

// Initialize logger
const logger = createLogger({
  serviceName: 'products-subgraph',
  level: process.env.LOG_LEVEL || 'info',
  pretty: process.env.NODE_ENV === 'development',
});

// GraphQL Schema for Medusa products
const typeDefs = gql`
  type Product @key(fields: "id") {
    id: ID!
    title: String!
    description: String
    thumbnail: String
    handle: String!
    status: ProductStatus!
  }

  enum ProductStatus {
    draft
    published
    rejected
  }

  type Query {
    products(limit: Int = 10, offset: Int = 0): [Product!]!
    product(id: ID!): Product
    productByHandle(handle: String!): Product
  }
`;

// Product service (simulated - replace with actual Medusa API calls)
const productService = {
  async getAll(limit: number, offset: number) {
    logger.info({ limit, offset }, 'Fetching products from Medusa');
    // Replace with: await medusaClient.products.list({ limit, offset })
    return [
      { id: 'prod_1', title: 'T-Shirt', handle: 't-shirt', status: 'published' },
      { id: 'prod_2', title: 'Hoodie', handle: 'hoodie', status: 'published' },
    ];
  },

  async getById(id: string) {
    logger.info({ productId: id }, 'Fetching product by ID');
    // Replace with: await medusaClient.products.retrieve(id)
    const products = await this.getAll(100, 0);
    return products.find(p => p.id === id);
  },

  async getByHandle(handle: string) {
    logger.info({ handle }, 'Fetching product by handle');
    // Replace with: await medusaClient.products.list({ handle })
    const products = await this.getAll(100, 0);
    return products.find(p => p.handle === handle);
  },
};

const resolvers = {
  Query: {
    products: async (_: unknown, { limit, offset }: { limit: number; offset: number }) => {
      if (limit < 1 || limit > 100) {
        throw new ValidationError('Limit must be between 1 and 100', { limit });
      }
      if (offset < 0) {
        throw new ValidationError('Offset must be non-negative', { offset });
      }

      return await productService.getAll(limit, offset);
    },

    product: async (_: unknown, { id }: { id: string }) => {
      if (!id || id.trim() === '') {
        throw new ValidationError('Product ID is required');
      }

      const product = await productService.getById(id);
      if (!product) {
        throw new NotFoundError('Product not found', { productId: id });
      }

      return product;
    },

    productByHandle: async (_: unknown, { handle }: { handle: string }) => {
      if (!handle || handle.trim() === '') {
        throw new ValidationError('Product handle is required');
      }

      const product = await productService.getByHandle(handle);
      if (!product) {
        throw new NotFoundError('Product not found', { handle });
      }

      return product;
    },
  },
};

// Health checks
const healthCheck = new HealthCheck('products-subgraph', '1.0.0');

// Check Medusa API connection
healthCheck.register('medusa-api', async () => {
  const medusaUrl = process.env.MEDUSA_API_URL || 'http://localhost:9000';
  return await checkHttpEndpoint(`${medusaUrl}/health`, 5000);
});

// Check database if using direct DB connection
healthCheck.register('database', async () => {
  try {
    // await db.raw('SELECT 1')
    return { status: 'healthy' };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database check failed'
    };
  }
});

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  app.use(cors<cors.CorsRequest>());
  app.use(express.json());

  // Health endpoints
  app.get('/health', healthCheck.getHandler());
  app.get('/health/live', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'products-subgraph',
      timestamp: new Date().toISOString()
    });
  });

  // Apollo Server
  const server = new ApolloServer({
    schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ...(process.env.NODE_ENV === 'development'
        ? [ApolloServerPluginLandingPageLocalDefault()]
        : []),
      {
        async requestDidStart() {
          const start = Date.now();
          return {
            async willSendResponse(requestContext) {
              const duration = Date.now() - start;
              logger.info(
                {
                  operation: requestContext.request.operationName,
                  duration,
                },
                'GraphQL request completed'
              );
            },
            async didEncounterErrors(requestContext) {
              for (const error of requestContext.errors) {
                logger.error(
                  {
                    err: error,
                    operation: requestContext.request.operationName,
                    variables: requestContext.request.variables,
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
  app.use('/graphql', expressMiddleware(server));

  // Error handler (must be last)
  app.use(createErrorHandler(logger));

  const port = process.env.PORT || 4001;
  await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));

  logger.info(
    { port, env: process.env.NODE_ENV },
    `Products subgraph ready at http://localhost:${port}/graphql`
  );

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });
}

startServer().catch((error) => {
  logger.error({ err: error }, 'Failed to start products subgraph');
  process.exit(1);
});
```
### Gateway Integration

Example of using observability in the Apollo Gateway:

```typescript
import express from 'express';
import http from 'http';
import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express5';
import {
  createLogger,
  createErrorHandler,
  HealthCheck,
  checkHttpEndpoint,
} from '@gfed-medusa/bff-lib-common';

const logger = createLogger({
  serviceName: 'gateway',
  level: process.env.LOG_LEVEL || 'info',
  pretty: process.env.NODE_ENV === 'development',
});

// Health checks for all subgraphs
const healthCheck = new HealthCheck('gateway', '1.0.0');

healthCheck.register('products-subgraph', async () => {
  return await checkHttpEndpoint(
    process.env.PRODUCTS_URL + '/health',
    5000
  );
});

healthCheck.register('identity-subgraph', async () => {
  return await checkHttpEndpoint(
    process.env.IDENTITY_URL + '/health',
    5000
  );
});

healthCheck.register('content-subgraph', async () => {
  return await checkHttpEndpoint(
    process.env.CONTENT_URL + '/health',
    5000
  );
});

healthCheck.register('orders-subgraph', async () => {
  return await checkHttpEndpoint(
    process.env.ORDERS_URL + '/health',
    5000
  );
});

async function startGateway() {
  const app = express();
  const httpServer = http.createServer(app);

  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: [
        { name: 'products', url: process.env.PRODUCTS_URL || 'http://localhost:4001/graphql' },
        { name: 'identity', url: process.env.IDENTITY_URL || 'http://localhost:4002/graphql' },
        { name: 'content', url: process.env.CONTENT_URL || 'http://localhost:4003/graphql' },
        { name: 'orders', url: process.env.ORDERS_URL || 'http://localhost:4004/graphql' },
      ],
    }),
  });

  const server = new ApolloServer({
    gateway,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async requestDidStart() {
          const start = Date.now();
          return {
            async willSendResponse(requestContext) {
              const duration = Date.now() - start;
              logger.info(
                {
                  operation: requestContext.request.operationName,
                  duration,
                },
                'Gateway request completed'
              );
            },
            async didEncounterErrors(requestContext) {
              for (const error of requestContext.errors) {
                logger.error(
                  {
                    err: error,
                    operation: requestContext.request.operationName,
                  },
                  'Gateway error occurred'
                );
              }
            },
          };
        },
      },
    ],
  });

  await server.start();

  app.use(express.json());
  app.get('/health', healthCheck.getHandler());
  app.use('/graphql', expressMiddleware(server));
  app.use(createErrorHandler(logger));

  const port = process.env.PORT || 4000;
  await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));

  logger.info({ port }, 'Gateway ready at http://localhost:' + port + '/graphql');

  process.on('SIGTERM', () => {
    logger.info('Shutting down gateway');
    httpServer.close(() => process.exit(0));
  });
}

startGateway().catch((error) => {
  logger.error({ err: error }, 'Failed to start gateway');
  process.exit(1);
});
```

### Environment Variables

```bash
# Logging
LOG_LEVEL=info

# Server
PORT=4001
NODE_ENV=development
```

## Publishing

To publish to npm:

```bash
cd packages/lib-common
npm version patch  # or minor, major
npm publish
```

## API Reference

### Exported Types

#### `LogLevel`

Type for log levels:

```typescript
type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
```

**Usage:**
```typescript
import type { LogLevel } from '@gfed-medusa/bff-lib-common';

const level = (process.env.LOG_LEVEL as LogLevel) || 'info';
```

### Logger

#### `createLogger(config: LoggerConfig): Logger`

Creates a Pino logger instance.

**Config Options:**
- `serviceName`: Name of the service
- `level`: Log level (default: 'info') - one of: `'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'`
- `pretty`: Enable pretty printing for development (default: false)
- `redactPaths`: Additional paths to redact from logs

#### `createChildLogger(logger: Logger, context: Record<string, unknown>): Logger`

Creates a child logger with additional context.

### Errors

#### Error Classes

- `AppError`: Base error class
- `ValidationError`: 400 validation errors
- `NotFoundError`: 404 not found errors
- `UnauthorizedError`: 401 unauthorized errors
- `ForbiddenError`: 403 forbidden errors
- `ConflictError`: 409 conflict errors
- `ServiceUnavailableError`: 503 service unavailable errors

#### `createErrorHandler(logger: Logger): ErrorRequestHandler`

Creates Express error handling middleware.

#### `asyncHandler(fn: AsyncRequestHandler): RequestHandler`

Wraps async route handlers to catch promise rejections.

### Health Checks

#### `HealthCheck`

Class for managing multiple health checks.

**Methods:**
- `register(name: string, checker: HealthChecker): void`
- `execute(): Promise<HealthCheckResult>`
- `getHandler(): RequestHandler`

#### `createSimpleHealthCheck(serviceName: string, version?: string): RequestHandler`

Creates a simple health check endpoint that always returns healthy.

#### `checkHttpEndpoint(url: string, timeout?: number): Promise<HealthCheckResult>`

Helper to check if an HTTP endpoint is healthy.
