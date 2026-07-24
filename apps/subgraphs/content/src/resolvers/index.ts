import { mergeResolvers } from '@graphql-tools/merge';

import { Resolvers } from '../generated/graphql';
import { adkPersonalizationResolvers } from './adk-personalization';
import { contextualBannerResolvers } from './contextual-banner';
import { footerResolvers } from './footer';
import { homeBannerResolvers } from './home-banner';
import { personalizationResolvers } from './personalization';
import { queryResolvers } from './query';
import { scalarsResolver } from './scalars';

export const resolvers: Resolvers = mergeResolvers([
  queryResolvers,
  footerResolvers,
  homeBannerResolvers,
  personalizationResolvers,
  contextualBannerResolvers,
  adkPersonalizationResolvers,
  scalarsResolver,
]);
