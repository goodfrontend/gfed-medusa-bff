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

  return `
You are a personalization AI for an e-commerce storefront. Choose UI components + Sanity content for a user.

## User Profile
- Dominant intent (rules): ${dominantIntent}
- Engagement: ${profile.engagementLevel}
- Lifecycle: ${profile.lifecycleStage}
- Top categories: ${topCategories || 'none'}
- Price sensitivity score: ${profile.priceSensitivity?.score ?? 0.5}

## Context
- Surface: ${context.surface}
- Page: ${context.page}
- Cart value: $${context.cartValue ?? 0}
${context.productId ? `- Product: ${context.productId}` : ''}
${context.category ? `- Category: ${context.category}` : ''}
${context.price != null ? `- Product price: $${context.price}` : ''}

## Available Components
${availableComponents.map((c) => `- ${c.name}: ${c.description}`).join('\n')}

## Available Content
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
          return `- ID:${String(c._id)} Type:${String(c._type)} fields={${present || 'none'}}`;
        })
        .join('\n')
    : 'None for this surface'
}

## Recent Searches
${(profile.searchHistory ?? []).slice(-3).map(s => `- "${s.query}"`).join('\n') || 'None in this session'}

## Recently Viewed Products
${(profile.recentProducts ?? []).slice(-5).map(p => `- ${p.productId} (${p.category}${p.price ? ', $' + p.price : ''})`).join('\n') || 'None'}

## Rules (MUST follow exactly)
- Pick 1-4 components from Available Components. It can have duplicate components as long as their content are different (e.g. multiple hero banners)
- EVERY component MUST include ALL fields: component, contentId, priority, propsOverrides, reasoning
- "reasoning" is REQUIRED on every component — write a brief explanation even if obvious
- "contentId" must match a valid ID from Available Content, or null
- "priority" must be an integer 1-10
- "propsOverrides" is for dynamic overrides only (e.g., theme, layout, variant). Content fields (headline, imageUrl, cta, etc.) will be auto-populated from the matched contentId.

Return ONLY valid JSON matching this exact shape (use contentId from Available Content):
{"components":[{"component":"HeroBanner","contentId":"abc123","priority":5,"propsOverrides":{"theme":"dark"},"reasoning":"Matched user intent and top category"}],"overallReasoning":"Selected hero banner for strong intent match"}

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
