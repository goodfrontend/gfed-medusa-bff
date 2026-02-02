# Deployment & Publishing Documentation

This document outlines the Continuous Integration (CI), Continuous Deployment (CD), and Package Publishing workflows for the GFED Medusa BFF (Backend for Frontend) project. It is designed to help developers understand how code moves from development to production and how to manage the infrastructure.

## Overview

The project uses **GitHub Actions** for automation and **Render** for hosting the application services. It includes a Gateway and multiple Subgraphs (Federated GraphQL).

- **CI (Continuous Integration):** Runs on Pull Requests to ensure code quality (Build, Lint, Type Check).
- **CD (Continuous Deployment):** Fully automated deployment cascade:
  - Pushes to `main` automatically deploy through all environments: `smoke` → `qa` → `production`
  - Only changed services are deployed (per-service change detection)
  - Production deployments automatically create git tags for rollback capability
- **Service Versioning:** Uses semantic versioning for each service. Developers update versions in `package.json` before merging to main. Git tags are automatically created after successful production deployments.
- **Package Publishing:** Uses [Changesets](https://github.com/changesets/changesets) to version and publish packages to npm automatically.
- **Main Branch Policy:** The `main` branch should only contain production-ready code. All features must be approved before merging.

## Infrastructure (Render)

The infrastructure is defined as code in `render.yaml` (Render Blueprint).

### Environments

The setup includes three distinct environments defined in the Render Blueprint:

1.  **Smoke (`smoke`)**: The first stage of deployment (e.g., `gateway-smoke`).
2.  **QA (`qa`)**: The quality assurance environment for broader testing (e.g., `gateway-qa`).
3.  **Production (`production`)**: The live environment (e.g., `gateway-prod`).

### Services

Each environment consists of five web services:
- **Gateway:** `gateway-*` (The entry point)
- **Subgraphs:**
    - `products-*`
    - `orders-*`
    - `customers-*`
    - `content-*`

**Note:** The `render.yaml` initializes these services with a placeholder image `traefik/whoami`. The actual application images are deployed via the GitHub Actions pipeline.

### Environment Variables

Environment variables are managed via **Environment Groups** in the Render Dashboard. You must create these groups manually before applying the Blueprint:
- `bff-prod-env-group`
- `bff-smoke-env-group`
- `bff-qa-env-group`

## CI/CD Workflows

All workflows are located in `.github/workflows/`.

### 1. Verification (CI)
*   **Files:** `ci-gateway.yaml`, `ci-products.yaml`, `ci-orders.yaml`, etc.
*   **Trigger:** Pull Requests affecting specific apps or shared packages.
*   **Steps:**
    1.  Checkout code.
    2.  Setup Node.js & pnpm.
    3.  Install dependencies.
    4.  Run `lint`, `check-types`, and `build` scripts for the specific scope.

### 2. Automatic Deployment (CD)
*   **File:** `deploy.yaml`.
*   **Trigger:** Push to `main`.
*   **Purpose:** Fully automated deployment cascade through all environments.
*   **Process:**
    1.  **Detect Changes:** Identifies which apps (`gateway`, `products`, `orders`, etc.) have changed using `dorny/paths-filter` (compares current commit vs previous).
    2.  **Build Docker Images:** Builds the modified apps and pushes images to **GitHub Container Registry (GHCR)** tagged with the commit SHA.
    3.  **Deployment Chain (Automatic Cascade):**
        *   **Smoke:** Deploys the new image to the `smoke` environment first.
        *   **QA:** After `smoke` succeeds, deploys to `qa` environment.
        *   **Production:** After `qa` succeeds, deploys to `production` environment.
    4.  **Schema Publishing:** During deployment of subgraphs, the workflow publishes the updated GraphQL schema to Apollo Studio using the `APOLLO_KEY` and `APOLLO_GRAPH_REF`.
    5.  **Git Tagging:** After successful production deployment, automatically creates git tags for each deployed service (e.g., `@gfed-medusa-bff/products@1.2.0`). These tags enable rollback functionality.
*   **Important:** Only merge production-ready code to `main`. All features should be approved before merging.

### 3. Rollback Deployments (Production Only)
*   **File:** `rollback-production.yaml`.
*   **Trigger:** Manual workflow dispatch.
*   **Purpose:** Quickly rollback a production service to a previous version using git tags.
*   **Environment:** Production only (git tags only exist for production deployments).
*   **Safety Features:** Confirmation required, version validation, Docker image verification, concurrency control, age warnings.
*   **Schema Rollback:** For subgraphs, automatically re-publishes the old schema to Apollo Studio to maintain schema-code consistency.

**See [How to Rollback a Deployment](#how-to-rollback-a-deployment) section below for complete guide.

### 4. Preview Environment Cleanup
*   **File:** `cleanup-render-preview.yaml`.
*   **Trigger:** When a Pull Request is closed.
*   **Process:**
    1.  Locates preview metadata artifacts from PR workflows.
    2.  Extracts Render preview service IDs.
    3.  Deletes Render preview services via API.
    4.  Prevents accumulation of unused preview environments.

### 5. Package Publishing
*   **File:** `publish-packages.yaml`.
*   **Trigger:** When a Pull Request is closed/merged into `main`.
*   **Process:**
    1.  Checks if the PR is a "Version Packages" PR created by Changesets.
    2.  Authenticates with npm using `NPM_TOKEN`.
    3.  Runs `pnpm run ci:publish` to publish updated packages to the registry.

## Secrets Configuration

To enable these workflows, the following **GH Secrets** must be configured in the repository settings:

### Infrastructure

- `RENDER_API_KEY`: API Key from Render User Settings.
    - This must be configured to each environment
- `GITHUB_TOKEN`: Automatically provided by GitHub (used for GHCR login).

### Apollo Federation

This must be configured to each subgraph's environment

- `APOLLO_KEY`: The API key for Apollo Studio.
- `APOLLO_GRAPH_REF`: The graph reference.
- `APOLLO_ROUTING_URL`: The URL where the subgraph can be reached.

### Publishing
- `NPM_TOKEN`: Automation token for publishing to npm.
    - Granular access token

## Workflows Validation

Before creating a PR for added/modified workflow files, validate them locally to catch errors early.

If you modify `.github/workflows/*.yaml` files:

```bash
pnpm lint:workflows
```

**What it validates:**
- YAML syntax correctness (via yamllint)
- GitHub Actions logic (job dependencies, outputs, expressions) (via actionlint)

**Prerequisites:**
```bash
# Install linters (macOS)
brew install yamllint actionlint
```

---

## Step-by-Step Guide

### How to Deploy an Application

Deployment is fully automated through all environments. The workflow ensures that only production-ready code reaches production.

#### Prerequisites

**Important:** The `main` branch should only contain production-ready code. Before merging:
- Get client/stakeholder approval for new features
- Ensure all tests pass
- Complete code review

#### Deployment Process

1.  **Update Service Versions (If Needed):**
    - If you're releasing new features or fixes, update the version in `package.json` for affected services
    - For subgraphs: Edit `apps/subgraphs/{service}/package.json`
    - For gateway: Edit `apps/gateway/package.json`
    - Follow [Semantic Versioning](https://semver.org/):
      - **MAJOR** (e.g., 1.0.0 → 2.0.0): Breaking changes, incompatible GraphQL schema changes
      - **MINOR** (e.g., 1.0.0 → 1.1.0): New features, backwards-compatible schema additions
      - **PATCH** (e.g., 1.0.0 → 1.0.1): Bug fixes, no schema changes
    - Include version bumps in your PR

2.  **Make Changes:** Implement your features or fixes in the Gateway or Subgraphs.

3.  **Create a PR:** Push your branch and open a Pull Request.
    *   The CI checks will run automatically to verify your code.
    *   Request review from team members.

4.  **Merge to Main:** Once the PR is approved and checks pass, merge it into `main`.

5.  **Automatic Deployment Cascade:**
    - **Smoke:** Deploys automatically within minutes of merge
    - **QA:** Deploys after smoke succeeds
    - **Production:** Deploys after QA succeeds
    - **Tagging:** Git tags are automatically created after production deployment (e.g., `@gfed-medusa-bff/products@1.2.0`)
    - For subgraphs: GraphQL schemas are published to Apollo Studio at each stage
    - Only changed services are deployed (automatic change detection)

6.  **Verify Deployment:**
    - Monitor the workflow in GitHub Actions
    - Verify services are live on Render
    - Test production endpoints
    - For subgraphs, verify schemas were published in Apollo Studio

### How to Publish a Package

We use **Changesets** to manage versioning and publishing.

1.  **Make Changes:** Modify the package code in `packages/`.
2.  **Add a Changeset:** Run the following command in your terminal:
    ```bash
    npx changeset
    ```
    *   Select the packages that have changed.
    *   Choose the semantic version bump (major, minor, patch).
    *   Write a summary of the changes.
3.  **Commit:** Commit the generated changeset file along with your code changes.
4.  **Merge PR:** Create and merge your Pull Request as usual.
5.  **Release PR (Automated):**
    *   A "Version Packages" PR will be automatically created (or updated) by the `Changesets` bot.
    *   This PR consumes the changeset files and updates `package.json` versions and `CHANGELOG.md`.
6.  **Publish:**
    *   When you are ready to publish, checkout the branch and run `pnpm install` locally, push the changes to this branch 
    *   Review and **merge** the "Version Packages" PR.
    *   The `Publish Packages` workflow will trigger and publish the new versions to npm.

### How to Rollback a Deployment

If a deployment introduces a critical bug, you can quickly rollback to a previous version. For subgraphs, the GraphQL schema is automatically rolled back to match the code version.

#### Find Available Versions

**Option 1 - Git Tags:**
```bash
# List all versions for a service
git tag -l "@gfed-medusa-bff/products@*"

# Example output:
# @gfed-medusa-bff/products@1.0.0
# @gfed-medusa-bff/products@1.1.0
# @gfed-medusa-bff/products@1.2.0
```

**Option 2 - GitHub UI:**
1. Go to repository → Tags: `https://github.com/your-org/gfed-medusa-bff/tags`
2. Look for the service you want to rollback
3. Note the version number

#### Execute Rollback

1. **Go to GitHub Actions:**
   - Navigate to **Actions** → **Rollback Production**
   - Click **Run workflow**

2. **Configure rollback:**
   - **App**: Select the service (gateway, products, orders, content, customers)
   - **Target Version**: Enter the version (e.g., `1.0.0`)
   - **Confirm**: Type `rollback`

3. **Execute:**
   - Click **Run workflow**
   - The workflow will:
     - Validate the version exists
     - Check if Docker image exists in GHCR
     - Show version age and risk warnings
     - Deploy the old Docker image
     - For subgraphs: Re-publish the old schema to Apollo Studio
     - Notify success or failure

### How to Setup a New Environment (Render)

If you are setting this up for the first time:

1.  **Create Env Groups:** In Render Dashboard, create Environment Groups (`bff-prod-env-group`, `bff-smoke-env-group`, `bff-qa-env-group`) and add necessary env vars.
2.  **Connect Repo:** Connect your GitHub repository to Render.
3.  **Create Blueprint:** Create a new Blueprint instance in Render and select the `render.yaml` file from the repository.
4.  **Initial Sync:** Render will create the services defined in `render.yaml` using the placeholder image.
5.  **First Deploy:** Push a commit to `main` to trigger the GitHub Action, which will build the actual app images and deploy them to your new Render services.
