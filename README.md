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

## Using the Gateway with Apollo GraphOS Managed Federation (`USE_GRAPHOS`)

The Gateway supports two operational modes:

- **Local Development Mode:** Composes the supergraph from the local running subgraph services—great for local development and testing.
- **GraphOS Managed Mode:** Composes the supergraph from the schema published in Apollo GraphOS, using the schema as managed and tracked by Apollo Studio.

### Switching Modes

Control which mode is active via the `USE_GRAPHOS` environment variable:

- `USE_GRAPHOS=false` (default): Gateway fetches and composes subgraph schemas from the locally running subgraph services defined in your environment (ideal for local development).
- `USE_GRAPHOS=true`: Gateway fetches the _published supergraph_ schema from Apollo GraphOS, using the `APOLLO_KEY` and `APOLLO_GRAPH_REF` environment variables for authentication and identification.

### Example `.env` for Managed Federation (GraphOS)

```env
USE_GRAPHOS=true
APOLLO_KEY=your-service-api-key     # Get this from Apollo Studio
APOLLO_GRAPH_REF=your-graph@current # Format: graph-id@variant

# When USING GraphOS managed mode, you do NOT need local subgraphs running, unless you want to run a subgraph locally and update GraphOS.
```

### How it works

In GraphOS mode (`USE_GRAPHOS=true`):

- The Gateway process does **not** require the local subgraphs to be running.
- The Gateway will use the published supergraph schema from Apollo Studio. Updates there (via CI/CD or manual publish) will propagate automatically to the gateway.
- This is ideal for preview environments, staging, and production.

In local mode (`USE_GRAPHOS=false`):

- The Gateway expects all subgraphs to be running at their configured URLs.
- The supergraph is dynamically composed from these live subgraphs—ideal for debugging and rapid iteration.

### Example Switching

To run the gateway locally with the published schema (not requiring local subgraphs):

```sh
# .env
USE_GRAPHOS=true
APOLLO_KEY=service:prod:XXXXXXXXXXXXXX
APOLLO_GRAPH_REF=my-graph@current
```

Then start the gateway:

```sh
pnpm --filter @gfed-medusa-bff/gateway run dev
```

To develop with local schema composition instead:

```sh
# .env
USE_GRAPHOS=false
```

_(Start all subgraphs as usual for this mode.)_

## Getting Started

The gateway supports both Local Development mode and GraphOS managed mode.
Before starting, read the [USE_GRAPHOS section above](#using-the-gateway-with-apollo-graphos-managed-federation-use_graphos) to determine which mode fits your needs and configure your `.env` accordingly.

### 1. Install dependencies

```sh
pnpm install
```

### 2. Start the services

#### If developing locally (`USE_GRAPHOS=false`):

- Ensure all subgraphs are running (see above for subgraph apps and ports).
- Then start the gateway:

```sh
pnpm run dev
```

_(This will start all subgraphs and the gateway if run from the repo root; see Turbo setup for details.)_

#### If using GraphOS-Managed mode (`USE_GRAPHOS=true`):

- Only the gateway needs to be running! The gateway will fetch the latest published schema from Apollo GraphOS as described above.

```sh
pnpm --filter @gfed-medusa-bff/gateway run dev
```

_(No need to run individual subgraphs locally unless you want to update/publish new schemas.)_

---

All other scripts and development tips remain unchanged; see above sections for schema generation, publishing, CI, and more.

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
APOLLO_KEY="your-apollo-key"  # API key used to authenticate with Apollo Studio / GraphOS
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
- Lint and format config is always inherited—customize only per-app rules if needed.
- Add new subgraphs by creating a folder under `apps/subgraphs/*` and extending the federation config in the gateway.

### Adding a New Subgraph to Local Development

When you create a new subgraph inside the monorepo, make sure to register it in the Turbo configuration so it starts automatically during local development.

In turbo.json, under the task:

```jsonc
"@gfed-medusa-bff/gateway#dev": {
  "with": [
    "@gfed-medusa-bff/products#dev",
    "@gfed-medusa-bff/orders#dev",
    "@gfed-medusa-bff/customers#dev",
    "@gfed-medusa-bff/content#dev"
  ],
  "persistent": true
}
```

add your new subgraph’s `#dev` script to the with array.

Example

If you add a new subgraph called **inventory**, update it like this:

```jsonc
"@gfed-medusa-bff/gateway#dev": {
  "with": [
    "@gfed-medusa-bff/products#dev",
    "@gfed-medusa-bff/orders#dev",
    "@gfed-medusa-bff/customers#dev",
    "@gfed-medusa-bff/content#dev",
    "@gfed-medusa-bff/inventory#dev" // ← Add this
  ],
  "persistent": true
}
```

This ensures Turbo runs the gateway together with all subgraphs when you execute:

```sh
turbo run dev
```
