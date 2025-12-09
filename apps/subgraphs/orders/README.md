# Orders Subgraph

Federated Apollo subgraph that currently exposes Medusa cart logic and is planned to include order and payment operations as a checkout-focused subgraph. Runs as an Express server with Apollo Server v5 and is composed by the gateway in `apps/gateway`.

- **Port:** `4004` (GraphQL endpoint at `http://localhost:4004/graphql`)
- **Upstreams:** Medusa Store REST API for carts, orders (to be implemented), and payments (to be implemented)
- **Current Scope:** Cart management and line item operations

## Setup

1. Install dependencies from the repo root:

   ```bash
   pnpm install
   ```

2. Set up the environment variables. Copy the `.env.template` to a local `.env` and update the values as needed.

   ```bash
   cp .env.template .env
   ```

## Running

```sh
pnpm dev
```

- Starts the subgraph with `tsx watch` on port `4004`.
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

MSW handlers in `src/__mocks__` stub Medusa during tests.

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
APOLLO_SUBGRAPH_NAME=orders
SUBGRAPH_URL=http://localhost:4004/graphql
```

```sh
pnpm generate-schema  # rover subgraph introspect -> schema.graphql
pnpm publish-schema   # rover subgraph publish using the values above
```

## Project layout

- `src/index.ts` – Express/Apollo entrypoint, CORS, and middleware wiring.
- `src/graphql/*` – SDL, resolvers, and generated types for federation.
- `src/services/medusa/*` – Adapters over Medusa JS SDK for orders (to be implemented in later iterations), and payments (to be implemented in later iterations).
