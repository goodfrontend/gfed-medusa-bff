import {
  UnauthorizedError,
  handleMedusaError,
} from '@gfed-medusa/bff-lib-common';
import { GraphQLContext } from '@graphql/types/context';
import { StoreCustomer } from '@medusajs/types';

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

        const { customer } = await medusa.store.customer.retrieve(
          { fields: '*orders' },
          {
            Authorization: `Bearer ${session?.medusaToken}`,
          }
        );

        return transformCustomer(customer);
      } catch (e) {
        handleMedusaError(e, 'run Query.me', ['Query', 'me']);
      }
    },
  },

  Mutation: {
    register: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          email: string;
          password: string;
          firstName?: string;
          lastName?: string;
          phone?: string;
        };
      },
      { medusa }: GraphQLContext
    ) => {
      try {
        const token = await medusa.auth.register('customer', 'emailpass', {
          email: input.email,
          password: input.password,
        });

        if (typeof token !== 'string') {
          throw new Error('Unable to register');
        }

        const { customer } = await medusa.store.customer.create(
          {
            email: input.email,
            first_name: input.firstName,
            last_name: input.lastName,
            phone: input.phone,
          },
          {},
          {
            Authorization: `Bearer ${token}`,
          }
        );

        return {
          token,
          customer: transformCustomer(customer),
        };
      } catch (e) {
        handleMedusaError(e, 'run Mutation.register', ['Mutation', 'register']);
      }
    },

    login: async (
      _: unknown,
      { input }: { input: { email: string; password: string } },
      { medusa }: GraphQLContext
    ) => {
      try {
        const token = await medusa.auth.login('customer', 'emailpass', {
          email: input.email,
          password: input.password,
        });

        if (typeof token !== 'string') {
          throw new Error('Unable to login');
        }

        const { customer } = await medusa.store.customer.retrieve(
          { fields: '*orders' },
          {
            Authorization: `Bearer ${token}`,
          }
        );

        return {
          token,
          customer: transformCustomer(customer),
        };
      } catch (e) {
        handleMedusaError(e, 'run Mutation.login', ['Mutation', 'login']);
      }
    },

    logout: async (_: unknown, __: unknown, { medusa }: GraphQLContext) => {
      try {
        await medusa.auth.logout();
        return true;
      } catch (e) {
        handleMedusaError(e, 'run Mutation.logout', ['Mutation', 'logout']);
      }
    },
  },
};
