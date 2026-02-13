import {
  UnauthorizedError,
  handleMedusaError,
} from '@gfed-medusa/bff-lib-common';
import { GraphQLContext } from '@graphql/types/context';

import { transformCustomer } from './util/transforms';

export const customerResolvers = {
  Query: {
    me: async (
      _: unknown,
      __: unknown,
      { medusa, session }: GraphQLContext
    ) => {
      try {
        if (!session?.isCustomerLoggedIn && !session?.medusaToken) {
          throw new UnauthorizedError('Unauthorized', {
            description: 'Customer is not logged in',
          });
        }

        const { customer } = await medusa.store.customer.retrieve({
          fields: '*orders',
        });

        return transformCustomer(customer);
      } catch (e) {
        handleMedusaError(e, 'run Query.me', ['Query', 'me']);
      }
    },
  },

  Mutation: {
    login: async (
      _: unknown,
      args: { email: string; password: string },
      { medusa }: GraphQLContext
    ) => {
      try {
        const token = await medusa.auth.login('customer', 'emailpass', {
          email: args.email,
          password: args.password,
        });

        if (typeof token !== 'string') {
          throw new Error('Unable to login');
        }

        return { token, isCustomerLoggedIn: true };
      } catch (e) {
        handleMedusaError(e, 'run Mutation.login', ['Mutation', 'login']);
      }
    },
    logout: async (_: unknown, __: unknown, { medusa }: GraphQLContext) => {
      await medusa.auth.logout();

      return { success: true };
    },
  },
};
