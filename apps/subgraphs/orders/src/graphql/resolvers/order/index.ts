import { handleMedusaError } from '@gfed-medusa/bff-lib-common';
import { GraphQLContext } from '@graphql/types/context';
import { normalizeOrder } from '@graphql/resolvers/cart/util/transforms';
import {
  buildOrderFields,
  buildOrdersListFields,
} from '@graphql/utils/fieldProjection';
import { StoreOrder } from '@medusajs/types';
import { GraphQLResolveInfo } from 'graphql';

function logProjectedFields(operation: string, fields: string) {
  if (process.env.LOG_MEDUSA_FIELDS === 'true') {
    console.info(`[medusa-fields] ${operation}: ${fields}`);
  }
}

const STRIPE_API_BASE = (
  process.env.STRIPE_API_BASE || 'https://api.stripe.com/v1'
).replace(/\/+$/, '');
const stripePaymentMethodCache = new Map<string, string | null>();

async function retrieveStripePaymentMethodLast4(paymentMethodId: string) {
  if (stripePaymentMethodCache.has(paymentMethodId)) {
    return stripePaymentMethodCache.get(paymentMethodId) ?? null;
  }

  const stripeSecretKey = process.env.STRIPE_API_KEY;
  if (!stripeSecretKey) {
    return null;
  }

  try {
    const response = await fetch(
      `${STRIPE_API_BASE}/payment_methods/${paymentMethodId}`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
      }
    );

    if (!response.ok) {
      stripePaymentMethodCache.set(paymentMethodId, null);
      return null;
    }

    const paymentMethod = (await response.json()) as {
      card?: { last4?: string };
    };

    const last4 = paymentMethod.card?.last4 ?? null;
    stripePaymentMethodCache.set(paymentMethodId, last4);

    return last4;
  } catch {
    stripePaymentMethodCache.set(paymentMethodId, null);
    return null;
  }
}

async function enrichOrderStripePaymentLast4(order: StoreOrder) {
  const paymentCollections = order.payment_collections ?? [];

  for (const collection of paymentCollections) {
    const payments = collection.payments ?? [];

    for (const payment of payments) {
      if (!payment.provider_id?.startsWith('pp_stripe_')) {
        continue;
      }

      const paymentData = (payment.data ?? {}) as {
        card_last4?: string;
        payment_method?: string;
      };

      if (paymentData.card_last4) {
        continue;
      }

      const paymentMethodId = paymentData.payment_method;
      if (!paymentMethodId) {
        continue;
      }

      const last4 = await retrieveStripePaymentMethodLast4(paymentMethodId);
      if (!last4) {
        continue;
      }

      payment.data = {
        ...paymentData,
        card_last4: last4,
      };
    }
  }
}

export const orderResolvers = {
  Query: {
    order: async (
      _: unknown,
      { id }: { id: string },
      { medusa }: GraphQLContext,
      info: GraphQLResolveInfo
    ) => {
      try {
        const fields = buildOrderFields(info);
        logProjectedFields('Query.order', fields);
        const { order } = await medusa.store.order.retrieve(id, {
          fields,
        });
        await enrichOrderStripePaymentLast4(order as StoreOrder);
        return normalizeOrder(order);
      } catch (e) {
        handleMedusaError(e, 'run Query.order', ['Query', 'order']);
      }
    },

    orders: async (
      _: unknown,
      { limit, offset }: { limit?: number; offset?: number },
      { medusa }: GraphQLContext,
      info: GraphQLResolveInfo
    ) => {
      try {
        const fields = buildOrdersListFields(info);
        logProjectedFields('Query.orders', fields);
        const { orders, count, limit: resLimit, offset: resOffset } =
          await medusa.store.order.list({
            limit,
            offset,
            order: '-created_at',
            fields,
          } as any);
        await Promise.all(
          orders.map((order) =>
            enrichOrderStripePaymentLast4(order as unknown as StoreOrder)
          )
        );
        return {
          orders: orders.map(normalizeOrder),
          count,
          limit: resLimit,
          offset: resOffset,
        };
      } catch (e) {
        handleMedusaError(e, 'run Query.orders', ['Query', 'orders']);
      }
    },
  },

  Mutation: {
    requestOrderTransfer: async (
      _: unknown,
      { orderId }: { orderId: string },
      { medusa }: GraphQLContext
    ) => {
      try {
        const { order } = await medusa.store.order.requestTransfer(
          orderId,
          {},
          { fields: 'id,email' }
        );
        return {
          success: true,
          error: null,
          order: { id: order.id, email: order.email },
        };
      } catch (e) {
        handleMedusaError(e, 'run Mutation.requestOrderTransfer', [
          'Mutation',
          'requestOrderTransfer',
        ]);
      }
    },

    acceptOrderTransfer: async (
      _: unknown,
      { orderId, token }: { orderId: string; token: string },
      { medusa }: GraphQLContext
    ) => {
      try {
        await medusa.store.order.acceptTransfer(orderId, { token });
        return { success: true, error: null, order: null };
      } catch (e) {
        handleMedusaError(e, 'run Mutation.acceptOrderTransfer', [
          'Mutation',
          'acceptOrderTransfer',
        ]);
      }
    },

    declineOrderTransfer: async (
      _: unknown,
      { orderId, token }: { orderId: string; token: string },
      { medusa }: GraphQLContext
    ) => {
      try {
        await medusa.store.order.declineTransfer(orderId, { token });
        return { success: true, error: null, order: null };
      } catch (e) {
        handleMedusaError(e, 'run Mutation.declineOrderTransfer', [
          'Mutation',
          'declineOrderTransfer',
        ]);
      }
    },
  },
};
