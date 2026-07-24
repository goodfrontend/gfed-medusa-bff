import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';

import type { Event } from '@google/adk';
import {
  ROOT_CONTEXT,
  TraceFlags,
  context,
  propagation,
  trace,
} from '@opentelemetry/api';
import type { Context, SpanContext } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import { createRootAgent } from './agent';
import { MOMENTUM_SCORE_HIGH_ENGAGEMENT } from './config/constants';
import {
  buildDecisionWithMinimums,
  classifyIntent,
  validateContentIds,
} from './services/index';
import { writeTraceLogEntry } from './tracing/cloud-logging';
import {
  assistantTextMessage,
  serializeGenAi,
  systemInstructionParts,
  userTextMessage,
} from './tracing/genai-messages';
import { getTokenUsage } from './tracing/token-usage';
import type {
  AvailableContent,
  DecisionComponent,
  EngagementLevel,
  Profile,
} from './types';

const PORT = parseInt(process.env.PORT || process.env.ADK_PORT || '3100', 10);

// Configurable agent timeout — overridable via env var (for testability).
// Default is below Vertex Agent Engine proxy deadline (~30s) so AbortSignal
// timeout + fallback can respond with 200 before the proxy returns opaque 500.
let AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS) || 15_000;

let tracerProvider: NodeTracerProvider | undefined = undefined;

let engineConfig:
  | {
      projectId: string;
      projectNumber: string;
      location: string;
      engineId: string;
    }
  | undefined;

function getTracer() {
  return trace.getTracer('personalization-agent');
}

export function setAgentTimeoutMs(ms: number): void {
  AGENT_TIMEOUT_MS = ms;
}

