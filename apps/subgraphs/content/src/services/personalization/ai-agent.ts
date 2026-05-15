import { z } from 'zod';

import {
  componentRegistry,
  getComponentsForSurface,
} from '../../config/component-registry';
import { features } from '../../config/features';
import type { UserProfile } from './feature-store';
import { type Intent, classifyIntent } from './intent-classifier';
import { fetchAvailableContent } from './sanity-content';

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

## Available Content (spread these fields into propsOverrides)
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
            'message',
            'incentive',
            'deadline',
            'badges',
            'title',
          ];
          const present = fields
            .filter((f) => c[f] != null)
            .map((f) => `${f}: ${JSON.stringify(c[f]).slice(0, 80)}`)
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
- Pick 1-3 components from Available Components
- EVERY component MUST include ALL fields: component, contentId, priority, propsOverrides, reasoning
- "reasoning" is REQUIRED on every component — write a brief explanation even if obvious
- "contentId" must match a valid ID from Available Content, or null
- "priority" must be an integer 1-10
- Spread Sanity content fields (headline, imageUrl, cta, badge, subheadline, message, incentive, deadline, badges, title) into propsOverrides

Return ONLY valid JSON matching this exact shape (use real values from Available Content):
{"components":[{"component":"HeroBanner","contentId":"abc123","priority":5,"propsOverrides":{"headline":"Up to 50% Off","imageUrl":"https://cdn.sanity.io/...","cta":{"label":"Shop Sale","href":"/collections/sale"},"badge":"Limited Time","theme":"dark"},"reasoning":"Matched user intent and top category"}],"overallReasoning":"Selected hero banner for strong intent match"}

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
  let currentPrompt = prompt;
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callChatCompletion(currentPrompt, systemPrompt);

    try {
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const parsed: unknown = JSON.parse(cleaned);
      const validated = personalizationSchema.parse(parsed);

      return {
        components: validated.components.map((c) => ({
          ...c,
          propsOverrides: (c.propsOverrides ?? {}) as Record<string, unknown>,
        })),
        reasoning: validated.overallReasoning,
        intent: dominantIntent,
        confidence: 0.7,
      };
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        console.warn('[Personalization] AI response invalid, retrying:', err);
        currentPrompt =
          prompt +
          '\n\nCRITICAL: Previous response was rejected. EVERY component MUST include a "reasoning" field with a non-empty string. Do not omit any field.';
      }
    }
  }

  throw lastError;
}
