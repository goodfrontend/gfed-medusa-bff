import { mergeResolvers } from '@graphql-tools/merge';
import { Resolvers } from '@graphql/generated/graphql';

import { cartResolvers } from './cart';
import { fulfillmentResolvers } from './fulfillment';
import { paymentResolvers } from './payment';
import { queryResolvers } from './query';
import { regionResolvers } from './regions';
import { scalarsResolver } from './scalars';

export const resolvers = mergeResolvers([
  scalarsResolver,
  queryResolvers,
  cartResolvers,
  regionResolvers,
  fulfillmentResolvers,
  paymentResolvers,
]) as Resolvers;
