import { mergeResolvers } from '@graphql-tools/merge';

import { Resolvers } from '../generated/graphql';
import { footerResolvers } from './footer';
import { scalarsResolver } from './scalars';

export const resolvers: Resolvers = mergeResolvers([
  footerResolvers,
  scalarsResolver,
]);
