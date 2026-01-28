import { GraphQLDateTime } from 'graphql-scalars';

import { Resolvers } from '@graphql/generated/graphql';

export const scalarsResolver: Resolvers = {
  DateTime: GraphQLDateTime,
};
