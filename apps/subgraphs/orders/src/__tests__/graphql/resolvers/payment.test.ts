import { paymentResolvers } from '@graphql/resolvers/payment';
import { cartResolvers } from '@graphql/resolvers/cart';
import { normalizeCart } from '@graphql/resolvers/cart/util/transforms';
import { GraphQLContext } from '@graphql/types/context';
import Medusa from '@medusajs/js-sdk';
import { createMockPaymentProviders } from '@mocks/payment';
import { createMockCart } from '@mocks/cart';
import { paymentProvidersErrorHandler } from '@mocks/msw/handlers/payment';
import { server } from '@mocks/msw/node';

const medusa = new Medusa({
  baseUrl: process.env.MEDUSA_API_URL || 'http://localhost:9000',
  apiKey: process.env.MEDUSA_PUBLISHABLE_KEY,
});

describe('Payment Resolvers', () => {
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

  describe('Query.paymentProviders', () => {
    it('should return payment providers sorted by id', async () => {
      const result = await paymentResolvers.Query.paymentProviders(
        {},
        { regionId: 'reg_123' },
        testContext
      );
      const mockProviders = createMockPaymentProviders();
      const expected = mockProviders
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((p) => ({ id: p.id }));
      expect(result).toEqual(expected);
    });

    it('should throw on server error', async () => {
      server.use(paymentProvidersErrorHandler);
      await expect(
        paymentResolvers.Query.paymentProviders({}, { regionId: 'reg_123' }, testContext)
      ).rejects.toThrow();
    });
  });

  describe('Mutation.initiatePaymentSession', () => {
    it('should initiate a payment session and return the updated cart', async () => {
      const mockCart = createMockCart();
      const result = await cartResolvers.Mutation.initiatePaymentSession(
        {},
        { cartId: 'cart_123', providerId: 'pp_stripe_stripe' },
        testContext
      );
      expect(result).toEqual(normalizeCart(mockCart));
    });
  });
});
