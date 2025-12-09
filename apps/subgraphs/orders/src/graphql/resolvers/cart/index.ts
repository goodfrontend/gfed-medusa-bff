import { GraphQLContext } from '@graphql/types/context';
import type { HttpTypes } from '@medusajs/types';

import {
  camelToSnakeCase,
  normalizeCart,
  normalizeCompleteCartResponse,
} from './util/transforms';

export const cartResolvers = {
  Query: {
    cart: async (
      _parent: unknown,
      { id }: { id: string },
      { medusa }: GraphQLContext
    ) => {
      const { cart } = await medusa.store.cart.retrieve(id, {
        fields:
          '+items.*,items.variant.*,items.variant.product.*,shipping_methods.*',
      });

      return normalizeCart(cart);
    },
  },

  Mutation: {
    createCart: async (
      _parent: unknown,
      { data }: { data: HttpTypes.StoreCreateCart },
      { medusa }: GraphQLContext
    ) => {
      const { cart } = await medusa.store.cart.create(camelToSnakeCase(data));
      return normalizeCart(cart);
    },

    updateCart: async (
      _parent: unknown,
      { id, data }: { id: string; data: HttpTypes.StoreUpdateCart },
      { medusa }: GraphQLContext
    ) => {
      const { cart } = await medusa.store.cart.update(
        id,
        camelToSnakeCase(data)
      );
      return normalizeCart(cart);
    },

    createLineItem: async (
      _parent: unknown,
      {
        cartId,
        data,
      }: { cartId: string; data: HttpTypes.StoreAddCartLineItem },
      { medusa }: GraphQLContext
    ) => {
      const { cart } = await medusa.store.cart.createLineItem(
        cartId,
        camelToSnakeCase(data)
      );
      return normalizeCart(cart);
    },

    updateLineItem: async (
      _parent: unknown,
      {
        cartId,
        lineItemId,
        data,
      }: {
        cartId: string;
        lineItemId: string;
        data: HttpTypes.StoreUpdateCartLineItem;
      },
      { medusa }: GraphQLContext
    ) => {
      const { cart } = await medusa.store.cart.updateLineItem(
        cartId,
        lineItemId,
        data
      );
      return normalizeCart(cart);
    },

    deleteLineItem: async (
      _parent: unknown,
      { cartId, lineItemId }: { cartId: string; lineItemId: string },
      { medusa }: GraphQLContext
    ) => {
      return await medusa.store.cart.deleteLineItem(cartId, lineItemId);
    },

    addShippingMethod: async (
      _parent: unknown,
      { cartId, optionId }: { cartId: string; optionId: string },
      { medusa }: GraphQLContext
    ) => {
      const { cart } = await medusa.store.cart.addShippingMethod(cartId, {
        option_id: optionId,
      });
      return normalizeCart(cart);
    },

    completeCart: async (
      _parent: unknown,
      { cartId }: { cartId: string },
      { medusa }: GraphQLContext
    ) => {
      const response = await medusa.store.cart.complete(cartId);
      return normalizeCompleteCartResponse(response);
    },

    transferCart: async (
      _parent: unknown,
      { cartId }: { cartId: string },
      { medusa }: GraphQLContext
    ) => {
      const { cart } = await medusa.store.cart.transferCart(cartId, {});
      return normalizeCart(cart);
    },

    applyPromotions: async (
      _parent: unknown,
      { cartId, codes }: { cartId: string; codes: string[] },
      { medusa }: GraphQLContext
    ) => {
      const { cart } = await medusa.store.cart.update(cartId, {
        promo_codes: codes,
      });
      return normalizeCart(cart);
    },
  },

  CompleteCartResponse: {
    __resolveType(obj: HttpTypes.StoreCompleteCartResponse) {
      if (obj.type === 'order') {
        return 'CompleteCartOrderResult';
      }
      if (obj.type === 'cart') {
        return 'CompleteCartErrorResult';
      }
      return null;
    },
  },
};
