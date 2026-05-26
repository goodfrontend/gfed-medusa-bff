import { z } from 'zod';

import { getComponentsForSurface } from '../../config/component-registry';
import { features } from '../../config/features';
import type { UserProfile } from './feature-store';
import { classifyIntent } from './intent-classifier';
import { fetchAvailableContent } from './sanity-content';
import { logger } from './logger';

const componentChoiceSchema = z.object({
  component: z.string(),
  contentId: z.string().nullable(),
  priority: z.number().int().min(1).max(10),
  propsOverrides: z.record(z.unknown()).optional(),
  reasoning: z.string(),
});

const personalizationSchema = z.object({
  components: z.array(componentChoiceSchema),
  overallReasoning: z.string(),
});

async function callChatCompletion(
  prompt: string,
  system: string
): Promise<string> {
  const providerUrl = features.aiProviderUrl();
  const apiKey = features.aiApiKey();

  const response = await fetch(`${providerUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: features.aiModel(),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      max_tokens: features.aiMaxTokens(),
      temperature: features.aiTemperature(),
      ...(features.aiJsonMode()
        ? { response_format: { type: 'json_object' } }
        : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AI provider error (${response.status}): ${body}`);
  }

  const data: unknown = await response.json();
  const choice = (data as Record<string, unknown>)?.choices as
    | Array<Record<string, unknown>>
    | undefined;
  const content = choice?.[0]?.message as Record<string, unknown> | undefined;
  const text = content?.content as string | undefined;

  if (!text) {
    throw new Error('AI provider returned empty response');
  }

  return text;
}

