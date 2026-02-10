# syntax=docker.io/docker/dockerfile:1

FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache libc6-compat git && \
    corepack enable && \
    corepack prepare pnpm@9.0.0 --activate && \
    pnpm install turbo --global

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune --scope=@gfed-medusa-bff/products --docker

FROM base AS installer
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Build args for optional concurrency limits (needed for Render free tier)
ARG PNPM_NETWORK_CONCURRENCY=""
ARG PNPM_CHILD_CONCURRENCY=""

RUN pnpm install \
    --frozen-lockfile \
    --shamefully-hoist \
    ${PNPM_NETWORK_CONCURRENCY:+--network-concurrency=$PNPM_NETWORK_CONCURRENCY} \
    ${PNPM_CHILD_CONCURRENCY:+--child-concurrency=$PNPM_CHILD_CONCURRENCY}

COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json

RUN turbo run build --filter=@gfed-medusa-bff/products...

FROM base AS prod-deps
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

RUN pnpm install --frozen-lockfile --prod

FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 graphqluser

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

COPY --from=installer /app/apps/subgraphs/products/dist ./apps/subgraphs/products/dist
COPY --from=installer /app/apps/subgraphs/products/package.json ./apps/subgraphs/products/package.json

COPY --from=prod-deps /app/apps/subgraphs/products/node_modules ./apps/subgraphs/products/node_modules

USER graphqluser

WORKDIR /app/apps/subgraphs/products
CMD ["node", "dist/index.js"]
