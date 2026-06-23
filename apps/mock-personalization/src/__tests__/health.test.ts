import { describe, it, expect, afterAll } from 'vitest';
import { createTestServer } from './helpers.js';

interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

describe('Health endpoint', () => {
  const { server, baseUrl } = createTestServer();

  afterAll(() => {
    server.close();
  });

  it('GET /health returns 200 with expected shape', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as HealthResponse;
    expect(body).toHaveProperty('status', 'healthy');
    expect(body).toHaveProperty('service', 'mock-personalization');
    expect(body).toHaveProperty('version', '0.1.0');
    expect(body).toHaveProperty('timestamp');
    // timestamp should be an ISO-8601 string
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp)).not.toThrow();
  });

  it('GET /health returns correct content-type', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});
