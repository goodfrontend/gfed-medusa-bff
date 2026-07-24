import { adkConfig } from '../../config/adk-config';
import { logger } from './logger';

export type AdkAgentResponse = {
  components: Array<{
    component: string;
    contentId: string | null;
    priority: number;
    propsOverrides: Record<string, unknown>;
    reasoning: string;
    score: number;
  }>;
  reasoning: {
    intent: string;
    confidence: number;
    factors: string[];
    modelVersion: string;
  };
  cacheKey: string;
};

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  const { GoogleAuth } = await import('google-auth-library');

  const serviceAccountKeyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  const authOptions: { scopes: string[]; credentials?: object } = {
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  };

  if (serviceAccountKeyB64) {
    const keyJson = Buffer.from(serviceAccountKeyB64, 'base64').toString(
      'utf-8'
    );
    const credentials = JSON.parse(keyJson);
    if (
      !credentials.client_email ||
      !credentials.private_key ||
      !credentials.project_id
    ) {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_KEY_BASE64: decoded JSON missing one or more required fields (client_email, private_key, project_id)'
      );
    }
    authOptions.credentials = credentials;
  }

  const auth = new GoogleAuth(authOptions);
  const client = await auth.getClient();
  const tokenResp = await client.getAccessToken();
  cachedToken = tokenResp.token ?? '';
  tokenExpiry = Date.now() + 55 * 60 * 1000;
  return cachedToken;
}

/**
 * Shared contentId validation used by both local and deployed agent paths.
 *
 * - When no availableContent is provided, nullifies all banner contentIds.
 * - When availableContent is provided, nullifies banner contentIds that
 *   don't exist in the available content set.
 */
export function validateContentIds(
  components: AdkAgentResponse['components'],
  availableContent: Array<Record<string, unknown>>
): void {
  const isBanner = (c: AdkAgentResponse['components'][number]) =>
    c.component === 'HeroBanner' || c.component === 'PersonalizedBanner';

  if (!availableContent || availableContent.length === 0) {
    for (const c of components) {
      if (isBanner(c) && c.contentId !== null && c.contentId !== undefined) {
        logger.warn(
          { component: c.component, contentId: c.contentId },
          'Agent returned contentId but no availableContent was provided; nullifying'
        );
        c.contentId = null;
      }
    }
    return;
  }

  const contentIds = new Set(
    availableContent.map((c) => c._id as string).filter(Boolean)
  );
  for (const c of components) {
    if (
      isBanner(c) &&
      c.contentId !== null &&
      c.contentId !== undefined &&
      !contentIds.has(c.contentId)
    ) {
      logger.warn(
        { component: c.component, contentId: c.contentId },
        'Agent returned contentId not in available content; nullifying'
      );
      c.contentId = null;
    }
  }
}

/**
 * Detect whether an error is a fetch timeout (AbortError from AbortSignal.timeout
 * or TimeoutError from some SDKs).
 * Handles DOMException (modern Node/undici), plain Error, and code-based matching.
 */
function isFetchTimeout(err: unknown): boolean {
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
  return false;
}

