import { handleMedusaError } from '@gfed-medusa/bff-lib-common';
import { GraphQLContext } from '@graphql/types/context';
import {
  buildRegionFields,
  buildRegionsFields,
} from '@graphql/utils/fieldProjection';
import { GraphQLResolveInfo } from 'graphql';

import { transformRegion } from './util/transforms';

function logProjectedFields(operation: string, fields: string) {
  if (process.env.LOG_MEDUSA_FIELDS === 'true') {
    console.info(`[medusa-fields] ${operation}: ${fields}`);
  }
}

export const regionResolvers = {
  Query: {
    regions: async (
      _: unknown,
      __: unknown,
      { medusa }: GraphQLContext,
      info: GraphQLResolveInfo
    ) => {
      try {
        const fields = buildRegionsFields(info);
        logProjectedFields('Query.regions', fields);
        const { regions } = await medusa.store.region.list({
          fields,
        });
        return regions.map(transformRegion);
      } catch (e) {
        handleMedusaError(e, 'run Query.regions', ['Query', 'regions']);
      }
    },

    region: async (
      _: unknown,
      { id }: { id: string },
      { medusa }: GraphQLContext,
      info: GraphQLResolveInfo
    ) => {
      try {
        const fields = buildRegionFields(info);
        logProjectedFields('Query.region', fields);
        const { region } = await medusa.store.region.retrieve(id, {
          fields,
        });
        return transformRegion(region);
      } catch (e) {
        handleMedusaError(e, 'run Query.region', ['Query', 'region']);
      }
    },
  },
};
