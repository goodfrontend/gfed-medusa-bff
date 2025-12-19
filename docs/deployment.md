# Deployment & Publishing Documentation

This document outlines the Continuous Integration (CI), Continuous Deployment (CD), and Package Publishing workflows for the GFED Medusa BFF (Backend for Frontend) project. It is designed to help developers understand how code moves from development to production and how to manage the infrastructure.

## Overview

The project uses **GitHub Actions** for automation and **Render** for hosting the application services. It includes a Gateway and multiple Subgraphs (Federated GraphQL).

- **CI (Continuous Integration):** Runs on Pull Requests to ensure code quality (Build, Lint, Type Check).
- **CD (Continuous Deployment):** Triggered on pushes to the `main` branch. It builds Docker images, pushes them to GitHub Container Registry (GHCR), and promotes them through environments (`smoke` -> `qa` -> `production`). It also handles **Apollo Federation Schema Publishing**.
- **Package Publishing:** Uses [Changesets](https://github.com/changesets/changesets) to version and publish packages to npm automatically.

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

### 2. Deployment (CD)
*   **File:** `deploy.yaml`.
*   **Trigger:** Push to `main`.
*   **Process:**
    1.  **Detect Changes:** Identifies which apps (`gateway`, `products`, `orders`, etc.) have changed using `dorny/paths-filter`.
    2.  **Build Docker Images:** Builds the modified apps and pushes images to **GitHub Container Registry (GHCR)** tagged with the commit SHA.
    3.  **Deployment Chain:**
        *   **Smoke:** Deploys the new image to the `smoke` environment.
        *   **QA:** If `smoke` succeeds, a reviewer's approval is required to deploy QA
        *   **Production:** If `qa` succeeds, a reviewer's approval is required to deploy Prod.
    4.  **Schema Publishing:** During deployment of subgraphs, the workflow publishes the updated GraphQL schema to Apollo Studio using the `APOLLO_KEY` and `APOLLO_GRAPH_REF`.

### 3. Package Publishing
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

## Step-by-Step Guide

### How to Deploy an Application

Deployment is fully automated.

1.  **Make Changes:** Implement your features or fixes in the Gateway or Subgraphs.
2.  **Create a PR:** Push your branch and open a Pull Request.
    *   *The CI checks will run automatically to verify your code.*
3.  **Merge to Main:** Once the PR is approved and checks pass, merge it into `main`.
    *   *The `deploy.yaml` workflow will trigger, build images, publish schemas (if applicable), and promote changes from Smoke -> QA -> Production.*

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

### How to Setup a New Environment (Render)

If you are setting this up for the first time:

1.  **Create Env Groups:** In Render Dashboard, create Environment Groups (`bff-prod-env-group`, `bff-smoke-env-group`, `bff-qa-env-group`) and add necessary env vars.
2.  **Connect Repo:** Connect your GitHub repository to Render.
3.  **Create Blueprint:** Create a new Blueprint instance in Render and select the `render.yaml` file from the repository.
4.  **Initial Sync:** Render will create the services defined in `render.yaml` using the placeholder image.
5.  **First Deploy:** Push a commit to `main` to trigger the GitHub Action, which will build the actual app images and deploy them to your new Render services.
