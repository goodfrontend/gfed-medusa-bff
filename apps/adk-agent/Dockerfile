# Deployment Dockerfile for ADK Agent Engine — use `docker build -f Dockerfile -t <image> .` to build.
FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Strip workspace devDeps that pnpm can't resolve in isolation
COPY package.json ./
RUN node -e "const p=require('./package.json'); delete p.devDependencies; require('fs').writeFileSync('./package.json', JSON.stringify(p,null,2))"

RUN pnpm install --prod --ignore-scripts
COPY dist ./dist

# Build-time injectable env vars with defaults (override via --build-arg)
ARG ADK_PORT=3100
ENV ADK_PORT=$ADK_PORT

ARG AGENT_TIMEOUT_MS=15000
ENV AGENT_TIMEOUT_MS=$AGENT_TIMEOUT_MS

ARG MODEL=gemini-2.5-flash-lite
ENV MODEL=$MODEL

ARG GOOGLE_CLOUD_PROJECT=
ENV GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT

ARG GOOGLE_CLOUD_LOCATION=us-central1
ENV GOOGLE_CLOUD_LOCATION=$GOOGLE_CLOUD_LOCATION

ARG AGENT_ENGINE_ID=
ENV AGENT_ENGINE_ID=$AGENT_ENGINE_ID

ARG ALLOWED_ORIGINS=*
ENV ALLOWED_ORIGINS=$ALLOWED_ORIGINS

ENV GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY=true
ENV OTEL_SEMCONV_STABILITY_OPT_IN="gen_ai_latest_experimental"
ENV OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="SPAN_AND_EVENT"
ENV GOOGLE_GENAI_USE_VERTEXAI=true

EXPOSE 3100 8080
CMD ["node", "dist/index.js"]
