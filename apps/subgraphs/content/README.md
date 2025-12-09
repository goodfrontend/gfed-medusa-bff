# Content Subgraph

Apollo Federation subgraph for content management, integrated with Sanity CMS.

## Setup

1. Copy `.env.sample` to `.env` and configure:

   ```
   SANITY_STUDIO_PROJECT_ID=your-project-id
   SANITY_STUDIO_DATASET=production
   SANITY_STUDIO_API_VERSION=2023-05-03
   SANITY_API_TOKEN=your-api-token
   SANITY_STUDIO_FOOTER_ID=your-footer-document-id
   ```

   **Getting the Footer ID from Sanity:**
   1. Open your Sanity Studio
   2. Navigate to the Footer document
   3. The document ID is in the URL: `https://your-project.sanity.studio/desk/footer;your-footer-id`
   4. Copy the ID after the semicolon (e.g., `your-footer-id`)

   Alternatively, use the Sanity Vision plugin to query:

   ```groq
   *[_type == "footer"]{
   _id
   }
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

## Scripts

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `pnpm dev`           | Start development server with hot reload |
| `pnpm build`         | Build for production                     |
| `pnpm start`         | Start production server                  |
| `pnpm codegen`       | Generate GraphQL types                   |
| `pnpm test`          | Run tests                                |
| `pnpm test:coverage` | Run tests with coverage                  |
| `pnpm lint`          | Lint and fix code                        |
| `pnpm format`        | Format code with Prettier                |

## Code Generation

This subgraph uses [GraphQL Code Generator](https://the-guild.dev/graphql/codegen) to generate TypeScript types from GraphQL schemas.

### Running Codegen

```bash
pnpm codegen          # Generate types once
pnpm codegen:watch    # Watch mode for development
```

### Configuration

Codegen is configured in `codegen.ts`:

```typescript
const config: CodegenConfig = {
  schema: 'src/schema/**/*.graphql',
  generates: {
    'src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        useTypeImports: true,
        skipTypename: true,
        scalars: {
          JSON: '{ [key: string]: unknown }',
          DateTime: 'string',
        },
        enumsAsTypes: true,
      },
    },
  },
};
```

### Generated Output

Types are generated to `src/generated/graphql.ts` and include:

- **Type definitions** - TypeScript interfaces for all GraphQL types (e.g., `Footer`, `SocialLink`)
- **Resolver types** - Typed resolver signatures (e.g., `FooterResolvers`, `QueryResolvers`)
- **Query argument types** - Input types for queries (e.g., `QueryFooterArgs`)
- **Scalar mappings** - TypeScript types for custom scalars (`JSON`, `DateTime`)

### Usage in Resolvers

Import generated types in your resolvers:

```typescript
import { Footer, QueryFooterArgs, Resolvers } from '../generated/graphql';

