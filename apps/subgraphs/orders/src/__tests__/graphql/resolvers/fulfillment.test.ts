import { fulfillmentResolvers } from '@graphql/resolvers/fulfillment';
import { transformShippingOption } from '@graphql/resolvers/fulfillment/util/transforms';
import { GraphQLContext } from '@graphql/types/context';
import Medusa from '@medusajs/js-sdk';
import {
  createMockCalculatedShippingOption,
  createMockShippingOption,
} from '@mocks/shipping';
import {
  calculateShippingOptionErrorHandler,
  shippingOptionsErrorHandler,
} from '@mocks/msw/handlers/fulfillment';
import { server } from '@mocks/msw/node';

const medusa = new Medusa({
  baseUrl: process.env.MEDUSA_API_URL || 'http://localhost:9000',
  apiKey: process.env.MEDUSA_PUBLISHABLE_KEY,
});

describe('Fulfillment Resolvers', () => {
  let testContext: GraphQLContext;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    testContext = { medusa } as unknown as GraphQLContext;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Query.shippingOptions', () => {
    it('should return shipping options for a cart', async () => {
      const mockOption = createMockShippingOption();
      const result = await fulfillmentResolvers.Query.shippingOptions(
        {},
        { cartId: 'cart_123' },
        testContext
      );
      expect(result).toEqual([transformShippingOption(mockOption)]);
    });

    it('should throw on server error', async () => {
      server.use(shippingOptionsErrorHandler);
      await expect(
        fulfillmentResolvers.Query.shippingOptions({}, { cartId: 'cart_123' }, testContext)
      ).rejects.toThrow();
    });
  });

  describe('Mutation.calculateShippingOptionPrice', () => {
    it('should return the calculated shipping option', async () => {
      const mockOption = createMockCalculatedShippingOption();
      const result = await fulfillmentResolvers.Mutation.calculateShippingOptionPrice(
        {},
        { optionId: 'so_456', cartId: 'cart_123' },
        testContext
      );
      expect(result).toEqual(transformShippingOption(mockOption));
    });

    it('should pass data parameter to Medusa', async () => {
      const result = await fulfillmentResolvers.Mutation.calculateShippingOptionPrice(
        {},
        { optionId: 'so_456', cartId: 'cart_123', data: { custom_field: 'value' } },
        testContext
      );
      expect(result).toBeDefined();
      expect(result?.id).toBe('so_456');
    });

    it('should throw on server error', async () => {
      server.use(calculateShippingOptionErrorHandler);
      await expect(
        fulfillmentResolvers.Mutation.calculateShippingOptionPrice(
          {},
          { optionId: 'so_456', cartId: 'cart_123' },
          testContext
        )
      ).rejects.toThrow();
    });
  });
});
