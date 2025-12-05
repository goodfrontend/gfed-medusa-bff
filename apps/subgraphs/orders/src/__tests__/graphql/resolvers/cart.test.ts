import { cartResolvers } from '@graphql/resolvers/cart';
import {
  normalizeCart,
  normalizeCompleteCartResponse,
} from '@graphql/resolvers/cart/util/transforms';
import { GraphQLContext } from '@graphql/types/context';
import Medusa from '@medusajs/js-sdk';
import { createMockCart } from '@mocks/cart';
import {
  internalServerErrorHandler,
  invalidCartHandler,
} from '@mocks/msw/handlers/cart';
import { server } from '@mocks/msw/node';
import { createMockOrder } from '@mocks/order';

const mockRes = {
  clearCookie: jest.fn(),
};

const medusa = new Medusa({
  baseUrl: process.env.MEDUSA_API_URL || 'http://localhost:9000',
  apiKey: process.env.MEDUSA_PUBLISHABLE_KEY,
});

describe('Cart Resolvers', () => {
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

    testContext = {
      res: mockRes,
      medusa,
    } as unknown as GraphQLContext;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Query.cart', () => {
    it('should retrieve the cart by ID successfully', async () => {
      const mockCart = createMockCart();
      const result = await cartResolvers.Query.cart(
        {},
        { id: 'cart_123' },
        testContext
      );
      expect(result).toEqual(normalizeCart(mockCart));
    });

    it('should throw on server error', async () => {
      server.use(internalServerErrorHandler);

      await expect(
        cartResolvers.Query.cart({}, { id: 'cart_123' }, testContext)
      ).rejects.toThrow();
    });

    it('should throw on cart not found', async () => {
      server.use(invalidCartHandler);
      await expect(
        cartResolvers.Query.cart({}, { id: 'invalid_cart' }, testContext)
      ).rejects.toThrow();
    });
  });

  describe('Mutation.createCart', () => {
    it('should create a new cart successfully', async () => {
      const result = await cartResolvers.Mutation.createCart(
        {},
        { data: {} },
        testContext
      );

      expect(result).toEqual(normalizeCart(createMockCart()));
    });
  });

  describe('Mutation.addLineItem', () => {
    it('should add a line item to the cart successfully', async () => {
      const result = await cartResolvers.Mutation.createLineItem(
        {},
        {
          cartId: 'cart_123',
          data: {
            quantity: 2,
            variant_id: 'variant_123',
          },
        },
        testContext
      );

      expect(result).toEqual(normalizeCart(createMockCart()));
    });
  });

  describe('Mutation.updateLineItem', () => {
    it('should update a line item in the cart successfully', async () => {
      const result = await cartResolvers.Mutation.updateLineItem(
        {},
        {
          cartId: 'cart_123',
          lineItemId: 'line-item-id',
          data: {
            quantity: 2,
          },
        },
        testContext
      );

      expect(result).toEqual(normalizeCart(createMockCart()));
    });
  });

  describe('Mutation.deleteLineItem', () => {
    it('should delete a line item from the cart successfully', async () => {
      const result = await cartResolvers.Mutation.deleteLineItem(
        {},
        {
          cartId: 'cart_123',
          lineItemId: 'line-item-id',
        },
        testContext
      );

      expect(result).toEqual({
        id: 'line-item-id',
        object: 'line-item-name',
        deleted: true,
      });
    });
  });

  describe('Mutation.addShippingMethod', () => {
    it('should add a shipping method to the cart successfully', async () => {
      const result = await cartResolvers.Mutation.addShippingMethod(
        {},
        {
          cartId: 'cart_123',
          optionId: 'option_123',
        },
        testContext
      );

      expect(result).toEqual(normalizeCart(createMockCart()));
    });
  });

  describe('Mutation.completeCart', () => {
    it('should complete the cart successfully', async () => {
      const result = await cartResolvers.Mutation.completeCart(
        {},
        {
          cartId: 'cart_123',
        },
        testContext
      );

      expect(result).toEqual(
        normalizeCompleteCartResponse({
          type: 'order',
          order: createMockOrder(),
        })
      );
    });
  });

  describe('Mutation.transferCart', () => {
    it('should transfer the cart successfully', async () => {
      const result = await cartResolvers.Mutation.transferCart(
        {},
        {
          cartId: 'cart_123',
        },
        testContext
      );

      expect(result).toEqual(normalizeCart(createMockCart()));
    });
  });

  describe('Mutation.applyPromotions', () => {
    it('should apply promotions to the cart successfully', async () => {
      const result = await cartResolvers.Mutation.applyPromotions(
        {},
        {
          cartId: 'cart_123',
          codes: ['code_123'],
        },
        testContext
      );

      expect(result).toEqual(normalizeCart(createMockCart()));
    });
  });
});
