import 'dotenv/config';
import { z } from 'zod';

const PersonalizationDecisionSchema = z.object({
  components: z.array(
    z.object({
      component: z.enum([
        'HeroBanner',
        'FeaturedCategoryRail',
        'PersonalizedBanner',
      ]),
      contentId: z.string().nullable(),
      propsOverrides: z.record(z.string(), z.unknown()),
      priority: z.number(),
      score: z.number(),
      reasoning: z.string(),
    })
  ),
  reasoning: z.object({
    intent: z.enum(['buy_now', 'exploring', 'price_shop', 'uncertain']),
    confidence: z.number(),
    factors: z.array(z.string()),
    modelVersion: z.literal('adk-v1'),
  }),
});

// Short, focused prompt with few-shot examples
// Deterministic logic (intent inference, content validation, minimums) handled in services
const SYSTEM_INSTRUCTION = `You are a personalization AI for an e-commerce storefront. Select and rank homepage components based on user profiles and available content.

## Component Types

- **HeroBanner**: Full-width banner with headline, image, CTA. Requires contentId from availableContent where _type is "heroBanner".
- **FeaturedCategoryRail**: Product rail for a category. contentId MUST be null. propsOverrides must include "handle" (e.g., "mens", "womens").
- **PersonalizedBanner**: Segment-aware promotional banner. Requires contentId from availableContent where _type is "homeBanner".

## Few-Shot Examples

### Example 1: Price-conscious returning visitor
Input: lifecycleStage=RETURNING, priceSensitivity.score=0.8, categoryAffinity=[{category:"sale",score:0.9}]
Output: {
  "components": [
    {"component":"PersonalizedBanner","contentId":"banner-sale","priority":1,"score":0.9,"reasoning":"High price sensitivity, show deals"},
    {"component":"FeaturedCategoryRail","contentId":null,"propsOverrides":{"handle":"sale"},"priority":2,"score":0.8,"reasoning":"Top category affinity is sale"}
  ],
  "reasoning":{"intent":"price_shop","confidence":0.9,"factors":["price_sensitivity_high"],"modelVersion":"adk-v1"}
}

### Example 2: Loyal user ready to buy
Input: lifecycleStage=LOYAL, checkoutConversion=0.7, cartActivity=2, momentumScore=0.9
Output: {
  "components": [
    {"component":"HeroBanner","contentId":"hero-new-arrivals","priority":1,"score":0.95,"reasoning":"Loyal user with cart activity, show premium content"},
    {"component":"FeaturedCategoryRail","contentId":null,"propsOverrides":{"handle":"trending"},"priority":2,"score":0.85,"reasoning":"High momentum, show trending items"}
  ],
  "reasoning":{"intent":"buy_now","confidence":0.9,"factors":["loyal_with_cart"],"modelVersion":"adk-v1"}
}

### Example 3: New user exploring
Input: lifecycleStage=NEW, sessionCount=1, engagementLevel=LOW
Output: {
  "components": [
    {"component":"HeroBanner","contentId":"hero-welcome","priority":1,"score":0.8,"reasoning":"New user, welcome banner"},
    {"component":"FeaturedCategoryRail","contentId":null,"propsOverrides":{"handle":"mens"},"priority":2,"score":0.7,"reasoning":"Default category for exploration"},
    {"component":"PersonalizedBanner","contentId":"banner-new-user","priority":3,"score":0.6,"reasoning":"Reassurance for new visitor"}
  ],
  "reasoning":{"intent":"exploring","confidence":0.7,"factors":["new_user_default"],"modelVersion":"adk-v1"}
}

## Selection Rules

1. Use availableContent and availableProducts provided in the user prompt
2. Select 2-6 components based on engagement level
3. Rank by priority (1 = strongest match)
4. Each component needs a reasoning string
5. Do NOT invent contentIds - only use IDs from availableContent
6. FeaturedCategoryRail: contentId MUST be null`;

export async function createRootAgent() {
  const { Agent } = await import('@google/adk');
  return new Agent({
    name: 'personalization_agent',
    model: process.env.MODEL || 'gemini-2.5-flash-lite',
    instruction: SYSTEM_INSTRUCTION,
    includeContents: 'none',
    disallowTransferToParent: true,
    disallowTransferToPeers: true,
    outputSchema: PersonalizationDecisionSchema as unknown as NonNullable<
      ConstructorParameters<typeof Agent>[0]['outputSchema']
    >,
    outputKey: 'personalization_decision',
  });
}
