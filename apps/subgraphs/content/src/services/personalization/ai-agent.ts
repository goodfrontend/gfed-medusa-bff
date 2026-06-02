import { z } from 'zod';

import { getComponentsForSurface } from '../../config/component-registry';
import { features } from '../../config/features';
import type { UserProfile } from './feature-store';
import { classifyIntent } from './intent-classifier';
import { fetchAvailableContent } from './sanity-content';
import { logger } from './logger';

const AI_REQUEST_TIMEOUT_MS = 15_000;
const HERO_BANNER_FIELDS = [
  'headline',
  'subheadline',
  'imageUrl',
  'cta',
  'badge',
  'backgroundColor',
  'title',
] as const;

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
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
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
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
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
    category?: string;
    price?: number;
  },
  availableContent: Array<Record<string, unknown>>,
  intent: string
): string {
  const sortedAffinities = Object.entries(profile.categoryAffinity || {})
    .sort(([, a], [, b]) => b.score - a.score);

  const allSearches = (profile.searchHistory ?? [])
    .map(s => sanitizeForPrompt(s.query))
    .join(' → ');

  const recentProducts = (profile.recentProducts ?? [])
    .slice(-5)
    .map(p => `{product:${sanitizeForPrompt(p.productId)}:${sanitizeForPrompt(p.productName)}, category:${sanitizeForPrompt(p.category)}${p.price ? ', $' + p.price : ''}}`)
    .join(', ');

  const intentDescription: Record<string, string> = {
    buy_now: 'Ready to purchase — high conversion intent and cart activity',
    exploring: 'Browsing and researching — broad category interest, exploring options',
    price_shop: 'Deal-seeking — price-conscious, looking for discounts',
    uncertain: 'At risk — hesitant or low engagement, may need reassurance',
  };

  return `
You are a personalization AI for an e-commerce storefront. Analyze this user's complete profile and select the best 1-4 HeroBanner entries for the ${context.surface} surface.

## Classified Intent
${intent} — ${intentDescription[intent] ?? 'General browsing'}

## User Profile
- lifecycleStage = "${profile.lifecycleStage}"
- engagementLevel = "${profile.engagementLevel}"
- orderCount = ${profile.orderCount ?? 0}
- sessionCount = ${profile.sessionCount ?? 0}
- cartActivity = ${profile.cartActivity ?? 0}
- hesitationCount = ${profile.hesitationCount ?? 0}
- checkoutConversion = ${profile.intentSignals.checkoutConversion ?? 'N/A'}
- researchDepth = ${profile.intentSignals.researchDepth ?? 'N/A'}
- priceSensitivityScore = ${profile.priceSensitivity?.score ?? 0.5}
- avgViewedPrice = $${profile.priceSensitivity?.avgViewedPrice ?? 0}
- dealClickRate = ${profile.priceSensitivity?.dealClickRate ?? 0}

### Category Affinity
${sortedAffinities.length ? sortedAffinities.map(([c, d]) => `  ${c}: score=${d.score.toFixed(2)} (${d.views} views, ${d.purchases} purchases)`).join('\n') : '  (none recorded)'}

### Search History
${allSearches || '(none)'}

### Recently Viewed Products
${recentProducts || '(none)'}

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
          const fields = HERO_BANNER_FIELDS;
          const present = fields
            .filter((f) => c[f] != null)
            .map((f) => `${f}: ${JSON.stringify(c[f])}`)
            .join(', ');
          return `- ID:${sanitizeForPrompt(String(c._id))} fields={${present || 'none'}}`;
        })
        .join('\n')
    : 'None for this surface'
}

## Decision Steps
1. Analyze the user's classified intent and profile — what do they need right now?
2. For each banner, evaluate: does it match the intent, categories, lifecycle stage, and engagement of this user?
3. Rank the best 2-4 banners, with priority 1 being the strongest match.
4. For each choice, write a reasoning that specifically references profile data and banner content.

## Examples

Example 1: User is LOYAL, high engagement, browsing womens category
Good response: {"components":[{"component":"HeroBanner","contentId":"...","priority":1,"propsOverrides":{},"reasoning":"Loyal, high-engagement shopper browsing womens — this banner features new arrivals in that category"}],"overallReasoning":"..."}

Example 2: User is NEW, low engagement, no cart activity
Good response: {"components":[{"component":"HeroBanner","contentId":"...","priority":1,"propsOverrides":{},"reasoning":"New user needs a welcoming value prop to encourage first purchase"}],"overallReasoning":"..."}

Example 3: User is price_shop intent, dealClickRate > 0.4
Good response: {"components":[{"component":"HeroBanner","contentId":"...","priority":1,"propsOverrides":{},"reasoning":"Price-sensitive shopper — this banner has a deal badge and promotes a sale"}],"overallReasoning":"..."}

## Output Format
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
      intent: 'exploring',
      confidence: 0,
    };
  }

  const dominantIntent =
    classifyIntent(profile)[0]?.intent ?? 'exploring';
  const content = await fetchAvailableContent(context.surface);
  const prompt = buildPrompt(
    profile,
    context,
    content,
    dominantIntent
  );

  const systemPrompt = 'You are a personalization AI for an e-commerce storefront. Your job is to select the most relevant hero banners for a given shopper based on their profile, current intent, and available content.\n\nDecision criteria (in priority order):\n1. Intent match — Does the banner match the user\'s current shopping intent?\n2. Category relevance — Does the banner content match the user\'s category interests?\n3. Lifecycle fit — Is the banner appropriate for the user\'s relationship stage (new vs loyal)?\n4. Urgency/relevance — Does the user need reassurance, a deal, or a purchase nudge?\n\nOutput ONLY valid JSON. No markdown fences. No commentary outside the JSON.';

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

        const fieldsToSpread = HERO_BANNER_FIELDS;

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