// Set up OTel BEFORE loading any ADK module. The ADK's telemetry/tracing.js
// creates `const tracer = trace.getTracer(...)` at module scope. If we
// register the global provider first, the ADK tracer uses our provider.
if (process.env.VITEST !== 'true') {
  try {
    const projectId = process.env.PROJECT_ID || '';
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    const rawEngineId =
      process.env.GOOGLE_CLOUD_AGENT_ENGINE_ID ||
      process.env.AGENT_ENGINE_ID ||
      '';
    const resourceProjectId =
      process.env.GOOGLE_CLOUD_PROJECT || projectId || '';

    const { NodeTracerProvider } =
      await import('@opentelemetry/sdk-trace-node');
    const { BatchSpanProcessor } =
      await import('@opentelemetry/sdk-trace-base');
    const { OTLPTraceExporter } =
      await import('@opentelemetry/exporter-trace-otlp-http');
    const { MetricExporter } =
      await import('@google-cloud/opentelemetry-cloud-monitoring-exporter');
    const { MeterProvider, PeriodicExportingMetricReader } =
      await import('@opentelemetry/sdk-metrics');
    const { metrics } = await import('@opentelemetry/api');
    const { gcpDetector } =
      await import('@opentelemetry/resource-detector-gcp');
    const { detectResources } = await import('@opentelemetry/resources');

    const isFullResourceName = /^projects\//.test(rawEngineId);

    const cloudResourceId = rawEngineId
      ? isFullResourceName
        ? `//aiplatform.googleapis.com/${rawEngineId}`
        : `//aiplatform.googleapis.com/projects/${projectId}/locations/${location}/reasoningEngines/${rawEngineId}`
      : undefined;

    const shortEngineId = rawEngineId
      ? isFullResourceName
        ? rawEngineId.split('/').pop() || rawEngineId
        : rawEngineId
      : '';

    const manualResource = resourceFromAttributes(
      Object.fromEntries(
        Object.entries({
          'cloud.provider': 'gcp',
          'cloud.region': location,
          'cloud.resource_id': cloudResourceId,
          'gcp.resource_type': 'aiplatform.googleapis.com/ReasoningEngine',
          'gcp.project_id': resourceProjectId,
          'cloud.account.id': resourceProjectId,
          reasoning_engine_id: shortEngineId,
          'service.name': shortEngineId || 'personalization_agent',
          'service.instance.id': `${crypto.randomUUID().slice(0, 8)}-${process.pid}`,
        }).filter(([_, v]) => v != null && v !== '')
      )
    );

    const gcpResource = await detectResources({ detectors: [gcpDetector] });
    const otelResource = gcpResource.merge(manualResource);

    const exporterHeaders: Record<string, string> = {
      'User-Agent': 'Vertex-Agent-Engine/0.1.0 OTel-OTLP-Exporter-JS/0.221.0',
    };

    if (projectId) {
      try {
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth({
          projectId,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        if (token?.token) {
          exporterHeaders['Authorization'] = `Bearer ${token.token}`;
        }
      } catch {
        // auth is best-effort
      }
    }

    const spanProcessors = projectId
      ? [
          new BatchSpanProcessor(
            new OTLPTraceExporter({
              url: 'https://telemetry.googleapis.com/v1/traces',
              headers: exporterHeaders,
            }),
            { scheduledDelayMillis: 1000 }
          ),
        ]
      : [];

    if (spanProcessors.length > 0) {
      tracerProvider = new NodeTracerProvider({
        resource: otelResource,
        spanProcessors,
      });
      tracerProvider.register();
    }

    const metricReaders = projectId
      ? [
          new PeriodicExportingMetricReader({
            exporter: new MetricExporter({ projectId }),
            exportIntervalMillis: 5_000,
          }),
        ]
      : [];

    if (metricReaders.length > 0) {
      const meterProvider = new MeterProvider({
        readers: metricReaders,
        resource: otelResource,
      });
      metrics.setGlobalMeterProvider(meterProvider);
    }

    engineConfig =
      projectId && shortEngineId
        ? {
            projectId,
            projectNumber: resourceProjectId,
            location,
            engineId: shortEngineId,
          }
        : undefined;

    console.log(
      '[TELEMETRY] OTel providers registered with engine',
      shortEngineId || 'none'
    );
  } catch (err: unknown) {
    console.warn('[TELEMETRY] Failed to set up OTel:', err);
  }
}

// Import ADK after OTel is set up so tracing.js uses our provider.
const { Runner, VertexAiSessionService, isFinalResponse, stringifyContent } =
  await import('@google/adk');
const { TelemetryFixPlugin } = await import('./tracing/telemetry-plugin');

const personalizationAgent = await createRootAgent();

export const app = express() as ReturnType<typeof express>;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  : '*';
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.use((req: Request, res: Response, next) => {
  const path = req.path.replace(/\/+$/, '');
  if (req.method === 'GET' && (path === '/' || path === '/health')) {
    return next();
  }

  next();
});

const resolvedEngineIdRaw: string =
  process.env.GOOGLE_CLOUD_AGENT_ENGINE_ID ||
  process.env.AGENT_ENGINE_ID ||
  'personalization_agent';
const resolvedEngineId: string = /^projects\//.test(resolvedEngineIdRaw)
  ? resolvedEngineIdRaw.split('/').pop() || resolvedEngineIdRaw
  : resolvedEngineIdRaw;

// Pre-create runner — reused across requests (DO NOT CHANGE)
const sessionService = new VertexAiSessionService({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION,
  agentEngineId:
    resolvedEngineId === 'personalization_agent' ? undefined : resolvedEngineId,
});
const runner = new Runner({
  appName: 'personalization_agent',
  agent: personalizationAgent,
  sessionService,
  plugins: [new TelemetryFixPlugin()],
});

// Single session reused across requests (agent is stateless — full context in prompt)
const agentSession = await runner.sessionService.createSession({
  appName: runner.appName,
  userId: 'static-agent',
});
const AGENT_SESSION_ID = agentSession.id;

/**
 * Build a schema-valid default PersonalizationDecision for when the agent
 * produces no output (safety block, insufficient data, etc.).
 */
export function buildDefaultPersonalizationDecision(): Record<string, unknown> {
  return {
    components: [
      {
        component: 'HeroBanner',
        contentId: null,
        propsOverrides: {},
        priority: 1,
        score: 0,
        reasoning: 'Fallback: welcome banner (agent produced no output)',
      },
      {
        component: 'FeaturedCategoryRail',
        contentId: null,
        propsOverrides: { handle: 'mens', title: 'Shop Men' },
        priority: 2,
        score: 0,
        reasoning: 'Fallback: generic category rail (agent produced no output)',
      },
    ],
    reasoning: {
      intent: 'exploring' as const,
      confidence: 0,
      factors: ['fallback: agent produced no output'],
      modelVersion: 'adk-v1' as const,
    },
  };
}

/**
 * Detect whether an error represents a 429 quota-exhausted error from the
 * Gemini / Vertex AI model API.
 */
export function isQuotaError(err: unknown): boolean {
  if (!err) return false;

  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    if (Number(obj.status) === 429 || Number(obj.code) === 429) return true;
  }

  const msg = err instanceof Error ? err.message : String(err);
  return /429|resource\s*exhausted|quota/i.test(msg);
}

/**
 * Detect whether an error represents a timeout or abort.
 */
export function isTimeoutError(err: unknown): boolean {
  if (!err) return false;

  if (
    typeof DOMException !== 'undefined' &&
    err instanceof DOMException &&
    err.name === 'AbortError'
  )
    return true;

  if (err instanceof Error && err.name === 'AbortError') return true;

  if (
    err instanceof Error &&
    (err as unknown as Record<string, unknown>).code === 'TimeoutError'
  )
    return true;

  if (err instanceof Error && err.message.toLowerCase().includes('timeout'))
    return true;

  return false;
}

/**
 * Send a fallback personalization decision response (reasoning_engine format).
 */
function sendFallbackDecision(res: Response): Response {
  return res.json({
    output: { personalization_decision: buildDefaultPersonalizationDecision() },
  });
}

/**
 * Resolve agent output text from an async event generator.
 */
export async function resolveAgentText(
  source: AsyncGenerator<Event, void, undefined> | Event[],
  outputKey?: string
): Promise<string> {
  let finalEvent: Event | undefined;
  let outputFromState: unknown;

  if (Array.isArray(source)) {
    for (const event of source) {
      if (isFinalResponse(event)) {
        finalEvent = event;
      }
      if (outputKey) {
        const delta = event.actions?.stateDelta?.[outputKey];
        if (delta != null) {
          outputFromState = delta;
        }
      }
    }
  } else {
    for await (const event of source) {
      if (isFinalResponse(event)) {
        finalEvent = event;
      }
      if (outputKey) {
        const delta = event.actions?.stateDelta?.[outputKey];
        if (delta != null) {
          outputFromState = delta;
        }
      }
    }
  }

  if (outputFromState != null) {
    const text =
      typeof outputFromState === 'string'
        ? outputFromState
        : JSON.stringify(outputFromState, null, 2);
    return text;
  }

  if (!finalEvent) return '';

  let text = stringifyContent(finalEvent).trim();

  if (!text && outputKey) {
    const delta = finalEvent.actions?.stateDelta?.[outputKey];
    if (delta != null) {
      text = typeof delta === 'string' ? delta : JSON.stringify(delta, null, 2);
    }
  }

  if (!text) {
    console.warn('[AGENT] No text output from agent', {
      finishReason: finalEvent.finishReason,
      errorCode: finalEvent.errorCode,
      errorMessage: finalEvent.errorMessage,
      partTypes: finalEvent.content?.parts
        ?.map((p) => Object.keys(p as Record<string, unknown>))
        .flat(),
    });
  }

  return text;
}

function extractTraceContext(req: Request): Context {
  const ctx = propagation.extract(ROOT_CONTEXT, {
    traceparent: req.headers['traceparent'] as string | undefined,
    tracestate: req.headers['tracestate'] as string | undefined,
  });

  const cloudHeader = req.headers['x-cloud-trace-context'] as
    string | undefined;
  if (cloudHeader) {
    const match = cloudHeader.match(
      /^([0-9a-f]{32}|[0-9a-f]{16})\/([0-9a-f]{16})(?:;o=(\d))?$/
    );
    if (match && match[1]) {
      let traceId = match[1];
      if (traceId.length === 16) {
        traceId = '0000000000000000' + traceId;
      }
      const spanContext: SpanContext = {
        traceId,
        spanId: match[2] || traceId.slice(0, 16),
        traceFlags: match[3] === '1' ? TraceFlags.SAMPLED : TraceFlags.NONE,
        isRemote: true,
      };
      return trace.setSpanContext(ctx, spanContext);
    }
  }

  return ctx;
}

async function runAgentWithTimeout(
  userId: string,
  newMessage: { role?: string; parts: Array<{ text?: string }> },
  parentContext: Context = context.active()
): Promise<Event[]> {
  const agentName = resolvedEngineId;

  return getTracer().startActiveSpan(
    'agent.run',
    {
      attributes: {
        'gen_ai.system': 'vertex_ai',
        'gen_ai.operation.name': 'invoke_agent',
        'gen_ai.provider.name': 'gcp.vertex_ai',
        'gen_ai.request.model': process.env.MODEL || 'gemini-2.5-flash-lite',
        'gen_ai.agent.name': agentName,
        'gen_ai.agent.description': 'Personalization agent powered by ADK',
        'gen_ai.conversation.id': AGENT_SESSION_ID,
        'gen_ai.output.type': 'json',
      },
    },
    parentContext,
    async (span) => {
      const agentEvents: Event[] = [];

      try {
        const gen = runner.runAsync({
          userId: 'static-agent',
          sessionId: AGENT_SESSION_ID,
          newMessage,
          abortSignal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
        });

        for await (const event of gen) {
          agentEvents.push(event);
        }
        return agentEvents;
      } finally {
        // GenAI semantic convention: role + parts (not flat content strings).
        // Agent Runtime Input/Output columns and Online Monitors require this shape.
        const inputMessages = [
          userTextMessage(stringifyMessageParts(newMessage.parts)),
        ];
        // Prefer the last text-bearing model event as the agent response.
        const textEvents = agentEvents.filter(
          (e: Event) =>
            !!e.content?.parts?.some(
              (p) => (p as Record<string, unknown>).text
            )
        );
        const outputMessages =
          textEvents.length > 0
            ? textEvents.map((e: Event) =>
                assistantTextMessage(stringifyContent(e))
              )
            : [];

        const instruction =
          ((personalizationAgent as unknown as Record<string, unknown>)
            .instruction as string) || '';
        const systemInstructions = systemInstructionParts(instruction);
        const tools =
          ((personalizationAgent as unknown as Record<string, unknown>)
            .tools as unknown[]) || [];

        const inputMsgs = serializeGenAi(inputMessages);
        const outputMsgs = serializeGenAi(outputMessages);
        const sysInstr = serializeGenAi(systemInstructions);
        const toolDefs = serializeGenAi(tools);

        const tu = getTokenUsage();
        const modelName = process.env.MODEL || 'gemini-2.5-flash-lite';

        // Online monitors require this event on the invoke_agent span with
        // input/output messages, system_instructions, and tool.definitions.
        span.addEvent('gen_ai.client.inference.operation.details', {
          'gen_ai.operation.name': 'invoke_agent',
          'gen_ai.provider.name': 'gcp.vertex_ai',
          'gen_ai.system': 'vertex_ai',
          'gen_ai.request.model': modelName,
          'gen_ai.conversation.id': AGENT_SESSION_ID,
          'gen_ai.agent.name': agentName,
          'gen_ai.agent.description':
            'Personalization agent powered by ADK',
          'gen_ai.output.type': 'json',
          'gen_ai.input.messages': inputMsgs,
          'gen_ai.output.messages': outputMsgs,
          'gen_ai.system_instructions': sysInstr,
          'gen_ai.tool.definitions': toolDefs,
          ...(tu
            ? {
                'gen_ai.usage.input_tokens': tu.input,
                'gen_ai.usage.output_tokens': tu.output,
              }
            : {}),
        });

        span.setAttributes({
          'gen_ai.input.messages': inputMsgs,
          'gen_ai.output.messages': outputMsgs,
          'gen_ai.system_instructions': sysInstr,
          'gen_ai.tool.definitions': toolDefs,
        });

        if (tu) {
          span.setAttribute('gen_ai.usage.input_tokens', tu.input);
          span.setAttribute('gen_ai.usage.output_tokens', tu.output);
        }

        const sc = span.spanContext();
        await writeTraceLogEntry({
          projectId:
            engineConfig?.projectId || process.env.PROJECT_ID || '',
          projectNumber: engineConfig?.projectNumber,
          location: engineConfig?.location || process.env.GOOGLE_CLOUD_LOCATION,
          reasoningEngineId: engineConfig?.engineId || agentName,
          traceId: sc.traceId,
          spanId: sc.spanId,
          inputMessages,
          outputMessages,
          systemInstructions,
          toolDefinitions: tools,
          inputTokens: tu?.input,
          outputTokens: tu?.output,
          model: modelName,
          operationName: 'invoke_agent',
          conversationId: AGENT_SESSION_ID,
          agentName,
          agentDescription: 'Personalization agent powered by ADK',
          traceSampled: (sc.traceFlags & 1) === 1,
        });

        span.end();
        try {
          await tracerProvider?.forceFlush();
        } catch {
          // flush is best-effort
        }
      }
    }
  );
}

function stringifyMessageParts(parts: Array<{ text?: string }>): string {
  return parts.map((p) => p.text || '').join('');
}

/**
 * Determine engagement level from profile signals.
 */
function determineEngagementLevel(profile: Profile): EngagementLevel {
  const momentumScore = profile.momentumScore ?? 0;
  const cartActivity = profile.cartActivity ?? 0;
  const behavioralLifecycle = profile.behavioralLifecycle ?? '';
  const lifecycleStage = profile.lifecycleStage ?? '';

  if (
    momentumScore > MOMENTUM_SCORE_HIGH_ENGAGEMENT ||
    cartActivity > 0 ||
    behavioralLifecycle === 'LOYAL' ||
    lifecycleStage === 'LOYAL'
  ) {
    return 'HIGH';
  }

  if (profile.engagementLevel) {
    return profile.engagementLevel;
  }

  return 'LOW';
}

app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    agent: 'personalization_agent',
    model: process.env.MODEL || 'gemini-2.5-flash-lite',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', async (_req: Request, res: Response) => {
  try {
    await runner.sessionService.getSession({
      appName: runner.appName,
      userId: 'static-agent',
      sessionId: AGENT_SESSION_ID,
    });
    res.json({
      status: 'healthy',
      agent: 'personalization_agent',
      model: process.env.MODEL || 'gemini-2.5-flash-lite',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      agent: 'personalization_agent',
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Handle a reasoning engine request — shared by POST / (Vertex AI default path)
 * and POST /api/reasoning_engine (explicit path).
 */
async function handleReasoningEngineRequest(req: Request, res: Response) {
  let body: Record<string, unknown> | undefined = req.body as
    Record<string, unknown> | undefined;
  if (!body || Object.keys(body).length === 0) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<
      string,
      unknown
    >;
  }

  if (!body) {
    return res.status(400).json({ error: 'Request body is required' });
  }

  try {
    const inner = (body.input ?? body) as Record<string, unknown>;
    const rawMsg = (inner.newMessage ?? inner.new_message) as {
      role?: string;
      parts: Array<{ text?: string }>;
    };
    const userId =
      ((inner.userId ?? inner.user_id) as string) || 'agent-engine';
    if (!rawMsg?.parts?.length) {
      return res.status(400).json({ error: 'no parts in message' });
    }

    // Step 1: Parse user prompt to extract profile and available content
    const userPromptText = rawMsg.parts[0]?.text;
    let profile: Profile | undefined;
    let availableContent: AvailableContent[] = [];

    try {
      const parsed = JSON.parse(userPromptText ?? '{}') as Record<
        string,
        unknown
      >;
      if (parsed.profile) {
        profile = parsed.profile as Profile;
      }
      if (parsed.availableContent) {
        availableContent = parsed.availableContent as AvailableContent[];
      }
    } catch {
      // Not valid JSON — skip intent pre-computation
    }

    // Step 2: Classify intent deterministically (replaces Fix A)
    let suggestedIntent: string | undefined;
    if (profile) {
      const intentClassification = classifyIntent(profile);
      suggestedIntent = intentClassification.intent;
    }

    // Step 3: Inject intent into prompt if available
    const partsWithIntent = suggestedIntent
      ? [
          {
            text: `[SYSTEM OVERRIDE] The intent for this user MUST be "${suggestedIntent}". This overrides all other considerations. Do NOT use "exploring" unless explicitly directed. This user's profile signals conclusively indicate "${suggestedIntent}".`,
          },
          ...rawMsg.parts,
        ]
      : rawMsg.parts;

    // Step 4: Run the agent with ADK-native abort
    const events = await runAgentWithTimeout(
      userId,
      {
        role: (rawMsg.role || 'user') as 'user',
        parts: partsWithIntent,
      },
      extractTraceContext(req)
    );
    const resultText = await resolveAgentText(
      events,
      'personalization_decision'
    );

    if (!resultText) {
      console.warn(
        '[REASONING_ENGINE] Agent produced no text output, using fallback decision'
      );
      return sendFallbackDecision(res);
    }

    // Parse agent's JSON output
    let decision: unknown;
    try {
      const cleaned = resultText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      decision = JSON.parse(cleaned);
    } catch {
      console.warn(
        '[REASONING_ENGINE] Agent returned invalid JSON, using fallback decision'
      );
      return sendFallbackDecision(res);
    }

    // Step 5: Validate contentIds and enforce minimums (replaces Fix B + C)
    if (availableContent.length > 0) {
      const typedDecision = decision as Record<string, unknown>;
      const components = typedDecision.components as
        DecisionComponent[] | undefined;

      if (components) {
        // Validate contentIds (Fix B) - always run when content is available
        const validated = validateContentIds(components, availableContent);

        typedDecision.components = validated.components;

        if (validated.replacedIds.length > 0) {
          console.warn(
            '[REASONING_ENGINE] Replaced invalid contentIds:',
            validated.replacedIds
          );
        }
        if (validated.removedComponents.length > 0) {
          console.warn(
            '[REASONING_ENGINE] Removed components with no valid content:',
            validated.removedComponents
          );
        }

        // Enforce minimum component counts (Fix C) - requires profile
        if (profile) {
          const engagementLevel = determineEngagementLevel(profile);
          const { components: finalComponents } = buildDecisionWithMinimums(
            validated.components,
            engagementLevel,
            availableContent,
            profile.lifecycleStage
          );

          typedDecision.components = finalComponents;
        }
      }
    }

    return res.json({ output: { personalization_decision: decision } });
  } catch (err) {
    if (isTimeoutError(err) || isQuotaError(err)) {
      console.warn(
        '[REASONING_ENGINE] Agent timed out or quota exhausted, using fallback decision'
      );
      return sendFallbackDecision(res);
    }
    console.error('[REASONING_ENGINE]', err);
    return res.status(500).json({ error: String(err) });
  }
}

// Agent Engine protocol handlers (Vertex AI default path + explicit path)
app.post('/', handleReasoningEngineRequest);
app.post('/api/reasoning_engine', handleReasoningEngineRequest);

// Personalization endpoint
app.post('/agent/personalize', async (req: Request, res: Response) => {
  const {
    deviceId,
    surface,
    page,
    userProfile,
    availableContent,
    availableProducts,
  } = req.body as {
    deviceId?: string;
    surface?: string;
    page?: string;
    userProfile?: Record<string, unknown>;
    availableContent?: Array<Record<string, unknown>>;
    availableProducts?: Array<Record<string, unknown>>;
  };

  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId is required' });
  }

  try {
    const stateDelta: Record<string, unknown> = {
      deviceId,
      surface: surface || 'homepage',
      page: page || 'homepage',
    };
    if (userProfile) stateDelta.profile = userProfile;
    if (availableContent) stateDelta.availableContent = availableContent;
    if (availableProducts) stateDelta.availableProducts = availableProducts;

    const events = await runAgentWithTimeout(
      deviceId,
      {
        role: 'user',
        parts: [{ text: JSON.stringify(stateDelta) }],
      },
      extractTraceContext(req)
    );

    const modelText = await resolveAgentText(
      events,
      'personalization_decision'
    );

    if (!modelText.trim()) {
      const eventCount = events.length;
      const hasStateDelta = events.some(
        (e) => e.actions?.stateDelta?.personalization_decision != null
      );
      const finishReasons = events.map((e) => e.finishReason).filter(Boolean);
      const errorCodes = events.map((e) => e.errorCode).filter(Boolean);
      console.warn(
        '[PERSONALIZE] Agent returned empty response, using fallback decision',
        {
          eventCount,
          hasStateDelta,
          finishReasons,
          errorCodes,
        }
      );
      return res.json(buildDefaultPersonalizationDecision());
    }

    const cleaned = modelText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let decision: Record<string, unknown>;
    try {
      decision = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      console.warn(
        '[PERSONALIZE] Agent returned invalid JSON, using fallback decision'
      );
      return res.json(buildDefaultPersonalizationDecision());
    }

    // Guard: reject invented contentIds when no availableContent is provided
    if (
      (!availableContent || availableContent.length === 0) &&
      decision.components
    ) {
      const hasInventedId = (
        decision.components as Array<Record<string, unknown>>
      ).some(
        (c: Record<string, unknown>) =>
          (c.component === 'HeroBanner' ||
            c.component === 'PersonalizedBanner') &&
          c.contentId !== null &&
          c.contentId !== undefined
      );
      if (hasInventedId) {
        return res.status(422).json({
          error:
            'Agent returned contentId but no availableContent was provided',
        });
      }
    }

    // Validate contentIds against availableContent
    if (availableContent && availableContent.length > 0) {
      const validIds = new Set(
        availableContent.map((c: Record<string, unknown>) => String(c._id))
      );
      const components = decision.components as
        Array<Record<string, unknown>> | undefined;
      if (components) {
        const invalidIds: string[] = [];
        for (const comp of components) {
          if (
            (comp.component === 'HeroBanner' ||
              comp.component === 'PersonalizedBanner') &&
            comp.contentId !== null &&
            comp.contentId !== undefined
          ) {
            const cid = String(comp.contentId);
            if (!validIds.has(cid)) {
              invalidIds.push(cid);
            }
          }
        }
        if (invalidIds.length > 0) {
          return res.status(422).json({
            error: 'Agent returned contentId not in available content',
            invalidContentIds: invalidIds,
          });
        }
      }
    }

    return res.json(decision);
  } catch (error) {
    if (isTimeoutError(error) || isQuotaError(error)) {
      console.warn(
        '[PERSONALIZE] Agent timed out or quota exhausted, using fallback decision'
      );
      return res.json(buildDefaultPersonalizationDecision());
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PERSONALIZE] error:', message);
    return res.status(500).json({ error: message });
  }
});

const server =
  process.env.VITEST !== 'true'
    ? app.listen(PORT, () => {
        console.log(`ADK Agent server running on port ${PORT}`);
      })
    : undefined;

// Graceful shutdown
function shutdown(): void {
  console.log('Shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  }
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 5_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
