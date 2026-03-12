import { handleMedusaError } from '@gfed-medusa/bff-lib-common';
import { GraphQLContext } from '@graphql/types/context';
import { buildShippingOptionFields } from '@graphql/utils/fieldProjection';
import { GraphQLResolveInfo } from 'graphql';

import { transformShippingOption } from './util/transforms';

function logProjectedFields(operation: string, fields?: string) {
  if (process.env.LOG_MEDUSA_FIELDS === 'true') {
    console.info(`[medusa-fields] ${operation}: ${fields ?? '<default>'}`);
  }
}

export const fulfillmentResolvers = {
  Query: {
    shippingOptions: async (
      _: unknown,
      { cartId }: { cartId: string },
      { medusa }: GraphQLContext,
      info: GraphQLResolveInfo
    ) => {
      try {
        const fields = buildShippingOptionFields(info);
        logProjectedFields('Query.shippingOptions', fields);
        const { shipping_options } = await medusa.store.fulfillment.listCartOptions({
          cart_id: cartId,
          ...(fields ? { fields } : {}),
        });
        return shipping_options.map(transformShippingOption);
      } catch (e) {
        handleMedusaError(e, 'run Query.shippingOptions', ['Query', 'shippingOptions']);
      }
    },
  },

  Mutation: {
    calculateShippingOptionPrice: async (
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
        handleMedusaError(e, 'run Mutation.calculateShippingOptionPrice', [
          'Mutation',
          'calculateShippingOptionPrice',
        ]);
      }
    },
  },
};
