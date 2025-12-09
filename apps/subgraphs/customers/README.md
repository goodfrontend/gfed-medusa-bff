# Customers Subgraph

Federated Apollo subgraph that exposes customer data from Medusa. Runs as an Express server with Apollo Server v5 and is composed by the gateway in `apps/gateway`.

- **Port:** `4002` (GraphQL endpoint at `http://localhost:4002/graphql`)
- **Upstreams:** Medusa Store REST API for authentication and customer data.

## Setup

1. Install dependencies from the repo root:

   ```bash
   pnpm install
   ```

2. Set up the environment variables. Copy the `.env.sample` to a local `.env` and update the values as needed.

   ```bash
   cp .env.sample .env
   ```

## Running

```sh
pnpm dev
```

- Starts the subgraph with `tsx watch` on port `4002`.
- Access the local landing page and GraphQL explorer at `/graphql` (introspection enabled in non-production).

### Build & start

```sh
pnpm build   # runs codegen + tsup
pnpm start   # runs the compiled server from dist
```

## Testing

```sh
pnpm test            # run Jest suite
pnpm test:watch      # watch mode
pnpm test:coverage   # generate coverage reports
```

MSW handlers in `src/__mocks__` stub Medusa and Algolia during tests; `.env.test` provides the default env used by Jest.

## GraphQL schema & codegen

- SDL lives in `src/graphql/schemas/*.graphql`.
- Generate typed resolvers/context bindings with:

```sh
pnpm codegen        # one-off
pnpm codegen:watch  # regenerate on schema changes
```

The generated types land in `src/graphql/generated/graphql.ts`.

### Schema publish to Apollo Studio

Requires the subgraph to be running and an `.env.publish` file with:

```
APOLLO_GRAPH_REF=<graph-id@variant>
APOLLO_GRAPH_ROUTING_URL=<public-routing-url>
APOLLO_SUBGRAPH_NAME=products
SUBGRAPH_URL=http://localhost:4001/graphql
```

```sh
pnpm generate-schema  # rover subgraph introspect -> schema.graphql
pnpm publish-schema   # rover subgraph publish using the values above
```

## Project layout

- `src/index.ts` – Express/Apollo entrypoint, CORS, and middleware wiring
- `src/graphql/*` – SDL, resolvers, and generated types for federation
- `src/services/index.ts` – Builds GraphQL context based on `req`, `res`, and `session`
