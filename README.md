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

## Using the Gateway with the Schema Registry (`SUPERGRAPH_SDL_URL`)

The Gateway supports two operational modes:

- **Local Development Mode:** Composes the supergraph from locally running subgraph services (ideal for local dev and previews).
- **Registry Mode:** Loads a pre-composed supergraph SDL from the custom GitHub schema registry (recommended for smoke/qa/prod).

### Switching Modes

Control which mode is active via `SUPERGRAPH_SDL_URL`:

- If `SUPERGRAPH_SDL_URL` is **unset**, the Gateway composes from local subgraphs and (in non-production) polls for changes every 10 seconds.
- If `SUPERGRAPH_SDL_URL` is **set**, the Gateway fetches the supergraph SDL once at startup and never polls.

### Registry Mode Configuration

```env
SUPERGRAPH_SDL_URL=https://raw.githubusercontent.com/<org>/<schema-registry>/main/supergraph/<env>/latest.graphql
SUPERGRAPH_SDL_TOKEN=ghp_... # required if registry repo is private
SUPERGRAPH_RELOAD_TOKEN=your-shared-secret
```

### Reload Behavior (No Restart)

After CI publishes a new `latest.graphql`, trigger a reload:

- `POST /admin/reload-supergraph` with `Authorization: Bearer <token>`

Health/status is available at:

- `GET /admin/reload-supergraph`

### Local/Preview Mode

If `SUPERGRAPH_SDL_URL` is not set:

- The Gateway expects all subgraphs to be running at their configured URLs.
- The supergraph is dynamically composed from those subgraphs.

## Getting Started

The gateway supports both Local Development mode and Registry mode.
Before starting, read the [Schema Registry section above](#using-the-gateway-with-the-schema-registry-supergraph_sdl_url) to determine which mode fits your needs and configure your `.env` accordingly.

### 1. Install dependencies

```sh
pnpm install
```

### 2. Start the services

#### If developing locally (no `SUPERGRAPH_SDL_URL`):

- Ensure all subgraphs are running (see above for subgraph apps and ports).
- Then start the gateway:

```sh
pnpm run dev
```

_(This will start all subgraphs and the gateway if run from the repo root; see Turbo setup for details.)_

#### If using Registry mode (`SUPERGRAPH_SDL_URL` set):

- Only the gateway needs to be running. The gateway will fetch the latest published supergraph SDL from the registry as described above.

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

## Schema Registry (CI/CD)

Production schemas are composed and published by CI into the custom GitHub schema registry:

1. Each subgraph deployment publishes its own SDL to the registry:
   - `subgraphs/<env>/<name>/latest.graphql`
   - `subgraphs/<env>/<name>/<sha>.graphql`
2. CI composes the supergraph SDL from the registry copies.
3. Publish the composed supergraph to the registry:
   - `supergraph/<env>/latest.graphql`
   - `supergraph/<env>/<sha>.graphql`
4. Trigger the gateway reload endpoint.

The reusable workflow lives at `.github/workflows/_publish-supergraph.yaml` and expects these environment secrets:

- `SCHEMA_REGISTRY_REPO` (owner/repo)
- `SCHEMA_REGISTRY_TOKEN`
- `PRODUCTS_URL`, `CUSTOMERS_URL`, `CONTENT_URL`, `ORDERS_URL`
- `SUPERGRAPH_RELOAD_URL`, `SUPERGRAPH_RELOAD_TOKEN`

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
# test no pnpm store caching
