import { GraphQLError } from 'graphql';

import { features } from '../../config/features';
import type {
  PersonalizationResult,
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
import { logger } from '../../services/personalization/logger';

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
    components: decision.components.map((c) => ({
      component: c.component,
      contentId: c.contentId ?? null,
      propsOverrides: c.propsOverrides ?? {},
      priority: c.priority,
      reasoning: c.reasoning,
      score: c.score,
    })),
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
      const effectiveUserId = context.customerId ?? context.authId;

      const signal = {
        type: input.type,
        payload: (input.payload ?? {}) as Record<string, unknown>,
        url: input.url ?? '',
        timestamp: input.timestamp ?? Date.now(),
      };

      logger.info(
        {
          signalType: input.type,
          deviceId,
          userId: effectiveUserId ?? undefined,
          timestamp: input.timestamp ?? Date.now(),
        },
        'Signal received'
      );

      // Fire-and-forget per ADR-0001, but operations within the background
      // promise are sequential to avoid concurrent Redis read-modify-write
      if (context.medusaToken) {
        featureStore
          .syncOrderHistory(deviceId, context.medusaToken)
          .then((profile) =>
            signalProcessor.process(signal, deviceId, effectiveUserId, profile)
          )
          .catch((err) =>
            logger.error({ err, signalType: input.type }, 'Signal processing failed')
          );
      } else {
        signalProcessor
          .process(signal, deviceId, effectiveUserId)
          .catch((err) =>
            logger.error({ err, signalType: input.type }, 'Signal processing failed')
          );
      }

      return { success: true, profileUpdated: true };
    },

    submitConversion: async (_parent, { input }, context) => {
      requireAuthorizedClient(context);

      logger.info(
        {
          deviceId: input.deviceId,
          orderId: input.orderId,
          userId: input.userId ?? undefined,
          amount: input.amount ?? undefined,
          currency: input.currency ?? undefined,
          itemCount: input.items?.length ?? 0,
        },
        'Conversion submitted'
      );

      let profile = await featureStore.getOrCreate(input.deviceId);
      const effectiveUserId = context.customerId ?? context.authId ?? input.userId;
      if (effectiveUserId) {
        profile = await featureStore.mergeToUser(input.deviceId, effectiveUserId);
      }

      // Apply conversion modifications to the (possibly merged) profile
      profile.orderCount = (profile.orderCount ?? 0) + 1;
      profile.cartActivity = 0;
      profile.hesitationCount = 0;
      profile.lastPurchaseDate = Date.now();
      if (input.amount) {
        profile.totalSpent = (profile.totalSpent ?? 0) + input.amount;
        profile.averageOrderValue = (profile.totalSpent ?? 0) / (profile.orderCount ?? 1);
      }
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
      await featureStore.save(profile);

      return true;
    },
  },

  Query: {
    userProfile: async (_parent, { deviceId }, context) => {
      requireAuthorizedClient(context);
      if (context.medusaToken) {
        await featureStore.syncOrderHistory(deviceId, context.medusaToken);
      }
      const effectiveUserId = context.customerId?.trim() || context.authId?.trim();
      if (effectiveUserId) {
        const byUser = await featureStore.getByUserId(effectiveUserId);
        if (byUser) return byUser;
      }
      return featureStore.getOrCreate(deviceId);
    },

    personalize: async (_parent, { input, deviceId }, context) => {
      requireAuthorizedClient(context);
      let profile = await featureStore.getOrCreate(deviceId);
      if (context.medusaToken) {
        profile = await featureStore.syncOrderHistory(deviceId, context.medusaToken, profile);
      }
      const effectiveUserId = context.customerId ?? context.authId;
      if (effectiveUserId) {
        profile = await featureStore.mergeToUser(deviceId, effectiveUserId);
      }

      const ctx = {
        surface: input.surface,
        page: input.page,
        productId: input.productId ?? undefined,
        category: input.category ?? undefined,
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
            logger.warn({ err: aiError }, 'AI personalization failed, falling back to rules');
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

        return result;
      } catch (err) {
        logger.error({ err }, 'Decision engine error, using fallback');
        const fb = getFallbackDecision(input.surface, deviceId);
        const servedAt = new Date().toISOString();
        return toPersonalizationResult(
          { ...fb, servedAt },
          servedAt
        );
      }
    },

    debugIntent: async (_parent, { deviceId }, context) => {
      requireAuthorizedClient(context);
      if (context.medusaToken) {
        await featureStore.syncOrderHistory(deviceId, context.medusaToken);
      }
      const effectiveUserId = context.customerId?.trim() || context.authId?.trim();
      let profile =
        effectiveUserId
          ? await featureStore.getByUserId(effectiveUserId)
          : null;
      if (!profile) {
        profile = await featureStore.getOrCreate(deviceId);
      }
      const intentScores = classifyIntent(profile);
      return {
        intent: intentScores[0]?.intent ?? 'exploring',
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
