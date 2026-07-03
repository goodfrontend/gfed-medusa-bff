import { z } from 'zod';

import { getComponentsForSurface } from '../../config/component-registry';
import { features } from '../../config/features';
import type { UserProfile } from './feature-store';
import { PartialJsonParser } from './partial-json-parser';
import { classifyIntent } from './intent-classifier';
import { fetchAvailableContent } from './sanity-content';
import { type CategoryOption, type ProductPreview, fetchCategoryProducts } from '../medusa/category-products';
import { getRelevantCategories } from './decision-engine';
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

const SYSTEM_PROMPT = 'You are a personalization AI for an e-commerce storefront. Your job is to select the most relevant components (HeroBanner, FeaturedCategoryRail, PersonalizedBanner, ProductRecommendation) for a given shopper based on their profile, current intent, and available content.\n\nDecision criteria (in priority order):\n1. Intent match — Does the component type match the user\'s current shopping intent?\n2. Category relevance — For FeaturedCategoryRail: does the category match user interests? For banners: does the content match?\n3. Lifecycle fit — Is the component appropriate for the user\'s relationship stage (new vs loyal)?\n4. Engagement — Does the user need browsing prompts (FeatureCategoryRail), reassurance (PersonalizedBanner), or purchase nudges (HeroBanner)?\n\nOutput ONLY valid JSON. No markdown fences. No commentary outside the JSON.';

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

async function* callChatCompletionStream(
  prompt: string,
  system: string
): AsyncGenerator<string> {
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
      stream: true,
    }),
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS * 2),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AI provider streaming error (${response.status}): ${body}`);
  }

  if (!response.body) {
    throw new Error('AI provider streaming response has no body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let leftover = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = (leftover + text).split('\n');
      leftover = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed?.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Incomplete JSON line, skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
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

async function* callGeminiStream(
  prompt: string,
  system: string
): AsyncGenerator<string> {
  const apiKey = features.aiGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured (AI_GEMINI_API_KEY)');
  }

  const model = features.aiGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`;

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
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS * 2),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Gemini streaming API error (${response.status}): ${text}`);
  }

  if (!response.body) {
    throw new Error('Gemini streaming response has no body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let leftover = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = (leftover + text).split('\n');
      leftover = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const candidateText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidateText) {
              yield candidateText;
            }
          } catch {
            // Incomplete JSON line, skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
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

  const heroBanners = contentByType['heroBanner'] ?? [];
  const heroBannerSection = heroBanners.length > 0
    ? heroBanners
        .map((c) => {
          const present = HERO_BANNER_FIELDS
            .filter((f) => c[f] != null)
            .map((f) => `${f}: ${JSON.stringify(c[f])}`)
            .join(', ');
          return `- ID:${sanitizeForPrompt(String(c._id))} type=heroBanner fields={${present || 'none'}}`;
        })
        .join('\n')
    : 'None available';

  const homeBanners = contentByType['homeBanner'] ?? [];
  const homeBannerSection = homeBanners.length > 0
    ? homeBanners
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
        const prodList = prods.map(p => {
          const price = p.price != null ? `$${p.price}` : 'N/A';
          const thumb = p.thumbnail ? p.thumbnail : 'no-image';
          return `${p.title} (${p.handle}, ${price}, thumbnail: ${thumb})`;
        }).join(', ');
        return `  ${cat.name} (handle=${cat.handle}, score=${cat.score.toFixed(2)}) — products: [${prodList || 'none loaded'}]`;
      }).join('\n')
    : 'No categories available';

  return `
You are a personalization AI for an e-commerce storefront. Analyze this user's complete profile and select as many relevant components as possible (3-8) for the ${context.surface} surface. Fill the page with variety — use all available component types. You may choose from: HeroBanner, FeaturedCategoryRail, PersonalizedBanner, ProductRecommendation.

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

### Conversion History
${profile.recentDecisions && profile.recentDecisions.length > 0
  ? profile.recentDecisions
      .filter(d => d.conversionAttributed)
      .slice(0, 5)
      .map(d =>
        `- Served: [${d.components.join(', ')}] on ${d.surface} (intent: ${d.intent}), converted: order ${d.conversionAttributed!.orderId} for $${d.conversionAttributed!.amount}`
      )
      .join('\n')
  : '(none)'}

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

## Available Products for Recommendations
${categorySection}

ProductRecommendation is a single product card. Select 1-3 products from the listings above. Use the product data directly.

## Component Type Guide
- HeroBanner: Full-width hero with headline, image, CTA. Best for primary promotion, buy_now intent, new arrivals.
- FeaturedCategoryRail: Product rail for a specific category. Best for exploring intent, category browsing. Use contentId=null (products come from category, not CMS). Include the category handle in propsOverrides.handle.
- PersonalizedBanner: Segment-aware promotional banner. Best for uncertain intent (reassurance), price_shop (promos), or general engagement. Use contentId from available homeBanners above.
- ProductRecommendation: Single product recommendation card. Best for buy_now or exploring intent. Use contentId=null. Set propsOverrides.id to the product's id from the Available Products section. The backend will resolve all product data (title, handle, thumbnail, price, currencyCode) from Medusa. Pick products from categories the user has high affinity for.

## Decision Steps
1. Analyze the user's classified intent and profile — what do they need right now?
2. Decide which component types to use and how many of each (aim for 3-8 total). Use all available component types unless they are clearly irrelevant.
3. For HeroBanner and PersonalizedBanner: select contentId from the available lists above based on intent match.
4. For FeaturedCategoryRail: pick 1-2 categories from the available list above, set contentId=null, set propsOverrides.handle to the category handle.
5. Rank all choices by priority, with priority 1 being the strongest match.
6. REVIEW CONVERSION HISTORY: The user has converted on certain components before. Consider repeating successful patterns where relevant.
7. For ProductRecommendation: pick products from the user's top-affinity categories. Select products listed in the Available Products section.
8. For each choice, write reasoning that references specific profile data and content.

