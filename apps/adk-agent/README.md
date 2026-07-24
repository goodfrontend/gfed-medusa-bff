# ADK Personalization Agent

## Context

This package is part of a pnpm workspace at the repository root. The workspace
provides shared configurations:

| Package                              | Purpose                     |
| ------------------------------------ | --------------------------- |
| `@gfed-medusa-bff/adk-agent`         | This agent                  |
| `@gfed-medusa-bff/typescript-config` | Shared `tsconfig.json` base |
| `@gfed-medusa-bff/eslint-config`     | Shared ESLint config        |

All workspace commands use the `pnpm --filter` pattern:

```bash
# Build just this package
pnpm --filter @gfed-medusa-bff/adk-agent build

# Run tests for this package
pnpm --filter @gfed-medusa-bff/adk-agent test

# Build all packages in the workspace
pnpm -r build
```

---

## Agent Definition

The agent is defined in `src/agent.ts` using the `@google/adk` `Agent` class.

### Model

Configured via the `MODEL` env var. Default: `gemini-2.5-flash-lite`.

Selected for:

- Fast response times (critical for a storefront homepage load)
- Low cost per token
- Sufficient reasoning capability for component selection

### System Prompt

The prompt (defined inline in `agent.ts`) uses few-shot examples to teach the
model how to select components. It describes three component types:

| Component              | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `HeroBanner`           | Full-width promotional banner at the top of the page |
| `FeaturedCategoryRail` | Horizontal scroll of category links                  |
| `PersonalizedBanner`   | Targeted banner based on user affinity               |

The prompt instructs the model to:

- Prioritize components that match the user's intent
- Use `contentId` only when a specific content item matches
- Set `contentId` to `null` for generic components
- Output a JSON object matching `PersonalizationDecisionSchema`

### Output Schema

The agent writes its decision to the ADK state delta under the key
`personalization_decision`. The schema is defined with Zod in `agent.ts`:

```typescript
const PersonalizationDecisionSchema = z.object({
  components: z.array(
    z.object({
      component: z.enum([
        'HeroBanner',
        'FeaturedCategoryRail',
        'PersonalizedBanner',
      ]),
      contentId: z.string().nullable(),
      propsOverrides: z.record(z.unknown()),
      priority: z.number(),
      score: z.number(),
      reasoning: z.string(),
    })
  ),
  reasoning: z.object({
    intent: z.enum(['buy_now', 'price_shop', 'exploring', 'uncertain']),
    confidence: z.number(),
    factors: z.array(z.string()),
    modelVersion: z.literal('adk-v1'),
  }),
});
```

---

## Configuration

These variables are used throughout this document. Set them as environment
variables or replace them inline in the commands below.

| Variable                   | Description               | How to set                                                                                                   |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `${GCP_PROJECT_ID}`        | GCP project ID            | `ADK_PROJECT` env var or `--project` CLI arg                                                                 |
| `${GCP_LOCATION}`          | GCP region                | `ADK_LOCATION` env var or `--location` CLI arg                                                               |
| `${SERVICE_ACCOUNT_NAME}`  | Service account name      | `ADK_SERVICE_ACCOUNT` env var or `--service-account` CLI arg                                                 |
| `${SERVICE_ACCOUNT_EMAIL}` | Service account email     | Computed from `${SERVICE_ACCOUNT_NAME}`@`${GCP_PROJECT_ID}`                                                  |
| `${DISPLAY_NAME}`          | Agent Engine display name | `ADK_DISPLAY_NAME` env var or `--display-name` CLI arg                                                       |
| `${DOCKER_IMAGE}`          | Docker image URI          | `ADK_IMAGE` env var or `--image` CLI arg; computed from `${GCP_LOCATION}` and `${GCP_PROJECT_ID}` if not set |

---

## One-time GCP Setup

### Prerequisites

- gcloud CLI installed and authenticated
- Access to GCP project `${GCP_PROJECT_ID}`

### 1. Create Artifact Registry Repository

