import { orderResolvers } from '@graphql/resolvers/order';
import { normalizeOrder } from '@graphql/resolvers/cart/util/transforms';
import { GraphQLContext } from '@graphql/types/context';
import Medusa from '@medusajs/js-sdk';
import { createMockOrder } from '@mocks/order';
import {
  orderNotFoundHandler,
  orderServerErrorHandler,
  transferErrorHandler,
} from '@mocks/msw/handlers/order';
import { server } from '@mocks/msw/node';

const medusa = new Medusa({
  baseUrl: process.env.MEDUSA_API_URL || 'http://localhost:9000',
  apiKey: process.env.MEDUSA_PUBLISHABLE_KEY,
});

describe('Order Resolvers', () => {
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

  describe('Query.order', () => {
    it('should retrieve an order by ID', async () => {
      const mockOrder = createMockOrder();
      const result = await orderResolvers.Query.order(
        {},
        { id: 'order_01JABCDE123456' },
        testContext
      );
      expect(result).toEqual(normalizeOrder(mockOrder));
    });

    it('should throw on order not found', async () => {
      server.use(orderNotFoundHandler);
      await expect(
        orderResolvers.Query.order({}, { id: 'bad_id' }, testContext)
      ).rejects.toThrow();
    });

    it('should throw on server error', async () => {
      server.use(orderServerErrorHandler);
      await expect(
        orderResolvers.Query.order({}, { id: 'order_01JABCDE123456' }, testContext)
      ).rejects.toThrow();
    });
  });

  describe('Query.orders', () => {
    it('should return a paginated list of orders', async () => {
      const mockOrder = createMockOrder();
      const result = await orderResolvers.Query.orders(
        {},
        { limit: 10, offset: 0 },
        testContext
      );
      expect(result).toMatchObject({
        orders: [normalizeOrder(mockOrder)],
        count: 1,
        limit: 10,
        offset: 0,
      });
    });

    it('should work without pagination params', async () => {
      const result = await orderResolvers.Query.orders({}, {}, testContext);
      expect(result).toMatchObject({ count: 1 });
    });
  });

  describe('Mutation.requestOrderTransfer', () => {
    it('should return success with order id and email', async () => {
      const mockOrder = createMockOrder();
      const result = await orderResolvers.Mutation.requestOrderTransfer(
        {},
        { orderId: 'order_01JABCDE123456' },
        testContext
      );
      expect(result).toEqual({
        success: true,
        error: null,
        order: { id: mockOrder.id, email: mockOrder.email },
      });
    });

    it('should throw on transfer request error', async () => {
      server.use(transferErrorHandler);
      await expect(
        orderResolvers.Mutation.requestOrderTransfer(
          {},
          { orderId: 'order_01JABCDE123456' },
          testContext
        )
      ).rejects.toThrow();
    });
  });

  describe('Mutation.acceptOrderTransfer', () => {
    it('should return success with no order data', async () => {
      const result = await orderResolvers.Mutation.acceptOrderTransfer(
        {},
        { orderId: 'order_01JABCDE123456', token: 'tok_abc123' },
        testContext
      );
      expect(result).toEqual({ success: true, error: null, order: null });
    });
  });

  describe('Mutation.declineOrderTransfer', () => {
    it('should return success with no order data', async () => {
      const result = await orderResolvers.Mutation.declineOrderTransfer(
        {},
        { orderId: 'order_01JABCDE123456', token: 'tok_abc123' },
        testContext
      );
      expect(result).toEqual({ success: true, error: null, order: null });
    });
  });
});
