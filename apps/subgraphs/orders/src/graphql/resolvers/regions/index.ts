import { handleMedusaError } from '@gfed-medusa/bff-lib-common';
import { GraphQLContext } from '@graphql/types/context';

import { transformRegion } from './util/transforms';

export const regionResolvers = {
  Query: {
    regions: async (_: unknown, __: unknown, { medusa }: GraphQLContext) => {
      try {
        const { regions } = await medusa.store.region.list({});
        return regions.map(transformRegion);
      } catch (e) {
        handleMedusaError(e, 'run Query.regions', ['Query', 'regions']);
      }
    },

    region: async (
      _: unknown,
      { id }: { id: string },
      { medusa }: GraphQLContext
    ) => {
      try {
        const { region } = await medusa.store.region.retrieve(id);
        return transformRegion(region);
      } catch (e) {
        handleMedusaError(e, 'run Query.region', ['Query', 'region']);
      }
    },
  },
};
