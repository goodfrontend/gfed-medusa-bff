import { handleMedusaError } from '@gfed-medusa/bff-lib-common';
import { GraphQLContext } from '@graphql/types/context';

export const paymentResolvers = {
  Query: {
    paymentProviders: async (
      _: unknown,
      { regionId }: { regionId: string },
      { medusa }: GraphQLContext
    ) => {
      try {
        const { payment_providers } = await medusa.store.payment.listPaymentProviders({
          region_id: regionId,
        });
        return payment_providers
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((p) => ({ id: p.id }));
      } catch (e) {
        handleMedusaError(e, 'run Query.paymentProviders', ['Query', 'paymentProviders']);
      }
    },
  },
};