export const footerResolvers = {
  Query: {
    footer: async (
      _parent: unknown,
      args: QueryFooterArgs
    ): Promise<Footer | null> => {
      // args.footerId is typed as string
      return sanityClient.fetch(FOOTER_QUERY, { footerId: args.footerId });
    },
  },
};
```

## Folder Structure

```
src/
├── __mocks__/
│   ├── data/              # Mock data for tests
│   │   └── footer.ts
│   └── msw/               # MSW (Mock Service Worker) setup
│       ├── handlers/      # Request handlers
│       │   ├── footer.ts
│       │   └── index.ts
│       └── node.ts        # MSW server config
├── __tests__/             # Test files
│   └── footer.test.ts
├── config/
│   └── sanity.ts          # Sanity client configuration
├── generated/
│   └── graphql.ts         # Auto-generated TypeScript types (via codegen)
├── resolvers/
│   ├── footer/
│   │   ├── groq-queries.ts  # GROQ queries for Sanity
│   │   └── index.ts         # Footer resolver implementation
│   ├── index.ts           # Merges all resolvers
│   └── scalars.ts         # Custom scalar definitions (JSON, DateTime)
├── schema/
│   ├── base.ts            # Base schema with Federation directives
│   ├── footer.graphql     # Footer type definitions
│   └── index.ts           # Merges all schemas
└── index.ts               # Server entry point
```

## Schema & Resolvers

### Adding a New Type

1. **Create the GraphQL schema** in `src/schema/<type>.graphql`:

   ```graphql
   type MyType @key(fields: "_id") {
     _id: ID!
     name: String!
   }

   extend type Query {
     myType(id: String!): MyType
   }
   ```

2. **Generate types**:

   ```bash
   pnpm codegen
   ```

3. **Create the resolver** in `src/resolvers/<type>/index.ts`:

   ```typescript
   import { sanityClient } from '../../config/sanity';
   import { MyType, QueryMyTypeArgs } from '../../generated/graphql';
   import { MY_TYPE_QUERY } from './groq-queries';

   export const myTypeResolvers = {
     Query: {
       myType: async (
         _parent: unknown,
         args: QueryMyTypeArgs
       ): Promise<MyType | null> => {
         return sanityClient.fetch(MY_TYPE_QUERY, { id: args.id });
       },
     },
   };
   ```

4. **Create GROQ queries** in `src/resolvers/<type>/groq-queries.ts`:

   ```typescript
   export const MY_TYPE_QUERY = `*[_type == "myType" && _id == $id][0]`;
   ```

5. **Register the resolver** in `src/resolvers/index.ts`:

   ```typescript
   import { myTypeResolvers } from './myType';

   export const resolvers: Resolvers = mergeResolvers([
     footerResolvers,
     myTypeResolvers,
     scalarsResolver,
   ]);
   ```

### Custom Scalars

The subgraph includes custom scalars defined in `src/resolvers/scalars.ts`:

- `JSON` - For arbitrary JSON data (uses `graphql-scalars`)
- `DateTime` - For date/time values

## Testing

Tests use Jest with MSW (Mock Service Worker) to mock Sanity API responses.

### Running Tests

```bash
pnpm test              # Run all tests
pnpm test:watch        # Run in watch mode
pnpm test:coverage     # Run with coverage report
```

### Test Structure

Tests are located in `src/__tests__/` and follow the pattern `<feature>.test.ts`.

### Writing Tests

1. **Create mock data** in `src/__mocks__/data/<type>.ts`

2. **Create MSW handlers** in `src/__mocks__/msw/handlers/<type>.ts`:

   ```typescript
   import { HttpResponse, http } from 'msw';

   import { mockData } from '../../data/myType';

   export const myTypeHandler = http.post('*/query/*', () => {
     return HttpResponse.json({ result: mockData });
   });

   export const emptyHandler = http.post('*/query/*', () => {
     return HttpResponse.json({ result: [] });
   });
   ```

3. **Register handlers** in `src/__mocks__/msw/handlers/index.ts`

4. **Write tests** in `src/__tests__/<type>.test.ts`:

   ```typescript
   import { mockData } from '@mocks/data/myType';
   import { emptyHandler, errorHandler } from '@mocks/msw/handlers/myType';
   import { server } from '@mocks/msw/node';
   import { myTypeResolvers } from '@resolvers/myType';

   describe('MyType Resolvers', () => {
     it('should fetch data successfully', async () => {
       const result = await myTypeResolvers.Query.myType({}, { id: '123' });
       expect(result).toEqual(mockData);
     });

     it('should handle empty response', async () => {
       server.use(emptyHandler);
       const result = await myTypeResolvers.Query.myType({}, { id: '123' });
       expect(result).toEqual([]);
     });
   });
   ```

### Test Configuration

- `jest.config.ts` - Jest configuration with path aliases
- `jest.setup.ts` - Global setup (MSW server lifecycle)
- `jest.env.ts` - Environment variables for tests

## Development

The server runs at `http://localhost:4003/graphql` with Apollo Sandbox enabled in development mode.

## Schema Publishing

1. Copy `.env.publish.sample` to `.env.publish` and configure Apollo credentials
2. Generate schema: `pnpm generate-schema`
3. Publish to Apollo: `pnpm publish-schema`