## Output Format
{"components":[{"component":"HeroBanner","contentId":"abc123","priority":1,"propsOverrides":{},"reasoning":"..."},{"component":"PersonalizedBanner","contentId":"xyz789","priority":2,"propsOverrides":{},"reasoning":"..."},{"component":"FeaturedCategoryRail","contentId":null,"priority":3,"propsOverrides":{"handle":"mens"},"reasoning":"..."},{"component":"FeaturedCategoryRail","contentId":null,"priority":4,"propsOverrides":{"handle":"womens"},"reasoning":"..."},{"component":"ProductRecommendation","contentId":null,"priority":5,"propsOverrides":{"id":"prod_01ABCDEF"},"reasoning":"..."}],"overallReasoning":"..."}

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
  const productById: Map<string, ProductPreview> = new Map();
  for (const cat of relevantCategories.slice(0, 3)) {
    try {
      const products = await fetchCategoryProducts(cat.handle);
      categoryProducts[cat.handle] = products;
      for (const p of products) {
        productById.set(p.id, p);
      }
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

  const systemPrompt = SYSTEM_PROMPT;

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

        // Dedup: remove duplicate component+contentId pairs the AI may have returned
        const seen = new Set<string>();
        const deduped = validated.components.filter((c) => {
          const key = c.contentId !== null
            ? `${c.component}:${c.contentId}`
            : c.component === 'FeaturedCategoryRail'
              ? `FeaturedCategoryRail:${(c.propsOverrides?.handle as string) ?? 'null'}`
              : `${c.component}:null`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const contentById = new Map(
          content.map((c) => [String(c._id), c])
        );

        const resolved = deduped.map((c) => {
          const contentEntry = c.contentId ? contentById.get(c.contentId) : undefined;

          if (c.component === 'ProductRecommendation') {
            const productId = (c.propsOverrides?.id as string) ?? '';
            const resolved = productId ? productById.get(productId) : undefined;
            return {
              ...c,
              propsOverrides: {
                id: resolved?.id ?? productId,
                title: resolved?.title ?? '',
                handle: resolved?.handle ?? '',
                thumbnail: resolved?.thumbnail ?? '',
                price: resolved?.price ?? 0,
                currencyCode: resolved?.currencyCode ?? 'USD',
              },
            };
          }

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

export async function* aiPersonalizeStream(
  profile: UserProfile,
  context: {
    surface: string;
    page: string;
    productId?: string;
    category?: string;
    price?: number;
  }
): AsyncGenerator<{ type: 'component'; data: unknown } | { type: 'result'; data: string }, void, unknown> {
  const intentScores = classifyIntent(profile);
  const dominantIntent = intentScores[0]?.intent ?? 'exploring';
  const content = await fetchAvailableContent(context.surface);

  const relevantCategories = getRelevantCategories(profile);
  const categoryProducts: Record<string, ProductPreview[]> = {};
  const productById: Map<string, ProductPreview> = new Map();
  for (const cat of relevantCategories.slice(0, 3)) {
    try {
      const products = await fetchCategoryProducts(cat.handle);
      categoryProducts[cat.handle] = products;
      for (const p of products) {
        productById.set(p.id, p);
      }
    } catch (err) {
      logger.warn({ err, category: cat.handle }, 'AI agent stream: Medusa fetch failed');
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

  const systemPrompt = SYSTEM_PROMPT;

  const parser = new PartialJsonParser();
  let hasYieldedComponents = false;

  async function* attemptStreamingProvider(
    streamFn: (prompt: string, system: string) => AsyncGenerator<string>,
  ): AsyncGenerator<{ type: 'component'; data: unknown } | { type: 'result'; data: string }, void, unknown> {
    let accumulatedText = '';

    for await (const chunk of streamFn(prompt, systemPrompt)) {
      accumulatedText += chunk;
      const objects = parser.feed(chunk);

      for (const obj of objects) {
        hasYieldedComponents = true;
        if ((obj as Record<string, unknown>)?.component === 'ProductRecommendation') {
          const productId = ((obj as Record<string, unknown>)?.propsOverrides as Record<string, unknown> | undefined)?.id as string ?? '';
          const resolved = productId ? productById.get(productId) : undefined;
          if (resolved) {
            (obj as Record<string, unknown>).propsOverrides = {
              id: resolved.id,
              title: resolved.title,
              handle: resolved.handle,
              thumbnail: resolved.thumbnail,
              price: resolved.price,
              currencyCode: resolved.currencyCode,
            };
          }
        }
        yield { type: 'component', data: obj };
      }
    }

    if (!hasYieldedComponents) {
      try {
        const cleaned = accumulatedText
          .replace(/^```json\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();
        const parsed = JSON.parse(cleaned);
        yield { type: 'result', data: JSON.stringify(parsed) };
      } catch {
        throw new Error('Failed to parse complete streaming response');
      }
    } else {
      yield { type: 'result', data: accumulatedText };
    }
  }

  let primaryError: unknown;

  try {
    yield* attemptStreamingProvider(callChatCompletionStream);
    return;
  } catch (err) {
    primaryError = err;
    logger.warn({ err }, 'Primary streaming provider failed, trying Gemini');
  }

  if (!features.aiGeminiApiKey()) {
    throw primaryError;
  }

  try {
    yield* attemptStreamingProvider(callGeminiStream);
  } catch (geminiError) {
    throw new AggregateError(
      [primaryError, geminiError],
      'Both streaming providers failed'
    );
  }
}
