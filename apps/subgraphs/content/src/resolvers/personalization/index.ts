import { GraphQLError } from 'graphql';

import { features } from '../../config/features';
import type {
  PersonalizationResult,
  PersonalizedComponent,
  Resolvers,
} from '../../generated/graphql';
import type { ContentGraphQLContext } from '../../graphql/context';
import { aiPersonalize } from '../../services/personalization/ai-agent';
import { makeDecision } from '../../services/personalization/decision-engine';
import { getFallbackDecision } from '../../services/personalization/decision-fallback';
import {
  type CategoryAffinityEntry,
  featureStore,
} from '../../services/personalization/feature-store';
import { classifyIntent } from '../../services/personalization/intent-classifier';
import {
  MEDUSA_PERSONALIZATION_PATHS,
  postPersonalizationWebhook,
} from '../../services/personalization/medusa-webhooks';
import { resolveAudienceFields } from '../../services/personalization/sanity-content';
import { signalProcessor } from '../../services/personalization/signal-ingestion';

function requireAuthorizedClient(context: ContentGraphQLContext): void {
  if (!context.isAuthorizedClient) {
    throw new GraphQLError('Unauthorized', {
      extensions: { code: 'UNAUTHORIZED' },
    });
  }
}

const DEVICE_COOKIE = '_jg_device_id';

