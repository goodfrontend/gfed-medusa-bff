import { describe, it, expect, afterAll } from 'vitest';
import { createTestServer } from './helpers.js';

describe('API documentation endpoints', () => {
  const { server, baseUrl } = createTestServer();

  afterAll(() => {
    server.close();
  });

  it('GET /api/openapi.json returns 200 with valid JSON', async () => {
    const res = await fetch(`${baseUrl}/api/openapi.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const body = await res.json();
    expect(body).toBeDefined();
    expect(typeof body).toBe('object');
  });

  it('response has openapi, info, and paths fields', async () => {
    const res = await fetch(`${baseUrl}/api/openapi.json`);
    const body = await res.json() as Record<string, unknown>;

    expect(body).toHaveProperty('openapi');
    expect(typeof body.openapi).toBe('string');
    expect(body).toHaveProperty('info');
    expect(body).toHaveProperty('paths');
  });

  it('info.title contains "Mock Personalization"', async () => {
    const res = await fetch(`${baseUrl}/api/openapi.json`);
    const body = await res.json() as { info: { title: string } };

    expect(body.info.title).toBe('Mock Personalization');
  });

  it('paths documents all 3 endpoints', async () => {
    const res = await fetch(`${baseUrl}/api/openapi.json`);
    const body = await res.json() as { paths: Record<string, unknown> };

    expect(body.paths).toHaveProperty('/api/signals');
    expect(body.paths).toHaveProperty('/api/personalize');
    expect(body.paths).toHaveProperty('/api/profiles/{deviceId}');
  });

  it('GET /api/docs returns 200 with text/html content type', async () => {
    const res = await fetch(`${baseUrl}/api/docs`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
  });
});
