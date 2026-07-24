import { BasePlugin } from '@google/adk';
import type { Content } from '@google/genai';
import { trace } from '@opentelemetry/api';

import { writeTraceLogEntry } from './cloud-logging';
import {
  assistantTextMessage,
  contentToGenAiMessage,
  contentsToGenAiMessages,
  serializeGenAi,
} from './genai-messages';
import { setTokenUsage } from './token-usage';

function extractTextFromParts(content: Content | undefined): string {
  if (!content?.parts) return '';
  const texts: string[] = [];
  for (const p of content.parts) {
    const part = p as Record<string, unknown>;
    if (part.text) {
      texts.push(part.text as string);
    } else if (part.functionCall) {
      texts.push(JSON.stringify(part.functionCall));
    } else if (part.functionResponse) {
      texts.push(JSON.stringify(part.functionResponse));
    } else {
      texts.push(JSON.stringify(part));
    }
  }
  return texts.join(' ');
}

function toMessagesJson(contents: Content[] | undefined): string | null {
  if (!contents || contents.length === 0) return null;
  return serializeGenAi(
    contentsToGenAiMessages(
      contents as Array<{
        role?: string | null;
        parts?: Array<Record<string, unknown>> | null;
      }>
    )
  );
}

export class TelemetryFixPlugin extends BasePlugin {
  private pendingInputMessages: string | null = null;
  private pendingModel: string | null = null;

  constructor() {
    super('telemetry-fix');
  }

  async beforeModelCallback(params: {
    callbackContext: unknown;
    llmRequest: {
      contents: Content[];
      model?: string;
    };
  }) {
    this.pendingInputMessages = toMessagesJson(params.llmRequest.contents);
    this.pendingModel = params.llmRequest.model || null;
    return undefined;
  }

  async afterModelCallback(params: {
    callbackContext: unknown;
    llmResponse: {
      content?: Content;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };
  }) {
    const span = trace.getActiveSpan();

    if (!span) {
      console.error('[TELEMETRY_PLUGIN] No active span');
      return undefined;
    }

    span.setAttribute('gen_ai.system', 'vertex_ai');
    span.setAttribute('gen_ai.operation.name', 'generate_content');
    span.setAttribute('gen_ai.provider.name', 'gcp.vertex_ai');

    const input = this.pendingInputMessages;
    const model = this.pendingModel;

    let output: string | null = null;
    if (params.llmResponse.content?.parts?.length) {
      output = serializeGenAi([
        contentToGenAiMessage(
          params.llmResponse.content as {
            role?: string | null;
            parts?: Array<Record<string, unknown>> | null;
          }
        ),
      ]);
    } else {
      const responseText = extractTextFromParts(params.llmResponse.content);
      if (responseText) {
        output = serializeGenAi([assistantTextMessage(responseText)]);
      }
    }

    if (input) span.setAttribute('gen_ai.input.messages', input);
    if (output) span.setAttribute('gen_ai.output.messages', output);
    if (model) span.setAttribute('gen_ai.request.model', model);

    this.pendingInputMessages = null;
    this.pendingModel = null;

    const metadata = params.llmResponse.usageMetadata;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    if (metadata) {
      if (metadata.promptTokenCount != null) {
        inputTokens = metadata.promptTokenCount;
        span.setAttribute('gen_ai.usage.input_tokens', inputTokens);
      }
      if (metadata.candidatesTokenCount != null) {
        outputTokens = metadata.candidatesTokenCount;
        span.setAttribute('gen_ai.usage.output_tokens', outputTokens);
      }
      setTokenUsage(inputTokens ?? 0, outputTokens ?? 0);
    }

    // Inference event required by Agent Runtime Online Monitors / Evaluation.
    span.addEvent('gen_ai.client.inference.operation.details', {
      'gen_ai.operation.name': 'generate_content',
      'gen_ai.provider.name': 'gcp.vertex_ai',
      'gen_ai.system': 'vertex_ai',
      'gen_ai.output.type': 'json',
      ...(model ? { 'gen_ai.request.model': model } : {}),
      ...(input ? { 'gen_ai.input.messages': input } : {}),
      ...(output ? { 'gen_ai.output.messages': output } : {}),
      ...(inputTokens != null
        ? { 'gen_ai.usage.input_tokens': inputTokens }
        : {}),
      ...(outputTokens != null
        ? { 'gen_ai.usage.output_tokens': outputTokens }
        : {}),
    });

    // Write Cloud Logging entry correlated to the call_llm span so Agent
    // Runtime evaluator can find prompt/response logs for this span.
    const sc = span.spanContext();
    writeTraceLogEntry({
      projectId: process.env.PROJECT_ID || '',
      projectNumber: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
      reasoningEngineId:
        process.env.GOOGLE_CLOUD_AGENT_ENGINE_ID ||
        process.env.AGENT_ENGINE_ID ||
        '',
      traceId: sc.traceId,
      spanId: sc.spanId,
      inputMessages: input || '[]',
      outputMessages: output || '[]',
      inputTokens,
      outputTokens,
      model: model || 'gemini-2.5-flash-lite',
      operationName: 'generate_content',
      traceSampled: (sc.traceFlags & 1) === 1,
    }).catch(() => {});

    return undefined;
  }
}