```bash
gcloud artifacts repositories create adk-agent \
  --repository-format=docker \
  --location=${GCP_LOCATION} \
  --project=${GCP_PROJECT_ID}
```

This repo holds the Docker image that Agent Engine pulls at deploy time.

### 2. Create the Service Account

Two service accounts exist for two different purposes:

| Purpose                       | SA Email                   | Where Used                                                |
| ----------------------------- | -------------------------- | --------------------------------------------------------- |
| Agent Engine runtime identity | `${SERVICE_ACCOUNT_EMAIL}` | Deployed in `deploy_agent_engine.py` as `service_account` |
| BFF-to-engine auth            | `${SERVICE_ACCOUNT_EMAIL}` | Same SA used in Render via key file                       |

Both use the same service account:

```bash
gcloud iam service-accounts create ${SERVICE_ACCOUNT_NAME} \
  --display-name="ADK Agent Runtime"
```

Full email:
`${SERVICE_ACCOUNT_EMAIL}`

### 3. Enable Required GCP APIs

The project must have the Cloud Trace API and Cloud Logging API enabled for
telemetry ingestion. Without these, the Traces and Dashboards tabs in Agent
Engine show no data.

```bash
gcloud services enable cloudtrace.googleapis.com --project=${GCP_PROJECT_ID}
gcloud services enable logging.googleapis.com --project=${GCP_PROJECT_ID}
```

### 4. Grant IAM Permissions

**For the Agent Engine runtime** (the SA must write traces and logs):

```bash
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/cloudtrace.agent"

gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/logging.logWriter"
```

These grant access to Cloud Trace and Cloud Logging so Dashboards and Traces
appear in the Vertex AI Agent Engine monitoring tab.

**For the BFF (Render) to call the engine:**

Grant the SA Vertex AI User on the specific reasoning engine resource:

1. Go to **Vertex AI > Agent Engine** in Cloud Console
2. Select the deployed engine
3. Click the **Permissions** tab
4. Add `${SERVICE_ACCOUNT_EMAIL}`
5. Select role **Vertex AI User** (`roles/aiplatform.user`)
6. Save

### 5. Generate a Service Account Key (for BFF)

The BFF on Render needs a key file to authenticate to Vertex AI:

```bash
gcloud iam service-accounts keys create personalization-agent-key.json \
  --iam-account=${SERVICE_ACCOUNT_EMAIL}
```

### 6. Base64-encode the Key

```bash
base64 -i personalization-agent-key.json | tr -d '\n' | pbcopy
```

Set this as the `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` secret in the Render
dashboard for the content subgraph service.

Delete the local key file:

```bash
rm personalization-agent-key.json
```

---

## Local Development

### Prerequisites

- Node.js >= 24
- pnpm >= 9 (enable with `corepack enable && corepack prepare pnpm@9.0.0 --activate`)
- gcloud CLI authenticated with Application Default Credentials (ADC)
- Network access to GCP Vertex AI (the session service connects to the cloud
  even in local dev)
- The model used by the agent must be available in the GCP region

### Setup

```bash
# From the repository root
pnpm install

# Set up env vars
cp apps/adk-agent/.env.sample apps/adk-agent/.env
```

Edit `apps/adk-agent/.env` with your GCP project values:

| Variable                | Required | Value                                        |
| ----------------------- | -------- | -------------------------------------------- |
| `GOOGLE_CLOUD_PROJECT`  | Yes      | `${GCP_PROJECT_ID}`                          |
| `GOOGLE_CLOUD_LOCATION` | Yes      | `${GCP_LOCATION}`                            |
| `AGENT_ENGINE_ID`       | No       | Set for deployed mode; leave empty for local |

The agent connects to `VertexAiSessionService` on startup even in local dev.
If the session service cannot reach GCP, the server will fail to start.

### Run Dev Server

```bash
pnpm --filter @gfed-medusa-bff/adk-agent dev
```

Starts on `http://localhost:3100` with hot-reload via `tsx watch`.

