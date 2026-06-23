import { Router } from 'express';

/**
 * Full OpenAPI 3.0 specification for the Mock Personalization Service.
 * This spec documents all endpoints, request/response schemas, and error contracts.
 */
const openApiSpec: Record<string, unknown> = {
  openapi: '3.0.0',
  info: {
    title: 'Mock Personalization',
    version: '0.1.0',
    description:
      'Mock personalization service for the GFED Medusa BFF. ' +
      'Provides deterministic personalization decisions, signal ingestion for ' +
      'user behavior tracking, and profile debugging for development and testing. ' +
      'All responses follow a standard ApiResponse wrapper pattern with success/error semantics.',
  },
  servers: [],
  paths: {
    '/api/signals': {
      post: {
        summary: 'Ingest a user behavior signal',
        operationId: 'postSignal',
        tags: ['Signals'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SignalRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Signal recorded successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SignalApiResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error or invalid JSON',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/personalize': {
      post: {
        summary: 'Get personalization decision',
        operationId: 'postPersonalize',
        tags: ['Personalization'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PersonalizeRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Personalization decision returned',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PersonalizeApiResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error or invalid JSON',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/profiles/{deviceId}': {
      get: {
        summary: 'Get profile debug info for a device',
        operationId: 'getProfile',
        tags: ['Profiles'],
        parameters: [
          {
            name: 'deviceId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Device identifier',
          },
        ],
        responses: {
          '200': {
            description: 'Profile data for the device',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProfileApiResponse' },
              },
            },
          },
          '404': {
            description: 'Route not found (missing deviceId)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ApiErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [false] },
          error: { $ref: '#/components/schemas/ApiError' },
        },
        required: ['success', 'error'],
      },
      ApiError: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Machine-readable error code',
            example: 'VALIDATION_ERROR',
          },
          message: {
            type: 'string',
            description: 'Human-readable error message',
          },
          details: {
            type: 'object',
            description: 'Optional field-level details for validation errors',
          },
          requestId: {
            type: 'string',
            description: 'Optional request ID for traceability',
          },
        },
        required: ['code', 'message'],
      },
      SignalType: {
        type: 'string',
        enum: [
          'PAGE_VIEW',
          'PRODUCT_VIEW',
          'PRODUCT_HOVER',
          'QUICK_VIEW_OPEN',
          'IMAGE_ZOOM',
          'REVIEWS_VIEW',
          'SIZE_GUIDE_VIEW',
          'SEARCH_QUERY',
          'SEARCH_RESULT_CLICK',
          'FILTER_APPLIED',
          'SORT_CHANGED',
          'CART_ADD',
          'CART_REMOVE',
          'CHECKOUT_START',
          'CHECKOUT_ABANDON',
        ],
        description: 'Known user behavior signal types',
      },
      SignalRequest: {
        type: 'object',
        properties: {
          type: { $ref: '#/components/schemas/SignalType' },
          payload: {
            type: 'object',
            description: 'Signal-type-specific payload. Fields depend on signal type.',
          },
          deviceId: {
            type: 'string',
            description: 'Required device identifier (anonymous or pseudonymous)',
          },
          userId: {
            type: 'string',
            description: 'Optional authenticated user identifier',
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'The URL where the signal was generated',
          },
          timestamp: {
            type: 'number',
            description: 'Unix timestamp (ms) when the signal occurred. Defaults to server time.',
          },
          page: {
            type: 'string',
            description: 'Page identifier (e.g., home, product/abc123)',
          },
        },
        required: ['type', 'payload', 'deviceId'],
      },
      SignalResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          signalId: {
            type: 'string',
            description: 'Unique identifier for the recorded signal',
          },
          processedAt: {
            type: 'string',
            format: 'date-time',
            description: 'ISO-8601 timestamp of when the signal was processed',
          },
        },
        required: ['success', 'signalId', 'processedAt'],
      },
      SignalApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { $ref: '#/components/schemas/SignalResponse' },
        },
        required: ['success', 'data'],
      },
      Surface: {
        type: 'string',
        enum: ['home', 'product', 'category', 'search', 'cart', 'checkout'],
        description: 'Surface identifiers the service knows about',
      },
      PersonalizeRequest: {
        type: 'object',
        properties: {
          deviceId: {
            type: 'string',
            description: 'Required device identifier',
          },
          userId: {
            type: 'string',
            description: 'Optional authenticated user',
          },
          surface: {
            $ref: '#/components/schemas/Surface',
          },
          page: {
            type: 'string',
            description: 'Page path or identifier within the surface',
          },
          productId: {
            type: 'string',
            description: 'If on a product page, the product ID',
          },
          category: {
            type: 'string',
            description: 'If on a category page, the category handle',
          },
          price: {
            type: 'number',
            description: 'Product price context (for price-sensitive decisions)',
          },
        },
        required: ['deviceId', 'surface', 'page'],
      },
      PersonalizeResponse: {
        type: 'object',
        properties: {
          requestId: {
            type: 'string',
            description: 'Unique request ID for traceability',
          },
          components: {
            type: 'array',
            items: { $ref: '#/components/schemas/PersonalizationComponent' },
            description: 'Ordered array of recommended components (highest priority first)',
          },
          reasoning: { $ref: '#/components/schemas/PersonalizationReasoning' },
          cacheKey: {
            type: 'string',
            description: 'Cache key the BFF can use to short-circuit identical requests',
          },
          servedAt: {
            type: 'string',
            format: 'date-time',
            description: 'ISO-8601 timestamp of when this decision was served',
          },
        },
        required: ['requestId', 'components', 'reasoning', 'cacheKey', 'servedAt'],
      },
      PersonalizeApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { $ref: '#/components/schemas/PersonalizeResponse' },
        },
        required: ['success', 'data'],
      },
      PersonalizationComponent: {
        type: 'object',
        properties: {
          component: {
            type: 'string',
            description: 'Component type name (matches BFF component registry)',
          },
          contentId: {
            type: 'string',
            nullable: true,
            description: 'CMS content ID if a specific content item was selected, or null',
          },
          priority: {
            type: 'integer',
            description: 'Priority ordering within the response (1 = highest priority)',
          },
          propsOverrides: {
            type: 'object',
            description: 'Component-specific overrides (props to pass to the component)',
          },
          reasoning: {
            type: 'string',
            description: 'Human-readable explanation for this component selection',
          },
          score: {
            type: 'number',
            format: 'float',
            description: 'Confidence score 0-1 for this component selection',
          },
        },
        required: ['component', 'contentId', 'priority', 'propsOverrides', 'reasoning', 'score'],
      },
      PersonalizationReasoning: {
        type: 'object',
        properties: {
          intent: { $ref: '#/components/schemas/Intent' },
          confidence: {
            type: 'number',
            format: 'float',
            description: 'Confidence in the intent classification (0-1)',
          },
          factors: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of explanatory factors leading to this decision',
          },
          modelVersion: {
            type: 'string',
            description: 'Model version identifier',
          },
        },
        required: ['intent', 'confidence', 'factors', 'modelVersion'],
      },
      Intent: {
        type: 'string',
        enum: ['buy_now', 'exploring', 'price_shop', 'uncertain'],
        description: 'Shopping intent classifications',
      },
      LifecycleStage: {
        type: 'string',
        enum: ['NEW', 'RETURNING', 'FREQUENT', 'LOYAL'],
        description: 'User lifecycle stages as classified by the external service',
      },
      EngagementLevel: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH'],
        description: 'Engagement level as classified by the external service',
      },
      ProfileDebugResponse: {
        type: 'object',
        properties: {
          profile: { $ref: '#/components/schemas/UserProfile' },
          intentScores: {
            type: 'array',
            items: { $ref: '#/components/schemas/IntentScore' },
          },
          signalCount: {
            type: 'integer',
            description: 'Number of signals recorded for this device',
          },
        },
        required: ['profile', 'intentScores', 'signalCount'],
      },
      ProfileApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { $ref: '#/components/schemas/ProfileDebugResponse' },
        },
        required: ['success', 'data'],
      },
      UserProfile: {
        type: 'object',
        properties: {
          deviceId: { type: 'string' },
          userId: { type: 'string' },
          categoryAffinity: {
            type: 'object',
            additionalProperties: { $ref: '#/components/schemas/CategoryAffinityEntry' },
            description: 'Category affinity scores keyed by category handle',
          },
          priceSensitivity: {
            type: 'object',
            properties: {
              score: { type: 'number' },
              avgViewedPrice: { type: 'number' },
              dealClickRate: { type: 'number' },
            },
            required: ['score', 'avgViewedPrice', 'dealClickRate'],
          },
          intentSignals: {
            type: 'object',
            properties: {
              researchDepth: { type: 'integer' },
              checkoutConversion: { type: 'number' },
            },
            required: ['researchDepth', 'checkoutConversion'],
          },
          engagementLevel: { $ref: '#/components/schemas/EngagementLevel' },
          lifecycleStage: { $ref: '#/components/schemas/LifecycleStage' },
          firstSeen: { type: 'number', description: 'Unix timestamp of first signal' },
          lastSeen: { type: 'number', description: 'Unix timestamp of most recent signal' },
          sessionCount: { type: 'integer' },
          orderCount: { type: 'integer' },
          searchHistory: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                timestamp: { type: 'number' },
              },
              required: ['query', 'timestamp'],
            },
          },
          cartActivity: { type: 'integer' },
          hesitationCount: { type: 'integer' },
          recentProducts: {
            type: 'array',
            items: { $ref: '#/components/schemas/ProductViewEntry' },
          },
          lastSignalTimestamp: { type: 'number' },
          currentSession: { $ref: '#/components/schemas/CurrentSession' },
          lastPurchaseDate: { type: 'number' },
          totalSpent: { type: 'number' },
          averageOrderValue: { type: 'number' },
        },
        required: [
          'deviceId',
          'categoryAffinity',
          'priceSensitivity',
          'intentSignals',
          'engagementLevel',
          'lifecycleStage',
          'firstSeen',
          'lastSeen',
          'sessionCount',
        ],
      },
      IntentScore: {
        type: 'object',
        properties: {
          intent: { $ref: '#/components/schemas/Intent' },
          score: { type: 'number', format: 'float' },
        },
        required: ['intent', 'score'],
      },
      CategoryAffinityEntry: {
        type: 'object',
        properties: {
          views: { type: 'integer' },
          purchases: { type: 'integer' },
          lastViewed: { type: 'number' },
          score: { type: 'number' },
        },
        required: ['views', 'purchases', 'lastViewed', 'score'],
      },
      CurrentSession: {
        type: 'object',
        properties: {
          startedAt: { type: 'number' },
          signalCount: { type: 'integer' },
          searches: { type: 'array', items: { type: 'string' } },
          productViews: { type: 'array', items: { type: 'string' } },
          cartAdds: { type: 'integer' },
          firstCategory: { type: 'string' },
        },
        required: ['startedAt', 'signalCount', 'searches', 'productViews', 'cartAdds'],
      },
      ProductViewEntry: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          productName: { type: 'string' },
          category: { type: 'string' },
          price: { type: 'number' },
          timestamp: { type: 'number' },
        },
        required: ['productId', 'productName', 'category', 'timestamp'],
      },
    },
  },
};

