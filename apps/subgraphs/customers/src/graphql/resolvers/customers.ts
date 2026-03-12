import {
  UnauthorizedError,
  handleMedusaError,
} from '@gfed-medusa/bff-lib-common';
import {
  MutationAddCustomerAddressArgs,
  MutationDeleteCustomerAddressArgs,
  MutationLoginArgs,
  MutationRegisterArgs,
  MutationUpdateCustomerAddressArgs,
  MutationUpdateCustomerArgs,
} from '@graphql/generated/graphql';
import { GraphQLContext } from '@graphql/types/context';
import { GraphQLResolveInfo } from 'graphql';

import { buildCustomerFields } from '../utils/fieldProjection';

import { transformCustomer } from './util/transforms';

function logProjectedFields(operation: string, fields: string) {
  if (process.env.LOG_MEDUSA_FIELDS === 'true') {
    console.info(`[medusa-fields] ${operation}: ${fields}`);
  }
}

export const customerResolvers = {
  Query: {
    me: async (
      _: unknown,
      __: unknown,
      { medusa, session }: GraphQLContext,
      info: GraphQLResolveInfo
    ) => {
      try {
        if (!session?.isCustomerLoggedIn && !session?.medusaToken) {
          throw new UnauthorizedError('Unauthorized', {
            description: 'Customer is not logged in',
          });
        }

        const customerFields = buildCustomerFields(info);
        logProjectedFields('Query.me', customerFields);
        const { customer } = await medusa.store.customer.retrieve(
          { fields: customerFields },
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

    updateCustomer: async (
      _: unknown,
      { input }: MutationUpdateCustomerArgs,
      { medusa, session }: GraphQLContext
    ) => {
      try {
        if (!session?.isCustomerLoggedIn && !session?.medusaToken) {
          throw new UnauthorizedError('Unauthorized', {
            description: 'Customer is not logged in',
          });
        }

        const authHeader = session?.medusaToken
          ? { Authorization: `Bearer ${session.medusaToken}` }
          : undefined;

        const { customer } = await medusa.store.customer.update(
          {
            first_name: input.firstName ?? undefined,
            last_name: input.lastName ?? undefined,
            phone: input.phone ?? undefined,
          },
          {},
          authHeader
        );

        return transformCustomer(customer);
      } catch (e) {
        handleMedusaError(e, 'run Mutation.updateCustomer', [
          'Mutation',
          'updateCustomer',
        ]);
      }
    },

    addCustomerAddress: async (
      _: unknown,
      { input }: MutationAddCustomerAddressArgs,
      { medusa, session }: GraphQLContext
    ) => {
      try {
        if (!session?.isCustomerLoggedIn && !session?.medusaToken) {
          throw new UnauthorizedError('Unauthorized', {
            description: 'Customer is not logged in',
          });
        }

        const authHeader = session?.medusaToken
          ? { Authorization: `Bearer ${session.medusaToken}` }
          : undefined;

        const { customer } = await medusa.store.customer.createAddress(
          {
            first_name: input.firstName ?? undefined,
            last_name: input.lastName ?? undefined,
            company: input.company ?? undefined,
            address_1: input.address1 ?? undefined,
            address_2: input.address2 ?? undefined,
            city: input.city ?? undefined,
            province: input.province ?? undefined,
            country_code: input.countryCode ?? undefined,
            postal_code: input.postalCode ?? undefined,
            phone: input.phone ?? undefined,
            is_default_billing: input.isDefaultBilling ?? undefined,
            is_default_shipping: input.isDefaultShipping ?? undefined,
          },
          {},
          authHeader
        );

        return transformCustomer(customer);
      } catch (e) {
        handleMedusaError(e, 'run Mutation.addCustomerAddress', [
          'Mutation',
          'addCustomerAddress',
        ]);
      }
    },

    updateCustomerAddress: async (
      _: unknown,
      { id, input }: MutationUpdateCustomerAddressArgs,
      { medusa, session }: GraphQLContext
    ) => {
      try {
        if (!session?.isCustomerLoggedIn && !session?.medusaToken) {
          throw new UnauthorizedError('Unauthorized', {
            description: 'Customer is not logged in',
          });
        }

        const authHeader = session?.medusaToken
          ? { Authorization: `Bearer ${session.medusaToken}` }
          : undefined;

        const { customer } = await medusa.store.customer.updateAddress(
          id,
          {
            first_name: input.firstName ?? undefined,
            last_name: input.lastName ?? undefined,
            company: input.company ?? undefined,
            address_1: input.address1 ?? undefined,
            address_2: input.address2 ?? undefined,
            city: input.city ?? undefined,
            province: input.province ?? undefined,
            country_code: input.countryCode ?? undefined,
            postal_code: input.postalCode ?? undefined,
            phone: input.phone ?? undefined,
          },
          {},
          authHeader
        );

        return transformCustomer(customer);
      } catch (e) {
        handleMedusaError(e, 'run Mutation.updateCustomerAddress', [
          'Mutation',
          'updateCustomerAddress',
        ]);
      }
    },

    deleteCustomerAddress: async (
      _: unknown,
      { id }: MutationDeleteCustomerAddressArgs,
      { medusa, session }: GraphQLContext
    ) => {
      try {
        if (!session?.isCustomerLoggedIn && !session?.medusaToken) {
          throw new UnauthorizedError('Unauthorized', {
            description: 'Customer is not logged in',
          });
        }

        const authHeader = session?.medusaToken
          ? { Authorization: `Bearer ${session.medusaToken}` }
          : undefined;

        const result = await medusa.store.customer.deleteAddress(
          id,
          authHeader
        );

        return { id: result.id, deleted: result.deleted };
      } catch (e) {
        handleMedusaError(e, 'run Mutation.deleteCustomerAddress', [
          'Mutation',
          'deleteCustomerAddress',
        ]);
      }
    },
  },
};
