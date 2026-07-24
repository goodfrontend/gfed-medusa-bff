/**
 * Helpers for OpenTelemetry GenAI semantic convention message shapes.
 * Agent Runtime / Online Monitors expect role + parts (not flat content strings).
 *
 * @see https://github.com/open-telemetry/semantic-conventions-genai
 */

export type GenAiTextPart = { type: 'text'; content: string };

export type GenAiToolCallPart = {
  type: 'tool_call';
  id?: string;
  name: string;
  arguments?: unknown;
};

export type GenAiToolCallResponsePart = {
  type: 'tool_call_response';
  id?: string;
  response: unknown;
};

export type GenAiPart =
  | GenAiTextPart
  | GenAiToolCallPart
  | GenAiToolCallResponsePart
  | { type: string; content?: string; [key: string]: unknown };

export type GenAiMessage = {
  role: string;
  parts: GenAiPart[];
  finish_reason?: string;
};

export function textPart(content: string): GenAiTextPart {
  return { type: 'text', content };
}

export function userTextMessage(content: string): GenAiMessage {
  return { role: 'user', parts: [textPart(content)] };
}

export function assistantTextMessage(
  content: string,
  finishReason?: string
): GenAiMessage {
  const msg: GenAiMessage = {
    role: 'assistant',
    parts: [textPart(content)],
  };
  if (finishReason) msg.finish_reason = finishReason;
  return msg;
}

/** system_instructions is an array of parts (not messages). */
export function systemInstructionParts(instruction: string): GenAiTextPart[] {
  if (!instruction) return [];
  return [textPart(instruction)];
}

/**
 * Serialize GenAI structures for OTEL span attributes / event attributes.
 * Cloud Trace stores attribute values as strings; Agent Runtime JSON-parses them.
 */
export function serializeGenAi(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** Best-effort parse of a JSON string already produced for OTEL. */
export function parseGenAiJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Map a Gemini Content-like object (role + parts with text/functionCall) to
 * GenAI message schema.
 */
export function contentToGenAiMessage(content: {
  role?: string | null;
  parts?: Array<Record<string, unknown>> | null;
}): GenAiMessage {
  const role = content.role || 'user';
  const parts: GenAiPart[] = [];

  for (const p of content.parts || []) {
    if (typeof p.text === 'string') {
      parts.push(textPart(p.text));
    } else if (p.functionCall && typeof p.functionCall === 'object') {
      const fc = p.functionCall as {
        id?: string;
        name?: string;
        args?: unknown;
      };
      parts.push({
        type: 'tool_call',
        ...(fc.id ? { id: fc.id } : {}),
        name: fc.name || 'unknown',
        arguments: fc.args ?? {},
      });
    } else if (p.functionResponse && typeof p.functionResponse === 'object') {
      const fr = p.functionResponse as {
        id?: string;
        name?: string;
        response?: unknown;
      };
      parts.push({
        type: 'tool_call_response',
        ...(fr.id ? { id: fr.id } : {}),
        response: fr.response ?? fr,
      });
    } else {
      parts.push(textPart(JSON.stringify(p)));
    }
  }

  if (parts.length === 0) {
    parts.push(textPart(''));
  }

  return { role, parts };
}

export function contentsToGenAiMessages(
  contents: Array<{
    role?: string | null;
    parts?: Array<Record<string, unknown>> | null;
  }>
): GenAiMessage[] {
  return contents.map(contentToGenAiMessage);
}