const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mock Personalization — API Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    :root {
      color-scheme: light dark;
    }
    html { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { margin: 0; padding: 0; background: #fafafa; }
    @media (prefers-color-scheme: dark) {
      body { background: #1a1a2e; }
      .swagger-ui { color: #e0e0e0; }
      .swagger-ui .topbar { background: #16213e; }
      .swagger-ui .info .title { color: #e0e0e0; }
      .swagger-ui .scheme-container { background: #16213e; }
      .swagger-ui .opblock-tag { color: #e0e0e0; }
      .swagger-ui .opblock .opblock-summary-description { color: #b0b0b0; }
      .swagger-ui .opblock-body { background: #1a1a2e; }
      .swagger-ui table thead tr th { color: #b0b0b0; }
      .swagger-ui .response-col_status { color: #e0e0e0; }
      .swagger-ui .response-col_description { color: #b0b0b0; }
      .swagger-ui .info .description p { color: #b0b0b0; }
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"><\/script>
  <script>
    SwaggerUIBundle({
      url: '/api/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
      ],
    });
  <\/script>
</body>
</html>`;

export const docsRouter: Router = Router();

docsRouter.get('/api/openapi.json', (req, res) => {
  // Derive the deployed URL from the incoming request — trust proxy ensures
  // req.protocol reflects X-Forwarded-Proto when behind Render's proxy.
  const deployedUrl = `${req.protocol}://${req.headers.host ?? 'localhost:4009'}`;
  res.json({
    ...openApiSpec,
    servers: [
      { url: deployedUrl, description: 'Deployed environment' },
      { url: 'http://localhost:4009', description: 'Local development' },
    ],
  });
});

docsRouter.get('/api/docs', (_req, res) => {
  res.type('text/html').send(SWAGGER_UI_HTML);
});
