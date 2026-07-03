import { GraphQLError } from 'graphql';

import { adkConfig } from '../../config/adk-config';
import type { ContentGraphQLContext } from '../../graphql/context';
import {
  type CategoryOption,
  fetchCategoryProductsEnriched,
} from '../../services/medusa/category-products';
import {
  getCachedDecision,
  invalidateCachedDecision,
  setCachedDecision,
} from '../../services/personalization/adk-cache';
import {
  type AdkAgentResponse,
  callAdkAgent,
} from '../../services/personalization/adk-client';
import { COMPONENT_CONTENT_FIELDS } from '../../services/personalization/ai-agent';
import { getRelevantCategories } from '../../services/personalization/decision-engine';
import { getFallbackDecision } from '../../services/personalization/decision-fallback';
import { featureStore } from '../../services/personalization/feature-store';
import type { DecisionRecord } from '../../services/personalization/feature-store';
import { classifyIntent } from '../../services/personalization/intent-classifier';
import { logger } from '../../services/personalization/logger';
import { enrichProfileForAdk } from '../../services/personalization/profile-enricher';
import { fetchAvailableContent } from '../../services/personalization/sanity-content';
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

export function enrichComponents(
  components: AdkAgentResponse['components'],
  availableContent: Array<Record<string, unknown>>,
  availableProducts: Array<Record<string, unknown>>,
  relevantCategories: CategoryOption[]
): AdkAgentResponse['components'] {
  const contentById = new Map<string, Record<string, unknown>>();
  for (const content of availableContent) {
    const id = content._id as string | undefined;
    if (id) {
      contentById.set(id, content);
    }
  }

  const enriched = components.map((c) => {
    const { component, contentId, propsOverrides } = c;

    if (
      (component === 'HeroBanner' || component === 'PersonalizedBanner') &&
      contentId
    ) {
      const contentEntry = contentById.get(contentId);
      if (contentEntry) {
        const fieldsToSpread = COMPONENT_CONTENT_FIELDS[component];
        const contentFields: Record<string, unknown> = {};
        if (fieldsToSpread) {
          for (const field of fieldsToSpread) {
            if (contentEntry[field] != null) {
              contentFields[field] = contentEntry[field];
            }
          }
        }
        return {
          ...c,
          contentId,
          propsOverrides: { ...contentFields, ...(propsOverrides ?? {}) },
        };
      }

      logger.warn(
        { component, contentId },
        'Agent used contentId not found in available content; nullifying'
      );
      return {
        ...c,
        contentId: null,
        propsOverrides: propsOverrides ?? {},
      };
    }

    if (component === 'FeaturedCategoryRail') {
      // Use agent-provided handle, or fall back to top relevant category
      let handle = propsOverrides?.handle as string | undefined;
      let categoryName = '';
      if (!handle && relevantCategories.length > 0) {
        const topCategory = relevantCategories[0];
        handle = topCategory!.handle;
        categoryName = topCategory!.name;
      } else if (handle) {
        categoryName =
          relevantCategories.find((cat) => cat.handle === handle)?.name ?? '';
      }
      const products = handle
        ? availableProducts.filter((p) => (p.__category as string) === handle)
        : [];
      // Trim products and limit to 4 per rail to keep response size small
      const trimmedProducts = trimProducts(products).slice(0, 4);
      return {
        ...c,
        contentId: null,
        propsOverrides: {
          title: categoryName,
          handle: handle ?? '',
          products: trimmedProducts,
          ...(propsOverrides ?? {}),
        },
      };
    }

    return {
      ...c,
      propsOverrides: propsOverrides ?? {},
    };
  });

  // Validate reasoning against component title for gender/category consistency
  for (const c of enriched) {
    if (!c.reasoning) continue;
    const title = c.propsOverrides?.title as string | undefined;
    if (!title) continue;

    const titleLower = title.toLowerCase();
    const reasoningLower = c.reasoning.toLowerCase();

    const genderPairs = [
      { titleToken: "men's", reasoningToken: "women's" },
      { titleToken: "women's", reasoningToken: "men's" },
      { titleToken: 'men ', reasoningToken: 'women' },
      { titleToken: 'women ', reasoningToken: 'men' },
      { titleToken: 'male', reasoningToken: 'female' },
      { titleToken: 'female', reasoningToken: 'male' },
    ];

    for (const pair of genderPairs) {
      if (
        titleLower.includes(pair.titleToken) &&
        reasoningLower.includes(pair.reasoningToken)
      ) {
        logger.warn(
          {
            component: c.component,
            title,
            reasoning: c.reasoning,
          },
          'Reasoning gender mismatch detected against component title; appending note'
        );
        c.reasoning = `${c.reasoning} (note: component targets ${title})`;
        break;
      }
    }
  }

  return enriched;
}