### ADK CLI

The ADK includes a CLI with two tools:

```bash
# Launch the ADK web UI for testing agents in a browser
pnpm --filter @gfed-medusa-bff/adk-agent adk:web

# Deploy the agent via ADK's own deploy tool (alternative to deploy_agent_engine.py)
pnpm --filter @gfed-medusa-bff/adk-agent adk:deploy
```

These run the `adk` CLI commands defined in `package.json`. For the ADK web UI,
point your browser to the URL printed in the terminal.

### Run Tests

```bash
pnpm --filter @gfed-medusa-bff/adk-agent test
```

---

## Docker Build and Push

The Docker image is hosted in Artifact Registry at:
`${DOCKER_IMAGE}`

### Build

```bash
# Build the agent first
pnpm --filter @gfed-medusa-bff/adk-agent build

# Build the Docker image (run from apps/adk-agent)
docker build -f Dockerfile \
  -t ${DOCKER_IMAGE} \
  .
```

### Push

```bash
# Authenticate to Artifact Registry
gcloud auth configure-docker ${GCP_LOCATION}-docker.pkg.dev

# Push
docker push ${DOCKER_IMAGE}
```

---

## Deploy to Vertex AI Agent Engine

### Prerequisites

- Python >= 3.10
- Docker image pushed (see above)
- Authenticated gcloud CLI

### Deploy Script

```bash
./deploy-agent-engine.sh
```

This script:

1. Creates a temporary Python venv at `/tmp/adk-deploy`
2. Installs `google-cloud-aiplatform>=1.126.1`
3. Runs `apps/adk-agent/deploy_agent_engine.py`

The Python script does the following:

- Looks for an existing engine with `display_name="${DISPLAY_NAME}"`
- If found: updates it with the new container image
- If not found: creates a new engine
- Applies the service account, env vars, and resource limits defined in the script

### Full Redeploy Cycle

```bash
# 1. Build the agent
pnpm --filter @gfed-medusa-bff/adk-agent build

# 2. Build and push Docker image
docker build -f Dockerfile \
  -t ${DOCKER_IMAGE} \
  . && \
docker push ${DOCKER_IMAGE}

# 3. Deploy to Agent Engine
./deploy-agent-engine.sh --env AGENT_ENGINE_ID=<engine-id> --env PROJECT_ID=${GCP_PROJECT_ID}
```

Pass `AGENT_ENGINE_ID` via `--env` so the container can construct the
`cloud.resource_id` OTel attribute. This makes traces visible in the
Agent Engine Traces tab. Without it, traces reach Cloud Trace but the
dashboard filter cannot find them.

On first deploy, omit `--env AGENT_ENGINE_ID`. After the engine is created,
note its ID from the console or script output, then include it in subsequent
deployments.

### Resource Configuration

Set in `deploy_agent_engine.py`:

| Setting               | Value                      |
| --------------------- | -------------------------- |
| Min instances         | 1                          |
| Max instances         | 10                         |
| CPU                   | 1                          |
| Memory                | 2Gi                        |
| Container concurrency | 9                          |
| Service account       | `${SERVICE_ACCOUNT_EMAIL}` |

### Telemetry Env Vars

Automatically injected by the deploy script:

| Variable                                             | Value                        | Set by            |
| ---------------------------------------------------- | ---------------------------- | ----------------- |
| `GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY`         | `true`                       | Script (built-in) |
| `OTEL_SEMCONV_STABILITY_OPT_IN`                      | `gen_ai_latest_experimental` | Script (built-in) |
| `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` | `EVENT_ONLY`                 | Script (built-in) |
| `AGENT_ENGINE_ID`                                    | engine ID (e.g. 7280...)     | `--env` argument  |
| `PROJECT_ID`                                         | `${GCP_PROJECT_ID}`          | `--env` argument  |

