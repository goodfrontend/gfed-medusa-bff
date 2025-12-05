import type { Request, Response, RequestHandler } from 'express';
import type { HealthCheckResult } from '../types.js';

export type HealthChecker = () => Promise<{
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  latency?: number;
}>;

export class HealthCheck {
  private checks: Map<string, HealthChecker> = new Map();
  private serviceName: string;
  private version?: string;

  constructor(serviceName: string, version?: string) {
    this.serviceName = serviceName;
    this.version = version;
  }

  public register(name: string, checker: HealthChecker): void {
    this.checks.set(name, checker);
  }

  public async execute(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const checks: HealthCheckResult['checks'] = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    for (const [name, checker] of this.checks) {
      try {
        const result = await checker();
        checks[name] = result;

        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        checks[name] = {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Health check failed',
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      timestamp,
      service: this.serviceName,
      version: this.version,
      checks: Object.keys(checks).length > 0 ? checks : undefined,
    };
  }

  public getHandler(): RequestHandler {
    return async (req: Request, res: Response): Promise<void> => {
      const result = await this.execute();
      const statusCode = result.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(result);
    };
  }
}

export function createSimpleHealthCheck(serviceName: string, version?: string): RequestHandler {
  return (req: Request, res: Response): void => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: serviceName,
      version,
    });
  };
}

export async function checkHttpEndpoint(
  url: string,
  timeout: number = 5000
): Promise<{
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  latency?: number;
}> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - start;

    if (response.ok) {
      return {
        status: latency > 1000 ? 'degraded' : 'healthy',
        latency,
      };
    }

    return {
      status: 'unhealthy',
      message: `HTTP ${response.status}`,
      latency,
    };
  } catch (error) {
    const latency = Date.now() - start;
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Request failed',
      latency,
    };
  }
}