async function callLocalAgent(
  deviceId: string,
  profile: Record<string, unknown>,
  context: {
    surface: string;
    page: string;
    productId?: string;
    category?: string;
    price?: number;
  },
  availableContent: Array<Record<string, unknown>>,
  availableProducts: Array<Record<string, unknown>>
): Promise<AdkAgentResponse> {
  const url = adkConfig.agentEndpoint();
  const timeout = adkConfig.timeoutMs();

  logger.info(
    { deviceId, surface: context.surface },
    'Calling local ADK agent'
  );

  async function doFetch(signal: AbortSignal): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId,
        surface: context.surface,
        page: context.page,
        productId: context.productId,
        category: context.category,
        price: context.price,
        userProfile: profile,
        availableContent,
        availableProducts,
      }),
      signal,
    });
  }

  let response: Response;
  try {
    response = await doFetch(AbortSignal.timeout(timeout));
  } catch (err) {
    // If the first request times out (cold-start), retry once with longer timeout
    if (isFetchTimeout(err)) {
      logger.warn(
        { deviceId, timeout },
        'Local ADK agent timed out on first attempt (cold-start?), retrying with longer timeout'
      );
      try {
        response = await doFetch(AbortSignal.timeout(30_000));
      } catch (retryErr) {
        if (isFetchTimeout(retryErr)) {
          throw new Error(
            `Local ADK agent timed out again after retry with 30s timeout`
          );
        }
        throw retryErr;
      }
    } else {
      throw err;
    }
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Local ADK agent error (${response.status}): ${text}`);
  }

  let output: AdkAgentResponse;
  try {
    output = (await response.json()) as AdkAgentResponse;
  } catch {
    throw new Error('Local agent returned invalid JSON');
  }

  // Generate cacheKey if the agent didn't provide one
  if (!output.cacheKey) {
    output.cacheKey = `adk:${deviceId}:${context.surface}`;
  }

  if (!output.components || !output.reasoning || !output.cacheKey) {
    logger.warn({ output }, 'Local ADK agent returned unexpected format');
    throw new Error('Local ADK agent returned unexpected response format');
  }

  // Validate contentIds against available content
  validateContentIds(output.components, availableContent);

  return output;
}

export async function callAdkAgent(
  deviceId: string,
  profile: Record<string, unknown>,
  context: {
    surface: string;
    page: string;
    productId?: string;
    category?: string;
    price?: number;
  },
  availableContent: Array<Record<string, unknown>>,
  availableProducts: Array<Record<string, unknown>>
): Promise<AdkAgentResponse> {
  const mode = adkConfig.agentMode();
  if (mode !== 'local' && mode !== 'deployed') {
    throw new Error(
      `Invalid ADK_AGENT_MODE: ${mode}. Must be "local" or "deployed".`
    );
  }
  if (mode === 'local') {
    return callLocalAgent(
      deviceId,
      profile,
      context,
      availableContent,
      availableProducts
    );
  }

  const ENGINE_NAME = adkConfig.getEngineName();
  if (!ENGINE_NAME) {
    throw new Error('ADK_ENGINE_ID and ADK_GCP_PROJECT_NUMBER must be set');
  }
  const location = adkConfig.getLocation();
  const BASE_URL = `https://${location}-aiplatform.googleapis.com/v1/${ENGINE_NAME}`;
  const QUERY_URL = `${BASE_URL}:query`;

  const token = await getAccessToken();
  const timeout = adkConfig.timeoutMs();

  const queryInput: Record<string, unknown> = {
    appName: 'agent',
    userId: deviceId,
    newMessage: {
      role: 'user' as const,
      parts: [
        {
          text: JSON.stringify({
            deviceId,
            surface: context.surface,
            page: context.page,
            productId: context.productId,
            category: context.category,
            price: context.price,
            profile: profile,
            availableContent,
            availableProducts,
          }),
        },
      ],
    },
  };

  logger.info({ deviceId, surface: context.surface }, 'Calling Agent Engine');

  // Submit async query job
  const response = await fetch(QUERY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: queryInput }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Agent Engine error (${response.status}): ${text}`);
  }

  let result: Record<string, unknown>;
  try {
    result = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error('Agent Engine returned invalid JSON');
  }

  let agentText = '';

  // Path 1: Direct personalization_decision in output
  // (Vertex :query synchronous response wraps agent output as { output: { personalization_decision: ... } })
  const directOutput = result.output as Record<string, unknown> | undefined;
  if (directOutput?.personalization_decision) {
    const decision = directOutput.personalization_decision;
    agentText =
      typeof decision === 'string' ? decision : JSON.stringify(decision);
  }

  // Path 2: Agent Engine returns an array of events in `output`
  if (!agentText) {
    const events = (result.output ?? result) as Array<Record<string, unknown>>;

    if (Array.isArray(events)) {
      // Find the last event with a text part in the model response
      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        const content = event?.content as Record<string, unknown> | undefined;
        const parts = content?.parts as
          | Array<Record<string, unknown>>
          | undefined;
        if (parts) {
          for (const part of parts) {
            if (typeof part.text === 'string' && part.text.trim()) {
              agentText = part.text;
              break;
            }
          }
          if (agentText) break;
        }
      }
    }

    // Fallback: extract from structured output (stateDelta)
    if (!agentText && Array.isArray(events)) {
      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        const actions = event?.actions as Record<string, unknown> | undefined;
        const stateDelta = actions?.stateDelta as
          | Record<string, unknown>
          | undefined;
        if (stateDelta) {
          const decision = stateDelta.personalization_decision;
          if (decision !== undefined && decision !== null) {
            agentText =
              typeof decision === 'string'
                ? decision
                : JSON.stringify(decision);
            break;
          }
        }
      }
    }
  }

  if (!agentText) {
    logger.warn({ result }, 'Agent Engine returned no text response');
    throw new Error('Agent Engine returned no text response');
  }

  // Clean markdown fences
  const cleaned = agentText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  let output: AdkAgentResponse;
  try {
    output = JSON.parse(cleaned) as AdkAgentResponse;
  } catch {
    logger.warn(
      { cleaned: cleaned.slice(0, 200) },
      'Agent Engine returned invalid JSON'
    );
    throw new Error('Agent Engine returned invalid JSON');
  }

  // Generate cacheKey if the agent didn't provide one
  if (!output.cacheKey) {
    output.cacheKey = `adk:${deviceId}:${context.surface}`;
  }

  if (!output.components || !output.reasoning || !output.cacheKey) {
    logger.warn({ output }, 'Agent Engine returned unexpected format');
    throw new Error('Agent Engine returned unexpected response format');
  }

  // Validate contentIds against available content
  validateContentIds(output.components, availableContent);

  logger.info(
    {
      componentCount: output.components.length,
      intent: output.reasoning.intent,
    },
    'Agent Engine response received'
  );

  return output;
}
