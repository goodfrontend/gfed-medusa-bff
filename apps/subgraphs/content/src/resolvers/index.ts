import { mergeResolvers } from '@graphql-tools/merge';

import { footerResolvers } from './footer';
import { scalarsResolver } from './scalars';

export const resolvers: any = mergeResolvers([
  footerResolvers,
  scalarsResolver,
]);
