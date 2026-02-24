import { handleMedusaError } from '@gfed-medusa/bff-lib-common';
import { GraphQLContext } from '@graphql/types/context';

import { transformShippingOption } from './util/transforms';

export const fulfillmentResolvers = {
  Query: {
    shippingOptions: async (
      _: unknown,
      { cartId }: { cartId: string },
      { medusa }: GraphQLContext
    ) => {
      try {
        const { shipping_options } = await medusa.store.fulfillment.listCartOptions({ cart_id: cartId });
        return shipping_options.map(transformShippingOption);
      } catch (e) {
        handleMedusaError(e, 'run Query.shippingOptions', ['Query', 'shippingOptions']);
      }
    },

    calculateShippingOption: async (
      _: unknown,
      { optionId, cartId, data }: { optionId: string; cartId: string; data?: Record<string, unknown> },
      { medusa }: GraphQLContext
    ) => {
      try {
        const { shipping_option } = await medusa.store.fulfillment.calculate(
          optionId,
          { cart_id: cartId, data: data ?? {} }
        );
        return transformShippingOption(shipping_option);
      } catch (e) {
        handleMedusaError(e, 'run Query.calculateShippingOption', ['Query', 'calculateShippingOption']);
      }
    },
  },
};
