import { z } from 'zod';

import {
  componentRegistry,
  getComponentsForSurface,
} from '../../config/component-registry';
import { features } from '../../config/features';
import type { UserProfile } from './feature-store';
import { type Intent, classifyIntent } from './intent-classifier';
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
  dominantIntent: Intent,
  context: {
    surface: string;
    page: string;
    productId?: string;
    cartValue?: number;
    category?: string;
    price?: number;
  },
  availableComponents: typeof componentRegistry,
  availableContent: Array<Record<string, unknown>>
): string {
  const topCategories = Object.entries(profile.categoryAffinity || {})
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 3)
    .map(([c]) => c)
    .join(', ');

  const topCategory = Object.entries(profile.categoryAffinity || {})
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 1)
    .map(([c]) => c)[0];

  const recentSearches = (profile.searchHistory ?? [])
    .slice(-3)
    .map(s => `- "${sanitizeForPrompt(s.query)}"`)
    .join('\n');

  const recentProducts = (profile.recentProducts ?? [])
    .slice(-5)
    .map(p => `- ${sanitizeForPrompt(p.productId)} (${sanitizeForPrompt(p.category)}${p.price ? ', $' + p.price : ''})`)
    .join('\n');

  const hesitationCount = profile.hesitationCount ?? 0;

  const signalsSummary = [];
  if (topCategory) signalsSummary.push(`Strong affinity for "${topCategory}"`);
  if (hesitationCount > 0) signalsSummary.push(`Hesitation signals: ${hesitationCount}`);
  if (profile.cartActivity && profile.cartActivity > 0) signalsSummary.push(`Cart activity: ${profile.cartActivity} items`);
  if (profile.priceSensitivity.dealClickRate > 0.3) signalsSummary.push(`Deal-seeking behavior`);
  if (profile.intentSignals.researchDepth > 2) signalsSummary.push(`Deep research mode`);

  return `
You are a personalization AI for an e-commerce storefront. Your ONLY job is to pick the best HeroBanner content for a user on the homepage_hero surface. There is exactly one component type: HeroBanner. Choose from the available Sanity heroBanner documents below.

## User Profile
- Dominant intent: ${dominantIntent}
- Engagement: ${profile.engagementLevel}
- Lifecycle: ${profile.lifecycleStage}
- Top categories: ${topCategories || 'none'}
- Price sensitivity: ${profile.priceSensitivity?.score ?? 0.5}
- Cart value: $${context.cartValue ?? 0}
${signalsSummary.length ? `- Key signals: ${signalsSummary.join('; ')}` : ''}

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

## Recent Searches
${recentSearches || 'None in this session'}

## Recently Viewed Products
${recentProducts || 'None'}

## Banner Selection Guidance (read the available content's headline/badge/title to match)

Match the user to the best banner using these criteria, in priority order:

1. CATEGORY MATCH — If user has strong affinity for a category (e.g. "rings"), prefer a banner whose headline or badge references that category. This is the strongest signal.

2. LIFECYCLE MATCH — NEW users → welcome/onboarding banners with first-order incentives. RETURNING/FREQUENT → banners that acknowledge returning (e.g. "Welcome back", "Continue shopping"). LOYAL → VIP/exclusive/premium banners.

3. INTENT MATCH — price_shop or high price sensitivity → deal/sale/discount banners. hesitant or hesitationCount > 0 → trust/reassurance/guarantee banners. buy_now → urgency/availability/shipping banners (e.g. "In stock", "Order today"). research → guide/educational banners. bounce → strong hook/value-prop banners.

4. CART MATCH — If cartActivity > 0, prefer a banner that references completing the purchase or items in cart.

5. ENGAGEMENT MATCH — HIGH engagement and loyal → new arrivals, trending, exclusive. LOW engagement → strong general value prop, free shipping.

## Rules (MUST follow exactly)
- Pick 1-3 HeroBanners from Available HeroBanners. You can pick multiple IF their content is meaningfully different (e.g. different categories or intents they target). Do NOT pick duplicates of the same content.
- component MUST always be "HeroBanner"
- contentId must match a valid ID from Available HeroBanners, or null if none exist
- priority must be an integer 1-10 (1 = most important)
- propsOverrides is optional — use it ONLY for dynamic overrides like theme or layout variant. Do NOT override content fields — they auto-populate from contentId.
- reasoning is REQUIRED on every component. Explain which signal drove the pick (e.g. "Category match: top affinity for rings" or "Intent match: price_shop intent → deal banner").

Return ONLY valid JSON following this exact shape (contentId from Available HeroBanners):
{"components":[{"component":"HeroBanner","contentId":"abc123","priority":1,"propsOverrides":{},"reasoning":"Category match: user has strong rings affinity"}],"overallReasoning":"Picked ring-focused hero banner matching user's top category"}

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
    dominantIntent,
    context,
    availableComponents,
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