/**
 * Deduplicate components keeping the first occurrence (highest priority).
 * - HeroBanner/PersonalizedBanner: key = `${component}:${contentId}`
 * - FeaturedCategoryRail: key = `FeaturedCategoryRail:${handle}`
 * - Others: key = `${component}:null`
 */
export function deduplicateComponents(
  components: AdkAgentResponse['components']
): AdkAgentResponse['components'] {
  const seen = new Set<string>();
  return components.filter((c) => {
    let key: string;
    if (c.component === 'FeaturedCategoryRail') {
      const handle = c.propsOverrides?.handle as string | undefined;
      key = `FeaturedCategoryRail:${handle ?? 'null'}`;
    } else if (c.contentId !== null && c.contentId !== undefined) {
      key = `${c.component}:${c.contentId}`;
    } else {
      key = `${c.component}:null`;
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Trim products to only fields the agent needs: id, title, handle, thumbnail.
 * Removes price, currencyCode, description, __category and any other fields.
 */
export function trimProducts(
  products: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return products.map((p) => {
    const trimmed: Record<string, unknown> = {};
    if (p.id != null) trimmed.id = p.id;
    if (p.title != null) trimmed.title = p.title;
    if (p.handle != null) trimmed.handle = p.handle;
    if (p.thumbnail != null) trimmed.thumbnail = p.thumbnail;
    return trimmed;
  });
}

export const adkPersonalizationResolvers = {
  Query: {
    adkPersonalize: async (
      _parent: Record<string, unknown>,
      args: {
        deviceId: string;
        input: {
          surface: string;
          page: string;
          productId?: string | null;
          category?: string | null;
          price?: number | null;
        };
      },
      context: ContentGraphQLContext
    ) => {
      requireAuthorizedClient(context);
      const deviceId = requireDeviceId(args, context);
      const t0 = Date.now();
      let profile = await featureStore.getOrCreate(deviceId);
      if (context.medusaToken) {
        profile = await featureStore.syncOrderHistory(
          deviceId,
          context.medusaToken,
          profile
        );
      }
      const effectiveUserId = context.customerId ?? context.authId;
      if (effectiveUserId) {
        profile = await featureStore.mergeToUser(deviceId, effectiveUserId);
      }
      logger.info({ durationMs: Date.now() - t0 }, 'Profile loading complete');

      const ctx = {
        surface: args.input.surface,
        page: args.input.page,
        productId: args.input.productId ?? undefined,
        category: args.input.category ?? undefined,
        price: args.input.price ?? undefined,
      };

      // Check cache first
      const cached = await getCachedDecision(deviceId, args.input.surface);
      if (cached) {
        const cachedResult = cached as {
          components: Array<Record<string, unknown>>;
          reasoning: Record<string, unknown>;
          cacheKey: string | null;
          servedAt: string | null;
        };
        return {
          components: (cachedResult.components ?? []).map((c) => ({
            component: (c.component as string) ?? 'HeroBanner',
            contentId: (c.contentId as string) ?? null,
            propsOverrides: (c.propsOverrides as Record<string, unknown>) ?? {},
            priority: (c.priority as number) ?? 1,
            reasoning: (c.reasoning as string) ?? '',
            score: (c.score as number) ?? 0,
          })),
          reasoning: {
            intent: (cachedResult.reasoning?.intent as string) ?? 'exploring',
            confidence: (cachedResult.reasoning?.confidence as number) ?? 0.5,
            factors: (cachedResult.reasoning?.factors as string[]) ?? [],
            modelVersion:
              (cachedResult.reasoning?.modelVersion as string) ?? 'adk-v1',
          },
          cacheKey:
            cachedResult.cacheKey || `adk:${deviceId}:${args.input.surface}`,
          servedAt: cachedResult.servedAt ?? new Date().toISOString(),
        };
      }

      // Fetch recent decision history for the agent to learn from
      const recentDecisions = await featureStore
        .getRecentDecisions(deviceId)
        .catch(() => [] as DecisionRecord[]);

      // Pre-fetch Sanity content and Medusa products
      const availableContent = await fetchAvailableContent(args.input.surface);
      const relevantCategories = getRelevantCategories(profile);
      const productResults = await Promise.all(
        relevantCategories.slice(0, 4).map(async (cat) => {
          const products = await fetchCategoryProductsEnriched(cat.handle);
          return products.map((p) => ({ ...p, __category: cat.handle }));
        })
      );
      const availableProducts = productResults.flat();
      // Trim products to reduce payload to agent (keep only id, title, handle, thumbnail)
      const trimmedProducts = trimProducts(availableProducts);
      logger.info(
        { durationMs: Date.now() - t0 },
        'Content & product fetching complete'
      );

      // Enrich profile with computed signals for the ADK agent
      const enrichedProfile = enrichProfileForAdk(profile);

      // Trim profile payload to minimize ADK agent input tokens
      const agentProfile: Record<string, unknown> = {
        ...(enrichedProfile as unknown as Record<string, unknown>),
        recentDecisions,
      };
      // Trim large arrays
      if (Array.isArray(agentProfile.recentProducts)) {
        agentProfile.recentProducts = (
          agentProfile.recentProducts as Array<unknown>
        ).slice(-5);
      }
      if (Array.isArray(agentProfile.searchHistory)) {
        agentProfile.searchHistory = (
          agentProfile.searchHistory as Array<unknown>
        ).slice(-5);
      }
      const currentSession = agentProfile.currentSession as
        Record<string, unknown> | undefined;
      if (currentSession) {
        if (Array.isArray(currentSession.productViews)) {
          currentSession.productViews = (
            currentSession.productViews as Array<unknown>
          ).slice(-10);
        }
        if (Array.isArray(currentSession.searches)) {
          currentSession.searches = (
            currentSession.searches as Array<unknown>
          ).slice(-10);
        }
      }

      // Call ADK agent with pre-fetched content (fallback to rules engine on failure)
      let agentResult: AdkAgentResponse;
      try {
        agentResult = await callAdkAgent(
          deviceId,
          agentProfile,
          ctx,
          availableContent,
          trimmedProducts
        );
      } catch (err) {
        logger.warn({ err }, 'ADK agent failed, using fallback');
        const fallback = getFallbackDecision(ctx.surface, deviceId);
        agentResult = {
          components: fallback.components.map((c) => ({
            ...c,
            score: c.score ?? 0,
          })),
          reasoning: fallback.reasoning,
          cacheKey: fallback.cacheKey,
        };
      }
      logger.info({ durationMs: Date.now() - t0 }, 'ADK agent call complete');

      // Store decision record for feedback loop (fire-and-forget)
      featureStore
        .storeDecision(deviceId, {
          servedAt: Date.now(),
          components: agentResult.components.map((c) => c.component),
          intent: agentResult.reasoning.intent,
          surface: args.input.surface,
        })
        .catch((err: Error) =>
          logger.warn({ err }, 'Failed to store decision record')
        );

      // Deduplicate components before enriching (prevent duplicate contentId/handle)
      agentResult.components = deduplicateComponents(agentResult.components);

      // Enrich components with content data from pre-fetched availableContent and availableProducts
      const enrichedComponents = enrichComponents(
        agentResult.components,
        availableContent,
        availableProducts,
        relevantCategories
      );

      const servedAt = new Date().toISOString();
      const result = {
        components: enrichedComponents.map((c) => ({
          component: c.component ?? 'HeroBanner',
          contentId: c.contentId ?? null,
          propsOverrides: c.propsOverrides ?? {},
          priority: c.priority ?? 1,
          reasoning: c.reasoning ?? '',
          score: c.score ?? 0,
        })),
        reasoning: {
          intent: agentResult.reasoning?.intent ?? 'exploring',
          confidence: agentResult.reasoning?.confidence ?? 0.5,
          factors: agentResult.reasoning?.factors ?? [],
          modelVersion: agentResult.reasoning?.modelVersion ?? 'adk-v1',
        },
        cacheKey: agentResult.cacheKey || `adk:${deviceId}:${ctx.surface}`,
        servedAt,
      };

      // Cache the result
      await setCachedDecision(deviceId, args.input.surface, result).catch(
        (cacheErr: Error) =>
          logger.warn({ err: cacheErr }, 'Failed to cache ADK decision')
      );

      logger.info(
        { durationMs: Date.now() - t0 },
        'Total adkPersonalize duration'
      );

      return result;
    },

    adkUserProfile: async (
      _parent: Record<string, unknown>,
      args: { deviceId: string },
      context: ContentGraphQLContext
    ) => {
      requireAuthorizedClient(context);
      if (context.medusaToken) {
        await featureStore.syncOrderHistory(args.deviceId, context.medusaToken);
      }
      const effectiveUserId =
        context.customerId?.trim() || context.authId?.trim();
      if (effectiveUserId) {
        const byUser = await featureStore.getByUserId(effectiveUserId);
        if (byUser) return byUser;
      }
      return featureStore.getOrCreate(args.deviceId);
    },

    adkDebugIntent: async (
      _parent: Record<string, unknown>,
      args: { deviceId: string },
      context: ContentGraphQLContext
    ) => {
      requireAuthorizedClient(context);
      if (context.medusaToken) {
        await featureStore.syncOrderHistory(args.deviceId, context.medusaToken);
      }
      const effectiveUserId =
        context.customerId?.trim() || context.authId?.trim();
      let profile = effectiveUserId
        ? await featureStore.getByUserId(effectiveUserId)
        : null;
      if (!profile) {
        profile = await featureStore.getOrCreate(args.deviceId);
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
        modelVersion: 'adk-v1',
      };
    },
  },

  Mutation: {
    adkSendSignal: async (
      _parent: Record<string, unknown>,
      args: {
        input: {
          deviceId?: string | null;
          type: string;
          payload?: Record<string, unknown> | null;
          url?: string | null;
          timestamp?: number | null;
        };
      },
      context: ContentGraphQLContext
    ) => {
      requireAuthorizedClient(context);
      const deviceId = requireDeviceId(args.input, context);
      const effectiveUserId = context.customerId ?? context.authId;

      const signal = {
        type: args.input.type,
        payload: (args.input.payload ?? {}) as Record<string, unknown>,
        url: args.input.url ?? '',
        timestamp: args.input.timestamp ?? Date.now(),
      };

      logger.info(
        {
          signalType: args.input.type,
          deviceId,
          userId: effectiveUserId ?? undefined,
          timestamp: signal.timestamp,
        },
        'ADK signal received'
      );

      // Mirror existing sendSignal: sync order history if authenticated, then process signal
      if (context.medusaToken) {
        featureStore
          .syncOrderHistory(deviceId, context.medusaToken)
          .then((profile) =>
            signalProcessor.process(
              signal,
              deviceId,
              effectiveUserId ?? undefined,
              profile
            )
          )
          .then(() => invalidateCachedDecision(deviceId))
          .catch((err: Error) =>
            logger.error(
              { err, signalType: args.input.type },
              'ADK signal processing failed'
            )
          );
      } else {
        signalProcessor
          .process(signal, deviceId, effectiveUserId ?? undefined)
          .then(() => invalidateCachedDecision(deviceId))
          .catch((err: Error) =>
            logger.error(
              { err, signalType: args.input.type },
              'ADK signal processing failed'
            )
          );
      }

      // Attribution: for CONVERSION/PURCHASE signals, attribute to most recent decision within 24h
      if (args.input.type === 'CONVERSION' || args.input.type === 'PURCHASE') {
        featureStore
          .getRecentDecisions(deviceId)
          .then((decisions) => {
            const recent = decisions.find(
              (d) => Date.now() - d.servedAt < 24 * 60 * 60 * 1000
            );
            if (recent) {
              logger.info(
                { deviceId, decision: recent, signalType: args.input.type },
                'Conversion attributed to decision'
              );
            }
          })
          .catch((err: Error) =>
            logger.warn({ err }, 'Failed to attribute conversion')
          );
      }

      // Fire-and-forget Pub/Sub publish per ADR-0001
      // Memory Bank populated later via Dataflow pipeline (batch, scalable)
      if (adkConfig.enabled()) {
        publishToPubSub(signal).catch((err: Error) =>
          logger.error(
            { err, signalType: args.input.type },
            'ADK Pub/Sub publish failed'
          )
        );
      }

      return { success: true, profileUpdated: true };
    },
  },
};

async function publishToPubSub(signal: {
  type: string;
  payload: Record<string, unknown>;
  url: string;
  timestamp: number;
}): Promise<void> {
  const projectId = adkConfig.pubsub.projectId();
  if (!projectId) {
    logger.warn('ADK Pub/Sub project ID not configured, skipping publish');
    return;
  }

  const { PubSub } = await import('@google-cloud/pubsub');
  const pubSubClient = new PubSub({ projectId });
  const topicName = adkConfig.pubsub.topicName();
  const dataBuffer = Buffer.from(JSON.stringify(signal));

  await pubSubClient.topic(topicName).publishMessage({ data: dataBuffer });
  logger.info({ topic: topicName }, 'ADK signal published to Pub/Sub');
}
