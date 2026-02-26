import { handleMedusaError } from '@gfed-medusa/bff-lib-common';
import { GraphQLContext } from '@graphql/types/context';
import { normalizeOrder } from '@graphql/resolvers/cart/util/transforms';

const ORDER_FIELDS =
  '*payment_collections.payments,*items,*items.metadata,*items.variant,*items.product';

const ORDER_LIST_FIELDS =
  '*items,+items.metadata,*items.variant,*items.product';

export const orderResolvers = {
  Query: {
    order: async (
      _: unknown,
      { id }: { id: string },
      { medusa }: GraphQLContext
    ) => {
      try {
        const { order } = await medusa.store.order.retrieve(id, {
          fields: ORDER_FIELDS,
        });
        return normalizeOrder(order);
      } catch (e) {
        handleMedusaError(e, 'run Query.order', ['Query', 'order']);
      }
    },

    orders: async (
      _: unknown,
      { limit, offset }: { limit?: number; offset?: number },
      { medusa }: GraphQLContext
    ) => {
      try {
        const { orders, count, limit: resLimit, offset: resOffset } =
          await medusa.store.order.list({
            limit,
            offset,
            order: '-created_at',
            fields: ORDER_LIST_FIELDS,
          } as any);
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
