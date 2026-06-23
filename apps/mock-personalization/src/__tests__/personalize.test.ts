import { describe, it, expect, afterAll } from 'vitest';
import { createTestServer } from './helpers.js';
import type { PersonalizeApiResponse } from '../types/personalization.js';
import type { ApiResponse } from '../types/common.js';

describe('POST /api/personalize', () => {
  const { server, baseUrl } = createTestServer();

  afterAll(() => {
    server.close();
  });

  const validRequest = {
    deviceId: 'device-personalize-1',
    surface: 'home',
    page: '/',
  };

  it('happy path: valid request returns 200 with components array', async () => {
    const res = await fetch(`${baseUrl}/api/personalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validRequest),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as PersonalizeApiResponse;

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data!.components)).toBe(true);
    expect(body.data!.components.length).toBeGreaterThan(0);

    // Each component should have required fields
    for (const comp of body.data!.components) {
      expect(comp).toHaveProperty('component');
      expect(comp).toHaveProperty('contentId');
      expect(comp).toHaveProperty('priority');
      expect(comp).toHaveProperty('propsOverrides');
      expect(comp).toHaveProperty('reasoning');
      expect(comp).toHaveProperty('score');
    }
  });

  it('unknown deviceId returns 200 with cold-start decision (not 404)', async () => {
    const res = await fetch(`${baseUrl}/api/personalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'brand-new-device', surface: 'home', page: '/' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as PersonalizeApiResponse;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    // Cold start returns HeroBanner (no profile data)
    expect(body.data!.components[0]!.component).toBe('HeroBanner');
    expect(body.data!.reasoning.factors).toContain('Cold start — no profile data');
  });

  it('missing deviceId returns 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/api/personalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surface: 'home', page: '/' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse<unknown>;
    expect(body.success).toBe(false);
    expect(body.error!.code).toBe('VALIDATION_ERROR');
    expect(body.error!.message).toContain('deviceId');
  });

  it('empty deviceId returns 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/api/personalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: '', surface: 'home', page: '/' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse<unknown>;
    expect(body.success).toBe(false);
    expect(body.error!.code).toBe('VALIDATION_ERROR');
  });

  it('deterministic: same request twice returns same components and cacheKey', async () => {
    const request = { deviceId: 'det-test', surface: 'home', page: '/' };

    const res1 = await fetch(`${baseUrl}/api/personalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    const res2 = await fetch(`${baseUrl}/api/personalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const body1 = (await res1.json()) as PersonalizeApiResponse;
    const body2 = (await res2.json()) as PersonalizeApiResponse;

    // Components and cacheKey should be identical
    expect(body1.data!.components).toEqual(body2.data!.components);
    expect(body1.data!.cacheKey).toBe(body2.data!.cacheKey);
    expect(body1.data!.reasoning).toEqual(body2.data!.reasoning);
  });

  it('surface defaults to "home" if missing', async () => {
    const res = await fetch(`${baseUrl}/api/personalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'default-surface', page: '/' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as PersonalizeApiResponse;
    expect(body.data!.cacheKey).toContain(':home');
  });

  it('page defaults to "/" if missing', async () => {
    const res = await fetch(`${baseUrl}/api/personalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'default-page', surface: 'home' }),
    });

    expect(res.status).toBe(200);
  });

  it('response has all required fields', async () => {
    const res = await fetch(`${baseUrl}/api/personalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validRequest),
    });

    const body = (await res.json()) as PersonalizeApiResponse;
    const data = body.data!;

    expect(data).toHaveProperty('requestId');
    expect(typeof data.requestId).toBe('string');

    expect(data).toHaveProperty('components');
    expect(Array.isArray(data.components)).toBe(true);

    expect(data).toHaveProperty('reasoning');
    expect(data.reasoning).toHaveProperty('intent');
    expect(data.reasoning).toHaveProperty('confidence');
    expect(data.reasoning).toHaveProperty('factors');
    expect(Array.isArray(data.reasoning.factors)).toBe(true);
    expect(data.reasoning).toHaveProperty('modelVersion');

    expect(data).toHaveProperty('cacheKey');
    expect(typeof data.cacheKey).toBe('string');

    expect(data).toHaveProperty('servedAt');
    expect(typeof data.servedAt).toBe('string');
    expect(() => new Date(data.servedAt)).not.toThrow();
  });

  it('non-object body returns 400 INVALID_JSON', async () => {
    const res = await fetch(`${baseUrl}/api/personalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify('not-an-object'),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse<unknown>;
    expect(body.success).toBe(false);
    expect(body.error!.code).toBe('INVALID_JSON');
  });

  it('malformed JSON body returns 400 INVALID_JSON', async () => {
    const res = await fetch(`${baseUrl}/api/personalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{{ broken',
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse<unknown>;
    expect(body.success).toBe(false);
    expect(body.error!.code).toBe('INVALID_JSON');
  });

  it('components have priority ordering (1 = highest)', async () => {
    const res = await fetch(`${baseUrl}/api/personalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validRequest),
    });

    const body = (await res.json()) as PersonalizeApiResponse;
    const components = body.data!.components;

    for (let i = 1; i < components.length; i++) {
      expect(components[i]!.priority).toBeGreaterThan(components[i - 1]!.priority);
    }
  });
});
