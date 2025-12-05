import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ServiceUnavailableError,
  createErrorHandler,
  asyncHandler,
} from './index';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with correct properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR', { field: 'test' });

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ field: 'test' });
      expect(error.isOperational).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should use default values', () => {
      const error = new AppError('Test error');

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.details).toBeUndefined();
    });

    it('should allow non-operational errors', () => {
      const error = new AppError('Critical error', 500, 'CRITICAL', undefined, false);

      expect(error.isOperational).toBe(false);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with correct defaults', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should include details', () => {
      const error = new ValidationError('Invalid email', { field: 'email' });

      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with default message', () => {
      const error = new NotFoundError();

      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should use custom message and details', () => {
      const error = new NotFoundError('Product not found', { productId: '123' });

      expect(error.message).toBe('Product not found');
      expect(error.details).toEqual({ productId: '123' });
    });
  });

  describe('UnauthorizedError', () => {
    it('should create unauthorized error with default message', () => {
      const error = new UnauthorizedError();

      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('ForbiddenError', () => {
    it('should create forbidden error with default message', () => {
      const error = new ForbiddenError();

      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error', () => {
      const error = new ConflictError('Resource already exists');

      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create service unavailable error with default message', () => {
      const error = new ServiceUnavailableError();

      expect(error.message).toBe('Service unavailable');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });
});

describe('createErrorHandler', () => {
  let mockLogger: any;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockLogger = {
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockReq = {
      path: '/test',
      method: 'GET',
    };

    mockRes = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  it('should handle AppError and return correct response', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const errorHandler = createErrorHandler(mockLogger);
    const error = new ValidationError('Invalid input', { field: 'email' });

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'email' },
      },
    });
    expect(mockLogger.warn).toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it('should handle non-operational AppError and log as error', () => {
    const errorHandler = createErrorHandler(mockLogger);
    const error = new AppError('Critical error', 500, 'CRITICAL', undefined, false);

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should handle generic Error', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const errorHandler = createErrorHandler(mockLogger);
    const error = new Error('Something went wrong');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
    expect(mockLogger.error).toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it('should not handle if headers already sent', () => {
    const errorHandler = createErrorHandler(mockLogger);
    mockRes.headersSent = true;
    const error = new Error('Test error');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should include stack trace in non-production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const errorHandler = createErrorHandler(mockLogger);
    const error = new Error('Test error');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          stack: expect.any(String),
        }),
      })
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should not include stack trace in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const errorHandler = createErrorHandler(mockLogger);
    const error = new Error('Test error');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    const jsonCall = (mockRes.json as any).mock.calls[0][0];
    expect(jsonCall.error.stack).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });
});

describe('asyncHandler', () => {
  it('should handle successful async function', async () => {
    const mockReq = {} as Request;
    const mockRes = {} as Response;
    const mockNext = vi.fn();

    const asyncFn = vi.fn().mockResolvedValue('success');
    const handler = asyncHandler(asyncFn);

    handler(mockReq, mockRes, mockNext);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should catch rejected promise and call next', async () => {
    const mockReq = {} as Request;
    const mockRes = {} as Response;
    const mockNext = vi.fn();
    const error = new Error('Async error');

    const asyncFn = vi.fn().mockRejectedValue(error);
    const handler = asyncHandler(asyncFn);

    handler(mockReq, mockRes, mockNext);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should catch thrown error and call next', async () => {
    const mockReq = {} as Request;
    const mockRes = {} as Response;
    const mockNext = vi.fn();
    const error = new ValidationError('Invalid data');

    const asyncFn = vi.fn().mockImplementation(async () => {
      throw error;
    });
    const handler = asyncHandler(asyncFn);

    handler(mockReq, mockRes, mockNext);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockNext).toHaveBeenCalledWith(error);
  });
});
