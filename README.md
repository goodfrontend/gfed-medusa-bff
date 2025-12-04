# Medusa BFF Monorepo (Apollo Federation)

This is a monorepo for a Backend-for-Frontend (BFF) using Apollo Federation to provide a unified GraphQL API layer for Medusa Store and related services. It leverages Apollo Gateway and multiple Apollo Subgraphs, making all of your services accessible via a single API endpoint.

## Structure

- `/apps`:
  - [`gateway`](./apps/gateway/): The Apollo Gateway, combines all subgraphs. **Runs on port [4000](http://localhost:4000/graphql)**.
  - `/subgraphs`:
    - [`products`](./apps/subgraphs/products/): Product service subgraph (**port [4001](http://localhost:4001/graphql)**)
    - [`identity`](./apps/subgraphs/identity/): Identity/user service subgraph (**port [4002](http://localhost:4002/graphql)**)
    - [`content`](./apps/subgraphs/content/): Content/cms subgraph (**port [4003](http://localhost:4003/graphql)**)
    - [`orders`](./apps/subgraphs/orders/): Order service subgraph (**port [4004](http://localhost:4004/graphql)**)

## Getting Started

1. Install dependencies (requires Node.js `>=18`, recommended to use pnpm):

   ```sh
   pnpm install
   ```

2. Running all services for local development:

   You can start all subgraphs and the gateway simultaneously by running the following script from the root directory:

   ```sh
   pnpm run dev
   ```

   This will:
   - Start all subgraph servers on their configured ports.

   - Start the gateway on http://localhost:4000/graphql, which dynamically composes the supergraph from the running subgraphs.

3. Running services individually

   You can also start any subgraph or the gateway separately:

   ```sh
   # Start the gateway
   cd apps/gateway && pnpm run dev

   # Start the Products subgraph
   cd apps/subgraphs/products && pnpm run dev

   # Start the Orders subgraph
   cd apps/subgraphs/orders && pnpm run dev

   ```

   **Note:** When running individually, make sure the subgraphs the gateway needs are running.
   The gateway will only include subgraphs that are active; missing subgraphs will cause errors if queried.

4. Each subgraph/server runs on its own port. The gateway aggregates them under `http://localhost:4000/graphql`.

## Scripts

Run from the repo root (`pnpm <script_name>`) or inside a specific app:

- `dev` – Start all apps using Turbo
- `build` – Build all TypeScript apps
- `lint` – Lint all codebase with shared config
- `format` – Format all codebase with Prettier
- `check-types` – Run TypeScript type-checks
- `generate:all` – Generate GraphQL schemas for all subgraphs
- `publish:all` – Publish subgraph schemas to Apollo (Apollo GraphOS)

## Schema Generation & Publishing

Each subgraph exposes scripts to generate and publish its schema using the Apollo Rover CLI. This is critical for Apollo Federation and GraphOS integration.

### Prerequisites

- Apollo Rover CLI installed (available via `@apollo/rover` package)
- Apollo Studio account and graph configured (for publishing)
- .env.publish file with the required variables

### Available Rover Scripts

#### Authentication

To authenticate with Apollo Rover, you need to create a Personal API Key in the Apollo Studio dashboard.

```bash
rover config auth
```

#### Generate Schema

Introspects the running GraphQL server and generates a `schema.graphql` file:

```bash
pnpm run generate-schema
```

This command:

- Connects the subgraph to its GraphQL server at the URL specified in `SUBGRAPH_URL`.
- Introspects the GraphQL schema
- Outputs the federation-compatible schema to `schema.graphql`

**Note**: The target subgraph must be running (e.g., at http://localhost:4001/graphql) for introspection to succeed.

#### Publish Schema

Publishes the generated schema to Apollo Studio:

```bash
pnpm run publish-schema
```

This command:

- Reads the `schema.graphql` file
- Publishes it to Apollo Studio as a subgraph from environment variables `APOLLO_SUBGRAPH_NAME`
- Uses the routing URL from `APOLLO_GRAPH_ROUTING_URL` environment variable(the URL can be found in Apollo Studio under schemas -> subgraphs -> your-subgraph-name -> routing URL)

### Environment Configuration

Add these environment variables to your `.env.publish` file:

```bash
# Apollo Studio Configuration
APOLLO_GRAPH_REF="your-graph-id@current"  # Your Apollo Studio graph reference
APOLLO_GRAPH_ROUTING_URL="your-graph-routing-url"  # Your Apollo Studio graph routing URL
APOLLO_SUBGRAPH_NAME="your-subgraph-name"  # Your Apollo Studio subgraph name
SUBGRAPH_URL="http://localhost:4001/graphql" # The running local subgraph endpoint
```

### Workflow Example

1. Start the subgraph you want to register (for example, products):

   ```bash
   cd apps/subgraphs/products
   pnpm run dev
   ```

2. In a new shell in the same subgraph directory, generate the schema:

   ```bash
   pnpm run generate-schema
   ```

3. Publish the schema to Apollo Studio:
   ```bash
   pnpm run publish-schema
   ```

**Tip**: To automate all subgraphs, use pnpm run generate:all and pnpm run publish:all from the root.

## Apollo Federation

- The gateway ([`/apps/gateway`](./apps/gateway/)) composes all subgraphs using `@apollo/gateway`.
- Each subgraph is a standalone Node.js service using Apollo Server, exposing its local schema and resolvers.

## Development Notes

- Subgraphs are hot-reloadable in `dev` mode using `tsx`.
- Add new subgraphs by creating a folder under `apps/subgraphs/*` and extending the federation config in the gateway.
- Lint and format config is always inherited—customize only per-app rules if needed.
