import { mergeResolvers } from '@graphql-tools/merge';
import { Resolvers } from '@graphql/generated/graphql';

import { cartResolvers } from './cart';
import { queryResolvers } from './query';
import { scalarsResolver } from './scalars';

export const resolvers = mergeResolvers([
  scalarsResolver,
  queryResolvers,
  cartResolvers,
]) as Resolvers;
