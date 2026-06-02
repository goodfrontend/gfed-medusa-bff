import { z } from 'zod';

import { getComponentsForSurface } from '../../config/component-registry';
import { features } from '../../config/features';
import type { UserProfile } from './feature-store';
import { classifyIntent } from './intent-classifier';
import { fetchAvailableContent } from './sanity-content';
import { type ProductPreview, fetchCategoryProducts } from '../medusa/category-products';
import { type CategoryOption, getRelevantCategories } from './decision-engine';
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

const HOME_BANNER_FIELDS = [
  'title',
  'eyebrow',
  'description',
  'imageUrl',
  'buttons',
  'secondaryBanners',
  'showPoweredBy',
] as const;

const COMPONENT_CONTENT_FIELDS: Record<string, readonly string[]> = {
  HeroBanner: HERO_BANNER_FIELDS,
  PersonalizedBanner: HOME_BANNER_FIELDS,
};

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
  intent: string,
  availableCategories: CategoryOption[],
  categoryProducts: Record<string, ProductPreview[]>
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

  const contentByType: Record<string, Array<Record<string, unknown>>> = {};
  for (const c of availableContent) {
    const t = String(c._type ?? 'unknown');
    if (!contentByType[t]) contentByType[t] = [];
    contentByType[t].push(c);
  }

  const heroBannerSection = (contentByType['heroBanner'] ?? []).length > 0
    ? contentByType['heroBanner']
        .map((c) => {
          const present = HERO_BANNER_FIELDS
            .filter((f) => c[f] != null)
            .map((f) => `${f}: ${JSON.stringify(c[f])}`)
            .join(', ');
          return `- ID:${sanitizeForPrompt(String(c._id))} type=heroBanner fields={${present || 'none'}}`;
        })
        .join('\n')
    : 'None available';

  const homeBannerSection = (contentByType['homeBanner'] ?? []).length > 0
    ? contentByType['homeBanner']
        .map((c) => {
          const present = HOME_BANNER_FIELDS
            .filter((f) => c[f] != null)
            .map((f) => `${f}: ${JSON.stringify(c[f])}`)
            .join(', ');
          return `- ID:${sanitizeForPrompt(String(c._id))} type=homeBanner fields={${present || 'none'}}`;
        })
        .join('\n')
    : 'None available';

  const categorySection = availableCategories.length > 0
    ? availableCategories.map((cat) => {
        const prods = categoryProducts[cat.handle] ?? [];
        const prodList = prods.map(p => `${p.title} (${p.handle})`).join(', ');
        return `  ${cat.name} (handle=${cat.handle}, score=${cat.score.toFixed(2)}) — products: [${prodList || 'none loaded'}]`;
      }).join('\n')
    : 'No categories available';

  return `
You are a personalization AI for an e-commerce storefront. Analyze this user's complete profile and select the best 1-4 components for the ${context.surface} surface. You may choose from: HeroBanner, FeaturedCategoryRail, PersonalizedBanner.

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
${heroBannerSection}

## Available HomeBanners (PersonalizedBanner)
${homeBannerSection}

## Available Categories (FeaturedCategoryRail)
${categorySection}

## Component Type Guide
- HeroBanner: Full-width hero with headline, image, CTA. Best for primary promotion, buy_now intent, new arrivals.
- FeaturedCategoryRail: Product rail for a specific category. Best for exploring intent, category browsing. Use contentId=null (products come from category, not CMS). Include the category handle in propsOverrides.handle.
- PersonalizedBanner: Segment-aware promotional banner. Best for uncertain intent (reassurance), price_shop (promos), or general engagement. Use contentId from available homeBanners above.

## Decision Steps
1. Analyze the user's classified intent and profile — what do they need right now?
2. Decide which component types to use and how many of each (1-4 total).
3. For HeroBanner and PersonalizedBanner: select contentId from the available lists above based on intent match.
4. For FeaturedCategoryRail: pick 1-2 categories from the available list above, set contentId=null, set propsOverrides.handle to the category handle.
5. Rank all choices by priority, with priority 1 being the strongest match.
6. For each choice, write reasoning that references specific profile data and content.

## Output Format
{"components":[{"component":"HeroBanner","contentId":"abc123","priority":1,"propsOverrides":{},"reasoning":"..."},{"component":"FeaturedCategoryRail","contentId":null,"priority":2,"propsOverrides":{"handle":"mens"},"reasoning":"..."}],"overallReasoning":"..."}

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

  const intentScores = classifyIntent(profile);
  const dominantIntent = intentScores[0]?.intent ?? 'exploring';
  const confidence = intentScores[0]?.score ?? 0;
  const content = await fetchAvailableContent(context.surface);

  const relevantCategories = getRelevantCategories(profile);
  const categoryProducts: Record<string, ProductPreview[]> = {};
  for (const cat of relevantCategories.slice(0, 3)) {
    try {
      categoryProducts[cat.handle] = await fetchCategoryProducts(cat.handle);
    } catch (err) {
      logger.warn({ err, category: cat.handle }, 'AI agent: Medusa fetch failed for category');
    }
  }

  const prompt = buildPrompt(
    profile,
    context,
    content,
    dominantIntent,
    relevantCategories,
    categoryProducts
  );

  const systemPrompt = 'You are a personalization AI for an e-commerce storefront. Your job is to select the most relevant components (HeroBanner, FeaturedCategoryRail, PersonalizedBanner) for a given shopper based on their profile, current intent, and available content.\n\nDecision criteria (in priority order):\n1. Intent match — Does the component type match the user\'s current shopping intent?\n2. Category relevance — For FeaturedCategoryRail: does the category match user interests? For banners: does the content match?\n3. Lifecycle fit — Is the component appropriate for the user\'s relationship stage (new vs loyal)?\n4. Engagement — Does the user need browsing prompts (FeatureCategoryRail), reassurance (PersonalizedBanner), or purchase nudges (HeroBanner)?\n\nOutput ONLY valid JSON. No markdown fences. No commentary outside the JSON.';

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

        const resolved = validated.components.map((c) => {
          const contentEntry = c.contentId ? contentById.get(c.contentId) : undefined;

          if (c.component === 'FeaturedCategoryRail') {
            const handle = (c.propsOverrides?.handle as string) || '';
            const products = categoryProducts[handle] ?? [];
            return {
              ...c,
              propsOverrides: {
                title: relevantCategories.find(cat => cat.handle === handle)?.name ?? '',
                handle,
                products,
                ...(c.propsOverrides ?? {}),
              },
            };
          }

          const fieldsToSpread = COMPONENT_CONTENT_FIELDS[c.component];
          const contentFields: Record<string, unknown> = {};
          if (contentEntry && fieldsToSpread) {
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
          confidence,
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

  let primaryError: unknown;

  // Try primary AI provider first
  try {
    return await attemptProvider(callChatCompletion, 'primary');
  } catch (err) {
    primaryError = err;
    logger.warn({ err }, 'Primary AI provider failed, trying Gemini fallback');
  }

  // Fallback to Gemini
  if (!features.aiGeminiApiKey()) {
    throw primaryError;
  }

  try {
    return await attemptProvider(callGeminiCompletion, 'Gemini');
  } catch (geminiError) {
    throw new AggregateError(
      [primaryError, geminiError],
      'Both AI providers failed: primary then Gemini'
    );
  }
}
