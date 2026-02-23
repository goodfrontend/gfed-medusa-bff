import {
  UnauthorizedError,
  handleMedusaError,
} from '@gfed-medusa/bff-lib-common';
import {
  MutationLoginArgs,
  MutationRegisterArgs,
} from '@graphql/generated/graphql';
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

        const { customer } = await medusa.store.customer.retrieve(
          { fields: '*orders' },
          session?.medusaToken
            ? { Authorization: `Bearer ${session.medusaToken}` }
            : {}
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
      { input }: MutationRegisterArgs,
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
            first_name: input.firstName ?? undefined,
            last_name: input.lastName ?? undefined,
            phone: input.phone ?? undefined,
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
      { input }: MutationLoginArgs,
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