function resolveDeviceIdFromCookie(
  req: ContentGraphQLContext['req']
): string | null {
  const cookie = req.headers.cookie ?? '';
  const match = cookie.match(new RegExp(`${DEVICE_COOKIE}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function requireDeviceId(
  input: { deviceId?: string | null },
  context: ContentGraphQLContext
): string {
  const fromInput = input.deviceId?.trim();
  if (fromInput) {
    return fromInput;
  }
  const fromCookie = resolveDeviceIdFromCookie(context.req);
  if (fromCookie) {
    return fromCookie;
  }
  throw new GraphQLError('deviceId is required (or cookie _jg_device_id)', {
    extensions: { code: 'BAD_USER_INPUT' },
  });
}

type CachedPersonalization = {
  components: PersonalizedComponent[];
  reasoning: PersonalizationResult['reasoning'];
  cacheKey: string;
  servedAt?: string;
};

function toPersonalizationResult(
  decision: {
    components: Array<{
      component: string;
      contentId?: string | null;
      propsOverrides?: Record<string, unknown> | null;
      priority: number;
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
    servedAt?: string;
  },
  servedAt: string
): PersonalizationResult {
  return {
    components: decision.components.map((c) => {
      const overrides = c.propsOverrides
        ? resolveAudienceFields(c.propsOverrides)
        : {};
      return {
        component: c.component,
        contentId: c.contentId ?? null,
        propsOverrides: overrides,
        priority: c.priority,
        reasoning: c.reasoning,
        score: c.score,
      };
    }),
    reasoning: {
      intent: decision.reasoning.intent,
      confidence: decision.reasoning.confidence,
      factors: decision.reasoning.factors,
      modelVersion: decision.reasoning.modelVersion,
    },
    cacheKey: decision.cacheKey,
    servedAt: decision.servedAt ?? servedAt,
  };
}

export const personalizationResolvers: Resolvers = {
  Mutation: {
    sendSignal: async (_parent, { input }, context) => {
      requireAuthorizedClient(context);
      const deviceId = requireDeviceId(input, context);
      await signalProcessor.process(
        {
          type: input.type,
          payload: (input.payload ?? {}) as Record<string, unknown>,
          url: input.url ?? '',
          timestamp: input.timestamp ?? Date.now(),
        },
        deviceId,
        input.userId
      );
      return { success: true, profileUpdated: true };
    },

    submitConversion: async (_parent, { input }, context) => {
      requireAuthorizedClient(context);
      const profile = await featureStore.getOrCreate(input.deviceId);
      profile.orderCount = (profile.orderCount ?? 0) + 1;
      const totalOrders = profile.orderCount;

      if (totalOrders >= 5) {
        profile.lifecycleStage = 'LOYAL';
      } else if (totalOrders >= 2) {
        profile.lifecycleStage = 'FREQUENT';
      } else if (totalOrders >= 1) {
        profile.lifecycleStage = 'RETURNING';
      }

      if (input.items?.length) {
        for (const item of input.items) {
          if (item.category) {
            const entry = profile.categoryAffinity[item.category] ??=
              { views: 0, purchases: 0, lastViewed: 0, score: 0 };
            entry.purchases += 1;
          }
        }
      }

      if (input.items?.length && !input.items.some(i => i.category)) {
        const affinityEntries = Object.entries(profile.categoryAffinity) as Array<
          [string, CategoryAffinityEntry]
        >;
        const topCategory = affinityEntries.sort(
          (a, b) => b[1].score - a[1].score
        )[0];
        if (topCategory) {
          topCategory[1].purchases += 1;
        }
      }
      if (input.userId) {
        profile.userId = input.userId;
        await featureStore.mergeToUser(input.deviceId, input.userId);
      }
      await featureStore.save(profile);

      const payload: Record<string, unknown> = {
        device_id: input.deviceId,
        order_id: input.orderId,
        amount: input.amount,
        currency: input.currency,
      };
      if (input.userId) {
        payload.user_id = input.userId;
      }
      if (input.checkoutSignalId) {
        payload.checkout_signal_id = input.checkoutSignalId;
      }
      if (input.items?.length) {
        payload.items = input.items.map((item) => {
          const row: Record<string, unknown> = {
            product_id: item.productId,
            quantity: item.quantity,
            price: item.price,
          };
          if (item.variantId) {
            row.variant_id = item.variantId;
          }
          return row;
        });
      }

      await postPersonalizationWebhook(
        MEDUSA_PERSONALIZATION_PATHS.conversions,
        payload
      );

      await featureStore.recordOutcome(input.deviceId, 'checkout', [], true);
      return true;
    },
  },

  Query: {
    userProfile: async (_parent, { deviceId, userId }, context) => {
      requireAuthorizedClient(context);
      if (userId?.trim()) {
        const byUser = await featureStore.getByUserId(userId);
        if (byUser) return byUser;
      }
      return featureStore.getOrCreate(deviceId);
    },

    personalize: async (_parent, { input, deviceId, userId }, context) => {
      requireAuthorizedClient(context);
      let profile = await featureStore.getOrCreate(deviceId);
      if (userId) {
        profile = await featureStore.mergeToUser(deviceId, userId);
      }

      const cachedRaw = await featureStore.getCachedDecision(
        deviceId,
        input.surface
      );
      if (cachedRaw) {
        const cached = structuredClone(cachedRaw) as CachedPersonalization;
        cached.reasoning = {
          ...cached.reasoning,
          modelVersion: `${cached.reasoning.modelVersion}:cached`,
        };
        const servedAt = new Date().toISOString();
        return toPersonalizationResult(cached, servedAt);
      }

      const ctx = {
        surface: input.surface,
        page: input.page,
        productId: input.productId ?? undefined,
        cartValue: input.cartValue ?? undefined,
        category: input.category ?? undefined,
        searchQuery: input.searchQuery ?? undefined,
        price: input.price ?? undefined,
      };

      try {
        let decision;

        if (features.aiEnabled()) {
          try {
            const aiResult = await aiPersonalize(profile, ctx);
            decision = {
              components: aiResult.components.map(
                (c: {
                  component: string;
                  contentId: string | null;
                  priority: number;
                  propsOverrides: Record<string, unknown>;
                  reasoning: string;
                }) => ({
                  ...c,
                  score: 0,
                })
              ),
              reasoning: {
                intent: aiResult.intent,
                confidence: aiResult.confidence,
                factors: [aiResult.reasoning],
                modelVersion: 'ai-v1',
              },
              cacheKey: `decision:${deviceId}:${input.surface}`,
            };
          } catch (aiError) {
            console.error(
              '[Personalization] AI error, using rules:',
              aiError instanceof Error ? aiError.message : String(aiError)
            );
            decision = await makeDecision(profile, ctx);
          }
        } else {
          decision = await makeDecision(profile, ctx);
        }

        const servedAt = new Date().toISOString();
        const result = toPersonalizationResult(
          { ...decision, servedAt },
          servedAt
        );

        const toCache = {
          components: result.components,
          reasoning: result.reasoning,
          cacheKey: result.cacheKey,
          servedAt: result.servedAt,
        };
        await featureStore.cacheDecision(deviceId, input.surface, toCache, 300);
        await featureStore.recordDecision(deviceId, {
          surface: input.surface,
          components: result.components,
          intent: result.reasoning.intent,
          modelVersion: result.reasoning.modelVersion,
        });

        return result;
      } catch (err) {
        console.error('[Personalization] Decision error:', err);
        const fb = getFallbackDecision(input.surface, deviceId);
        const servedAt = new Date().toISOString();
        return toPersonalizationResult(
          { ...fb, servedAt },
          servedAt
        );
      }
    },

    debugIntent: async (_parent, { deviceId, userId }, context) => {
      requireAuthorizedClient(context);
      let profile =
        userId != null && userId !== ''
          ? await featureStore.getByUserId(userId)
          : null;
      if (!profile) {
        profile = await featureStore.getOrCreate(deviceId);
      }
      const intentScores = classifyIntent(profile);
      return {
        intent: intentScores[0]?.intent ?? 'browse',
        confidence: intentScores[0]?.score ?? 0,
        factors: intentScores
          .slice(0, 3)
          .map(
            (s: { intent: string; score: number }) =>
              `${s.intent}: ${(s.score * 100).toFixed(0)}%`
          ),
        modelVersion: 'rules-v1',
      };
    },
  },
};