async function callGeminiCompletion(
  prompt: string,
  system: string
): Promise<string> {
  const apiKey = features.aiGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured (AI_GEMINI_API_KEY)');
  }

  const model = features.aiGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const body: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: system }],
    },
    generationConfig: {
      maxOutputTokens: features.aiMaxTokens(),
      temperature: features.aiTemperature(),
    },
  };

  if (features.aiJsonMode()) {
    (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Gemini API error (${response.status}): ${text}`);
  }

  const data: unknown = await response.json();
  const candidate = (data as Record<string, unknown>)?.candidates as
    | Array<Record<string, unknown>>
    | undefined;
  const text = candidate?.[0]?.content as Record<string, unknown> | undefined;
  const parts = text?.parts as Array<Record<string, unknown>> | undefined;
  const result = parts?.[0]?.text as string | undefined;

  if (!result) {
    throw new Error('Gemini returned empty response');
  }

  return result;
}

function sanitizeForPrompt(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ')
    .slice(0, 200);
}

function buildPrompt(
  profile: UserProfile,
  context: {
    surface: string;
    page: string;
    productId?: string;
    cartValue?: number;
    category?: string;
    price?: number;
  },
  availableContent: Array<Record<string, unknown>>
): string {
  const sortedAffinities = Object.entries(profile.categoryAffinity || {})
    .sort(([, a], [, b]) => b.score - a.score);

  const allSearches = (profile.searchHistory ?? [])
    .map(s => sanitizeForPrompt(s.query))
    .join(' → ');

  const recentProducts = (profile.recentProducts ?? [])
    .slice(-5)
    .map(p => `{product:${sanitizeForPrompt(p.productId)}, category:${sanitizeForPrompt(p.category)}${p.price ? ', $' + p.price : ''}}`)
    .join(', ');

  return `
You are a personalization AI for an e-commerce storefront. Analyze this user's complete profile and select the best 1-4 HeroBanner entries for the ${context.surface} surface.

## User Profile (every field has an explanation of what it reveals)

### Relationship & Identity
- lifecycleStage = "${profile.lifecycleStage}"
  → NEW = first visit, no purchases yet. RETURNING = has purchased before and came back. FREQUENT = shops regularly. LOYAL = highest value, most engaged.
- engagementLevel = "${profile.engagementLevel}"
  → How actively the user browses, adds to cart, and purchases. HIGH = very active, responsive to marketing. LOW = needs stronger motivation.
- orderCount = ${profile.orderCount ?? 0}
  → Number of completed purchases. 0 = never bought. 1+ = has purchase history.
- sessionCount = ${profile.sessionCount ?? 0}
  → Total browsing sessions. Higher = more familiar with the store.

### Shopping Behavior
- cartActivity = ${profile.cartActivity ?? 0}
  → Items actively in cart (incremented on add, decremented on remove, reset to 0 on purchase). >0 means active purchase intent.
- hesitationCount = ${profile.hesitationCount ?? 0}
  → Number of times user started checkout and abandoned. >0 suggests purchase friction or barriers at checkout (price, shipping, trust). Reset to 0 on successful purchase.
- cartToPurchaseRate = ${profile.intentSignals.cartToPurchaseRate ?? 'N/A'}
  → Historical rate of cart → purchase conversion for this user. 0.9 means they complete 90% of carts. Low rate + high hesitation = high friction.
- returnRate = ${profile.intentSignals.returnRate ?? 'N/A'}
  → How often they return purchased products. 0 = never returns (trustworthy). High = may need better product fit info.
- researchDepth = ${profile.intentSignals.researchDepth ?? 'N/A'}
  → How much they browse/research before buying. Higher = needs educational or reassurance content. Lower = more impulsive.

### Category Affinity (sorted by score, higher = stronger interest)
${sortedAffinities.length ? sortedAffinities.map(([c, d]) => `  ${c}: score=${d.score.toFixed(2)} (${d.views} views, ${d.purchases} purchases, ${d.lastViewed ? 'recently viewed' : ''})`).join('\n') : '  (none recorded)'}

### Search History (chronological)
${allSearches || '(no searches in this session)'}
  → Search queries reveal current, real-time intent. Repeated searches for similar terms indicate strong category interest. The most recent searches are the most predictive.

### Recently Viewed Products
${recentProducts || '(none)'}
  → Products browsed recently, with categories and prices. Reveals what categories and price ranges the user is currently considering.

### Price Sensitivity
- score = ${profile.priceSensitivity?.score ?? 0.5} ← (0=not price sensitive, 1=extremely price sensitive)
- avgViewedPrice = $${profile.priceSensitivity?.avgViewedPrice ?? 0} ← (average price of products they browse)
- dealClickRate = ${profile.priceSensitivity?.dealClickRate ?? 0} ← (how often they click on deals/sales. >0.3 = deal-seeker)

## Context
- Surface: ${context.surface}
- Page: ${context.page}
${context.productId ? `- Product: ${sanitizeForPrompt(context.productId)}` : ''}
${context.category ? `- Category: ${sanitizeForPrompt(context.category)}` : ''}
${context.price != null ? `- Product price: $${context.price}` : ''}

## Available HeroBanners
${
  availableContent.length > 0
    ? availableContent
        .map((c) => {
          const fields = [
            'headline',
            'subheadline',
            'imageUrl',
            'cta',
            'badge',
            'backgroundColor',
            'title',
          ];
          const present = fields
            .filter((f) => c[f] != null)
            .map((f) => `${f}: ${JSON.stringify(c[f])}`)
            .join(', ');
          return `- ID:${sanitizeForPrompt(String(c._id))} fields={${present || 'none'}}`;
        })
        .join('\n')
    : 'None for this surface'
}

## Your Task

Read the available HeroBanners and the user's profile above. Think about what this user needs right now based on their lifecycle, search history, behavior signals, and interests. Choose the HeroBanner(s) that best serve them. Be thorough with analyzing the user's profile statistics, in order to enhance the quality of your decision on what components to choose.

- Pick 2-4 banners. Each must have a distinct contentId.
- contentId must match a document _id from Available HeroBanners.
- Priority 1 = best pick, 2 = second best, etc. (integer 1-10).
- propsOverrides is optional.
- Every component needs a reasoning field explaining why you chose it — reference the specific profile data and banner content that drove your choice.

Return valid JSON matching this shape:
{"components":[{"component":"HeroBanner","contentId":"...","priority":1,"propsOverrides":{},"reasoning":"..."}],"overallReasoning":"..."}

Your JSON:
`.trim();
}

export async function aiPersonalize(
  profile: UserProfile,
  context: {
    surface: string;
    page: string;
    productId?: string;
    cartValue?: number;
    category?: string;
    price?: number;
  }
): Promise<{
  components: Array<{
    component: string;
    contentId: string | null;
    priority: number;
    propsOverrides: Record<string, unknown>;
    reasoning: string;
  }>;
  reasoning: string;
  intent: string;
  confidence: number;
}> {
  const availableComponents = getComponentsForSurface(context.surface);
  if (availableComponents.length === 0) {
    return {
      components: [],
      reasoning: 'No components',
      intent: 'browse',
      confidence: 0,
    };
  }

  const dominantIntent =
    classifyIntent(profile)[0]?.intent ?? ('browse' as const);
  const content = await fetchAvailableContent(context.surface);
  const prompt = buildPrompt(
    profile,
    context,
    content
  );

  const systemPrompt = 'Output ONLY valid JSON. No markdown fences.';

  async function attemptProvider(
    providerCall: (prompt: string, system: string) => Promise<string>,
    providerName: string
  ): Promise<{
    components: Array<{
      component: string;
      contentId: string | null;
      priority: number;
      propsOverrides: Record<string, unknown>;
      reasoning: string;
    }>;
    reasoning: string;
    intent: string;
    confidence: number;
  }> {
    let currentPrompt = prompt;
    let lastParseError: unknown;

    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await providerCall(currentPrompt, systemPrompt);

      try {
        const cleaned = raw
          .replace(/^```json\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();
        const parsed: unknown = JSON.parse(cleaned);
        const validated = personalizationSchema.parse(parsed);

        const contentById = new Map(
          content.map((c) => [String(c._id), c])
        );

        const fieldsToSpread = [
          'headline',
          'subheadline',
          'imageUrl',
          'cta',
          'badge',
          'backgroundColor',
          'title',
        ];

        const resolved = validated.components.map((c) => {
          const contentEntry = c.contentId ? contentById.get(c.contentId) : undefined;
          const contentFields: Record<string, unknown> = {};
          if (contentEntry) {
            for (const f of fieldsToSpread) {
              if (contentEntry[f] != null) {
                contentFields[f] = contentEntry[f];
              }
            }
          }
          return {
            ...c,
            propsOverrides: { ...contentFields, ...(c.propsOverrides ?? {}) },
          };
        });

        return {
          components: resolved.map((c) => ({
            ...c,
            propsOverrides: c.propsOverrides as Record<string, unknown>,
          })),
          reasoning: validated.overallReasoning,
          intent: dominantIntent,
          confidence: 0.7,
        };
      } catch (err) {
        lastParseError = err;
        if (attempt === 0) {
          logger.warn({ err, provider: providerName }, `AI response invalid, retrying`);
          currentPrompt =
            prompt +
            '\n\nCRITICAL: Previous response was rejected. EVERY component MUST include a "reasoning" field with a non-empty string. Do not omit any field.';
        }
      }
    }
    throw lastParseError;
  }

  let groqError: unknown;

  // Try Groq first
  try {
    return await attemptProvider(callChatCompletion, 'Groq');
  } catch (err) {
    groqError = err;
    logger.warn({ err }, 'AI provider (Groq) failed, trying Gemini');
  }

  // Fallback to Gemini
  if (!features.aiGeminiApiKey()) {
    throw groqError;
  }

  try {
    return await attemptProvider(callGeminiCompletion, 'Gemini');
  } catch (geminiError) {
    throw new AggregateError(
      [groqError, geminiError],
      'Both AI providers failed: Groq then Gemini'
    );
  }
}
