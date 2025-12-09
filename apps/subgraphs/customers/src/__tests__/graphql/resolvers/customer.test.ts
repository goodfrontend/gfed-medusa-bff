import { customerResolvers } from '@graphql/resolvers';
import { transformCustomer } from '@graphql/resolvers/util/transforms';
import { GraphQLContext } from '@graphql/types/context';
import Medusa from '@medusajs/js-sdk';
import { createMockCustomer, mockLoginToken } from '@mocks/customer';
import {
  internalServerErrorHandler,
  invalidLoginHandler,
} from '@mocks/msw/handlers/customer';
import { server } from '@mocks/msw/node';

const medusa = new Medusa({
  baseUrl: process.env.MEDUSA_API_URL || 'http://localhost:9000',
  apiKey: process.env.MEDUSA_PUBLISHABLE_KEY,
});

const mockSession = {
  medusaToken: mockLoginToken,
  isCustomerLoggedIn: true,
  save: jest.fn((cb) => cb()),
  destroy: jest.fn((cb) => cb()),
};

const mockRes = {
  clearCookie: jest.fn(),
};

describe('Customer Resolvers', () => {
  let testContext: GraphQLContext;

  beforeEach(() => {
    jest.clearAllMocks();

    testContext = {
      res: mockRes,
      session: mockSession,
      medusa,
    } as unknown as GraphQLContext;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Query.me', () => {
    it('should retrieve the current customer successfully', async () => {
      const mockCustomer = createMockCustomer();

      const result = await customerResolvers.Query.me({}, {}, testContext);

      expect(result).toEqual(transformCustomer(mockCustomer));
    });

    it('should handle errors when retrieving customer', async () => {
      server.use(internalServerErrorHandler);

      await expect(
        customerResolvers.Query.me({}, {}, testContext)
      ).rejects.toThrow();
    });
  });

  describe('Mutation.login', () => {
    const loginArgs = {
      email: 'john@example.com',
      password: 'password123',
    };

    it('should login customer successfully', async () => {
      const result = await customerResolvers.Mutation.login(
        {},
        loginArgs,
        testContext
      );

      expect(result).toEqual({
        token: mockLoginToken,
        isCustomerLoggedIn: true,
      });
    });

    it('should handle failed login attempts and login errors', async () => {
      server.use(invalidLoginHandler);

      await expect(
        customerResolvers.Mutation.login({}, loginArgs, testContext)
      ).rejects.toThrow();
    });
  });

  describe('Mutation.logout', () => {
    it('should logout customer successfully', async () => {
      const result = await customerResolvers.Mutation.logout(
        {},
        {},
        testContext
      );

      expect(result).toEqual({ success: true });
    });
  });
});
