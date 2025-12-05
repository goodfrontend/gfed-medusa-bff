import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { HealthCheck, createSimpleHealthCheck, checkHttpEndpoint } from './index';

describe('HealthCheck', () => {
  it('should initialize with service name and version', () => {
    const healthCheck = new HealthCheck('test-service', '1.0.0');
    expect(healthCheck).toBeInstanceOf(HealthCheck);
  });

  it('should register health checks', () => {
    const healthCheck = new HealthCheck('test-service');
    const checker = vi.fn().mockResolvedValue({ status: 'healthy' });

    healthCheck.register('test-check', checker);

    expect(() => healthCheck.register('test-check', checker)).not.toThrow();
  });

  it('should execute all registered checks and return healthy status', async () => {
    const healthCheck = new HealthCheck('test-service', '1.0.0');

    healthCheck.register('db', async () => ({ status: 'healthy' }));
    healthCheck.register('cache', async () => ({ status: 'healthy', latency: 50 }));

    const result = await healthCheck.execute();

    expect(result.status).toBe('healthy');
    expect(result.service).toBe('test-service');
    expect(result.version).toBe('1.0.0');
    expect(result.timestamp).toBeDefined();
    expect(result.checks).toEqual({
      db: { status: 'healthy' },
      cache: { status: 'healthy', latency: 50 },
    });
  });

  it('should return unhealthy status if any check is unhealthy', async () => {
    const healthCheck = new HealthCheck('test-service');

    healthCheck.register('db', async () => ({ status: 'healthy' }));
    healthCheck.register('cache', async () => ({
      status: 'unhealthy',
      message: 'Connection failed',
    }));

    const result = await healthCheck.execute();

    expect(result.status).toBe('unhealthy');
    expect(result.checks?.cache).toEqual({
      status: 'unhealthy',
      message: 'Connection failed',
    });
  });

  it('should return degraded status if any check is degraded and none are unhealthy', async () => {
    const healthCheck = new HealthCheck('test-service');

    healthCheck.register('db', async () => ({ status: 'healthy' }));
    healthCheck.register('cache', async () => ({
      status: 'degraded',
      message: 'Slow response',
      latency: 1500,
    }));

    const result = await healthCheck.execute();

    expect(result.status).toBe('degraded');
  });

  it('should prioritize unhealthy over degraded', async () => {
    const healthCheck = new HealthCheck('test-service');

    healthCheck.register('db', async () => ({
      status: 'degraded',
      message: 'Slow',
    }));
    healthCheck.register('cache', async () => ({
      status: 'unhealthy',
      message: 'Down',
    }));

    const result = await healthCheck.execute();

    expect(result.status).toBe('unhealthy');
  });

  it('should handle checker errors', async () => {
    const healthCheck = new HealthCheck('test-service');

    healthCheck.register('db', async () => {
      throw new Error('Database connection failed');
    });

    const result = await healthCheck.execute();

    expect(result.status).toBe('unhealthy');
    expect(result.checks?.db).toEqual({
      status: 'unhealthy',
      message: 'Database connection failed',
    });
  });

  it('should handle non-Error exceptions in checkers', async () => {
    const healthCheck = new HealthCheck('test-service');

    healthCheck.register('db', async () => {
      throw 'String error';
    });

    const result = await healthCheck.execute();

    expect(result.status).toBe('unhealthy');
    expect(result.checks?.db).toEqual({
      status: 'unhealthy',
      message: 'Health check failed',
    });
  });

  it('should return undefined checks when no checks registered', async () => {
    const healthCheck = new HealthCheck('test-service');

    const result = await healthCheck.execute();

    expect(result.status).toBe('healthy');
    expect(result.checks).toBeUndefined();
  });

  describe('getHandler', () => {
    it('should return 200 for healthy status', async () => {
      const healthCheck = new HealthCheck('test-service');
      healthCheck.register('db', async () => ({ status: 'healthy' }));

      const mockReq = {} as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as unknown as Response;

      const handler = healthCheck.getHandler();
      await handler(mockReq, mockRes, vi.fn());

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          service: 'test-service',
        })
      );
    });

    it('should return 503 for unhealthy status', async () => {
      const healthCheck = new HealthCheck('test-service');
      healthCheck.register('db', async () => ({
        status: 'unhealthy',
        message: 'Down',
      }));

      const mockReq = {} as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as unknown as Response;

      const handler = healthCheck.getHandler();
      await handler(mockReq, mockRes, vi.fn());

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
        })
      );
    });

    it('should return 503 for degraded status', async () => {
      const healthCheck = new HealthCheck('test-service');
      healthCheck.register('db', async () => ({
        status: 'degraded',
        message: 'Slow',
      }));

      const mockReq = {} as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as unknown as Response;

      const handler = healthCheck.getHandler();
      await handler(mockReq, mockRes, vi.fn());

      expect(mockRes.status).toHaveBeenCalledWith(503);
    });
  });
});

describe('createSimpleHealthCheck', () => {
  it('should return a handler that always returns healthy', () => {
    const mockReq = {} as Request;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const handler = createSimpleHealthCheck('test-service', '2.0.0');
    handler(mockReq, mockRes, vi.fn());

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'healthy',
        service: 'test-service',
        version: '2.0.0',
        timestamp: expect.any(String),
      })
    );
  });

  it('should work without version', () => {
    const mockReq = {} as Request;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const handler = createSimpleHealthCheck('test-service');
    handler(mockReq, mockRes, vi.fn());

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'healthy',
        service: 'test-service',
        version: undefined,
      })
    );
  });
});

describe('checkHttpEndpoint', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should return healthy for successful fast response', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const promise = checkHttpEndpoint('http://example.com/health');

    vi.advanceTimersByTime(100);
    const result = await promise;

    expect(result.status).toBe('healthy');
    expect(result.latency).toBeDefined();
    expect(result.latency).toBeLessThan(1000);
  });

  it('should return degraded for slow but successful response', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
    };

    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve(mockResponse), 1500);
        })
    );

    const promise = checkHttpEndpoint('http://example.com/health');

    vi.advanceTimersByTime(1500);
    const result = await promise;

    expect(result.status).toBe('degraded');
    expect(result.latency).toBeGreaterThan(1000);
  });

  it('should return unhealthy for non-ok response', async () => {
    const mockResponse = {
      ok: false,
      status: 503,
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const promise = checkHttpEndpoint('http://example.com/health');

    vi.advanceTimersByTime(100);
    const result = await promise;

    expect(result.status).toBe('unhealthy');
    expect(result.message).toBe('HTTP 503');
  });

  it('should return unhealthy on fetch error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const promise = checkHttpEndpoint('http://example.com/health');

    vi.advanceTimersByTime(100);
    const result = await promise;

    expect(result.status).toBe('unhealthy');
    expect(result.message).toBe('Network error');
  });

  it('should handle timeout', async () => {
    global.fetch = vi.fn().mockImplementation(
      ({ signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('The operation was aborted'));
          });
          setTimeout(() => resolve({ ok: true }), 10000);
        })
    );

    const promise = checkHttpEndpoint('http://example.com/health', 1000);

    vi.advanceTimersByTime(1000);
    const result = await promise;

    expect(result.status).toBe('unhealthy');
  });

  it('should use custom timeout', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const promise = checkHttpEndpoint('http://example.com/health', 2000);

    vi.advanceTimersByTime(100);
    await promise;

    expect(fetch).toHaveBeenCalledWith(
      'http://example.com/health',
      expect.objectContaining({
        method: 'GET',
        signal: expect.any(AbortSignal),
      })
    );
  });
});
