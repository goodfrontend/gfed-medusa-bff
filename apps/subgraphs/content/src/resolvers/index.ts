import { mergeResolvers } from '@graphql-tools/merge';

import { Resolvers } from '../generated/graphql';
import { footerResolvers } from './footer';
import { queryResolvers } from './query';
import { scalarsResolver } from './scalars';

export const resolvers: Resolvers = mergeResolvers([
  queryResolvers,
  footerResolvers,
  scalarsResolver,
]);
