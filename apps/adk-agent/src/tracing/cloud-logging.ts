import { GoogleAuth } from 'google-auth-library';

import type { GenAiMessage, GenAiPart } from './genai-messages';
import { parseGenAiJson } from './genai-messages';

const LOGGING_API = 'https://logging.googleapis.com/v2/entries:write';

/** Log name Agent Runtime / Trace Explorer join against for Inputs/Outputs. */
const GEN_AI_DETAILS_LOG = 'gen_ai.client.inference.operation.details';

let tokenCache: string | undefined;

async function getToken(): Promise<string> {
  if (tokenCache) return tokenCache;
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/logging.write'],
  });
  const client = await auth.getClient();
  const res = await client.getAccessToken();
  if (!res?.token) {
    throw new Error('No access token returned');
  }
  tokenCache = res.token;
  return tokenCache;
}

export type GenAiInferenceLogParams = {
  projectId: string;
  /** Prefer project number for resource_container when available. */
  projectNumber?: string;
  location?: string;
  reasoningEngineId?: string;
  traceId: string;
  spanId: string;
  /** JSON string or already-parsed GenAI messages array. */
  inputMessages: string | GenAiMessage[];
  /** JSON string or already-parsed GenAI messages array. */
  outputMessages: string | GenAiMessage[];
  /** JSON string or parts array for system instructions. */
  systemInstructions?: string | GenAiPart[];
  /** JSON string or tool definition array. */
  toolDefinitions?: string | unknown[];
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  operationName?: string;
  conversationId?: string;
  agentName?: string;
  agentDescription?: string;
  traceSampled?: boolean;
};

function asStructured<T>(value: string | T | undefined, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  return parseGenAiJson<T>(value) ?? fallback;
}

/**
 * Write a gen_ai.client.inference.operation.details log entry correlated to a
 * trace/span. Agent Runtime populates Input/Output columns and Online Monitors
 * from this log (joined by trace + spanId).
 */
export async function writeTraceLogEntry(
  params: GenAiInferenceLogParams
): Promise<void>;
/** @deprecated Prefer the object form. */
export async function writeTraceLogEntry(
  projectId: string,
  traceId: string,
  spanId: string,
  inputMessages: string,
  outputMessages: string,
  inputTokens: number,
  outputTokens: number,
  model: string,
  traceSampled: boolean
): Promise<void>;
export async function writeTraceLogEntry(
  projectIdOrParams: string | GenAiInferenceLogParams,
  traceId?: string,
  spanId?: string,
  inputMessages?: string,
  outputMessages?: string,
  inputTokens?: number,
  outputTokens?: number,
  model?: string,
  traceSampled?: boolean
): Promise<void> {
  const params: GenAiInferenceLogParams =
    typeof projectIdOrParams === 'string'
      ? {
          projectId: projectIdOrParams,
          traceId: traceId || '',
          spanId: spanId || '',
          inputMessages: inputMessages || '[]',
          outputMessages: outputMessages || '[]',
          inputTokens: inputTokens || 0,
          outputTokens: outputTokens || 0,
          model: model || '',
          traceSampled: traceSampled ?? false,
        }
      : projectIdOrParams;

  const {
    projectId,
    projectNumber,
    location = 'us-central1',
    reasoningEngineId,
    traceId: tid,
    spanId: sid,
  } = params;

  if (!projectId || !tid) return;

  const input = asStructured<GenAiMessage[]>(params.inputMessages, []);
  const output = asStructured<GenAiMessage[]>(params.outputMessages, []);
  const systemInstructions = asStructured<GenAiPart[]>(
    params.systemInstructions,
    []
  );
  const toolDefinitions = asStructured<unknown[]>(
    params.toolDefinitions,
    []
  );

  const operationName = params.operationName || 'invoke_agent';
  const modelName = params.model || 'gemini-2.5-flash-lite';

  // Labels must be strings; keep large message bodies in jsonPayload only.
  const labels: Record<string, string> = {
    'event.name': GEN_AI_DETAILS_LOG,
    'gen_ai.system': 'vertex_ai',
    'gen_ai.operation.name': operationName,
    'gen_ai.provider.name': 'gcp.vertex_ai',
    'gen_ai.request.model': modelName,
  };
  if (params.conversationId) {
    labels['gen_ai.conversation.id'] = params.conversationId;
  }
  if (params.agentName) {
    labels['gen_ai.agent.name'] = params.agentName;
  }

  const jsonPayload: Record<string, unknown> = {
    'event.name': GEN_AI_DETAILS_LOG,
    'gen_ai.system': 'vertex_ai',
    'gen_ai.operation.name': operationName,
    'gen_ai.provider.name': 'gcp.vertex_ai',
    'gen_ai.request.model': modelName,
    'gen_ai.output.type': 'json',
    // Structured GenAI message arrays (role + parts) — not flat prompt/response strings.
    'gen_ai.input.messages': input,
    'gen_ai.output.messages': output,
    'gen_ai.system_instructions': systemInstructions,
    'gen_ai.tool.definitions': toolDefinitions,
  };

  if (params.conversationId) {
    jsonPayload['gen_ai.conversation.id'] = params.conversationId;
  }
  if (params.agentName) {
    jsonPayload['gen_ai.agent.name'] = params.agentName;
  }
  if (params.agentDescription) {
    jsonPayload['gen_ai.agent.description'] = params.agentDescription;
  }
  if (params.inputTokens != null) {
    jsonPayload['gen_ai.usage.input_tokens'] = params.inputTokens;
  }
  if (params.outputTokens != null) {
    jsonPayload['gen_ai.usage.output_tokens'] = params.outputTokens;
  }

  const resourceContainer = projectNumber || projectId;
  const resource = reasoningEngineId
    ? {
        type: 'aiplatform.googleapis.com/ReasoningEngine',
        labels: {
          resource_container: resourceContainer,
          location,
          reasoning_engine_id: reasoningEngineId,
        },
      }
    : {
        type: 'global',
        labels: {
          project_id: projectId,
        },
      };

  try {
    const token = await getToken();
    const body = {
      logName: `projects/${projectId}/logs/${GEN_AI_DETAILS_LOG}`,
      resource,
      entries: [
        {
          logName: `projects/${projectId}/logs/${GEN_AI_DETAILS_LOG}`,
          resource,
          trace: `projects/${projectId}/traces/${tid}`,
          spanId: sid,
          traceSampled: params.traceSampled ?? true,
          severity: 'INFO',
          labels,
          jsonPayload,
        },
      ],
    };

    const res = await fetch(LOGGING_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(
        '[CLOUD_LOGGING] write failed',
        res.status,
        await res.text().catch(() => '')
      );
    }
  } catch (err) {
    console.error('[CLOUD_LOGGING] error', err);
  }
}
