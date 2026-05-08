import { mergeResolvers } from '@graphql-tools/merge';

import { Resolvers } from '../generated/graphql';
import { contextualBannerResolvers } from './contextual-banner';
import { footerResolvers } from './footer';
import { homeBannerResolvers } from './home-banner';
import { queryResolvers } from './query';
import { scalarsResolver } from './scalars';

export const resolvers: Resolvers = mergeResolvers([
  queryResolvers,
  footerResolvers,
  homeBannerResolvers,
  contextualBannerResolvers,
  scalarsResolver,
]);