These enable the Dashboards and Traces tabs in the Vertex AI Agent Engine UI.
`AGENT_ENGINE_ID` is required for the OTel `cloud.resource_id` attribute that
the dashboard uses to find traces. `PROJECT_ID` is required because the
container cannot auto-detect the GCP project ID (the `GOOGLE_CLOUD_PROJECT` env
var is reserved by Vertex AI and not actually injected for custom containers).
Pass both via `--env` (see Deploy section).

### Additional Env Vars

Pass extra env vars to the deploy script:

```bash
./deploy-agent-engine.sh --env KEY=VALUE --env KEY2=VALUE2
```

Reserved env vars (`GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`) are
automatically filtered out because Vertex AI reserves them. Pass the project ID
via `--env PROJECT_ID=...` instead.

### Override Service Account

```bash
./deploy-agent-engine.sh --service-account other-sa@project.iam.gserviceaccount.com
```

---

## BFF Integration (Content Subgraph)

The content subgraph in `apps/subgraphs/content` calls this agent from
`src/services/personalization/adk-client.ts`. It supports two modes:

### Deployed Mode

When `ADK_AGENT_MODE=deployed`, the BFF calls the Vertex AI Agent Engine API:

```
POST https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT_NUMBER}/
  locations/us-central1/reasoningEngines/{ENGINE_ID}:predict
```

Auth: The BFF decodes `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64`, passes it to
`GoogleAuth`, and the library generates a short-lived bearer token.

### Local Mode (direct HTTP)

When `ADK_AGENT_MODE` is absent or set to `local`, the BFF calls the agent
directly at `http://localhost:3100/agent/personalize`.

### BFF Env Vars

Set in the Render dashboard for the content subgraph:

| Variable                            | Purpose                                     |
| ----------------------------------- | ------------------------------------------- |
| `ADK_AGENT_MODE`                    | `deployed` or `local`                       |
| `ADK_ENGINE_ID`                     | Vertex AI Agent Engine resource ID          |
| `ADK_GCP_PROJECT_NUMBER`            | GCP project number (not project ID)         |
| `ADK_GCP_PROJECT_ID`                | GCP project ID                              |
| `ADK_GCP_LOCATION`                  | GCP region (e.g. `us-central1`)             |
| `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` | Base64-encoded SA key (see setup section 5) |

---

## Environment Variables Reference

### Build-time (Docker ARG)

Set via `docker build --build-arg VAR=value`:

| Variable                | Default                 | Purpose                         |
| ----------------------- | ----------------------- | ------------------------------- |
| `ADK_PORT`              | `3100`                  | Container port                  |
| `AGENT_TIMEOUT_MS`      | `15000`                 | LLM timeout in ms               |
| `MODEL`                 | `gemini-2.5-flash-lite` | Gemini model                    |
| `GOOGLE_CLOUD_PROJECT`  | (empty)                 | GCP project ID                  |
| `GOOGLE_CLOUD_LOCATION` | `us-central1`           | GCP region                      |
| `AGENT_ENGINE_ID`       | (empty)                 | Engine ID (for session service) |
| `ALLOWED_ORIGINS`       | `*`                     | CORS origins                    |

### Run-time (injected by deploy script or Agent Engine)

| Variable                                             | Set By                 | Purpose                                                   |
| ---------------------------------------------------- | ---------------------- | --------------------------------------------------------- |
| `GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY`         | Deploy script          | Enable OTel                                               |
| `OTEL_SEMCONV_STABILITY_OPT_IN`                      | Deploy script          | GenAI telemetry                                           |
| `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` | Deploy script          | Capture event content                                     |
| `GOOGLE_GENAI_USE_VERTEXAI`                          | Dockerfile (hardcoded) | Use Vertex AI backend                                     |
| `GOOGLE_CLOUD_PROJECT`                               | Agent Engine runtime   | Reserved by Vertex AI; not injected for custom containers |
| `GOOGLE_CLOUD_LOCATION`                              | Agent Engine runtime   | Injected by platform                                      |
| `AGENT_ENGINE_ID`                                    | `--env` arg to deploy  | Required for OTel                                         |
