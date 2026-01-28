import { mergeResolvers } from '@graphql-tools/merge';

import { Resolvers } from '@graphql/generated/graphql';

import { customerResolvers } from './customers';
import { scalarsResolver } from './scalars';

export const resolvers = mergeResolvers([
  scalarsResolver,
  customerResolvers,
]) as Resolvers;
