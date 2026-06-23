import { describe, it, expect, afterAll } from 'vitest';
import { createTestServer } from './helpers.js';
import type { SignalApiResponse, SignalResponse, SignalType } from '../types/signals.js';
import type { PersonalizeApiResponse, PersonalizeResponse } from '../types/personalization.js';
import type { ProfileApiResponse, ProfileDebugResponse } from '../types/profile.js';

describe('Contract shape validation', () => {
  const { server, baseUrl, signalStore } = createTestServer();

  afterAll(() => {
    server.close();
  });

  describe('Signal response shape', () => {
    it('matches SignalRequest → SignalApiResponse shape at runtime', async () => {
      const res = await fetch(`${baseUrl}/api/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PAGE_VIEW' satisfies SignalType,
          payload: { category: 'books' },
          deviceId: 'shape-device',
          userId: 'user-123',
          url: 'https://example.com/books',
          page: '/books',
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as SignalApiResponse;

      // ApiResponse wrapper shape
      expect(body).toHaveProperty('success');
      expect(typeof body.success).toBe('boolean');

      // SignalResponse data shape
      expect(body.data).toBeDefined();
      if (body.data) {
        assertSignalResponse(body.data);
      }
    });

    it('signalId is a non-empty string', async () => {
      const res = await fetch(`${baseUrl}/api/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PAGE_VIEW', payload: {}, deviceId: 'sig-id-test' }),
      });

      const body = (await res.json()) as SignalApiResponse;
      expect(body.data!.signalId).toBeDefined();
      expect(typeof body.data!.signalId).toBe('string');
      expect(body.data!.signalId.length).toBeGreaterThan(0);
    });

    it('processedAt is a valid ISO-8601 string', async () => {
      const res = await fetch(`${baseUrl}/api/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PAGE_VIEW', payload: {}, deviceId: 'iso-test' }),
      });

      const body = (await res.json()) as SignalApiResponse;
      expect(body.data!.processedAt).toBeDefined();
      const parsed = new Date(body.data!.processedAt);
      expect(parsed.toISOString()).toBe(body.data!.processedAt);
    });
  });

  describe('Personalize response shape', () => {
    it('matches PersonalizeResponse type at runtime', async () => {
      const res = await fetch(`${baseUrl}/api/personalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'contract-device',
          surface: 'home',
          page: '/',
          userId: 'user-456',
          productId: 'prod-123',
          category: 'electronics',
          price: 99.99,
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as PersonalizeApiResponse;

      // ApiResponse wrapper
      expect(body).toHaveProperty('success');
      expect(body.success).toBe(true);

      // PersonalizeResponse data
      assertPersonalizeResponse(body.data);
    });

    it('cacheKey has correct format', async () => {
      const res = await fetch(`${baseUrl}/api/personalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'cache-key-test',
          surface: 'product',
          page: '/product/shoes',
        }),
      });

      const body = (await res.json()) as PersonalizeApiResponse;
      expect(body.data!.cacheKey).toMatch(/^personalization:[^:]+:[^:]+$/);
    });

    it('reasoning has all required fields', async () => {
      const res = await fetch(`${baseUrl}/api/personalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'reasoning-test', surface: 'home', page: '/' }),
      });

      const body = (await res.json()) as PersonalizeApiResponse;
      const reasoning = body.data!.reasoning;

      expect(reasoning).toHaveProperty('intent');
      expect(typeof reasoning.intent).toBe('string');
      expect(['buy_now', 'exploring', 'price_shop', 'uncertain']).toContain(reasoning.intent);

      expect(reasoning).toHaveProperty('confidence');
      expect(typeof reasoning.confidence).toBe('number');
      expect(reasoning.confidence).toBeGreaterThanOrEqual(0);

      expect(reasoning).toHaveProperty('factors');
      expect(Array.isArray(reasoning.factors)).toBe(true);
      expect(reasoning.factors.length).toBeGreaterThan(0);

      expect(reasoning).toHaveProperty('modelVersion');
      expect(reasoning.modelVersion).toBe('mock-v0');
    });
  });

  describe('Profile response shape', () => {
    it('matches ProfileDebugResponse type at runtime', async () => {
      // Pre-populate some signals
      signalStore.addSignal({
        type: 'PRODUCT_VIEW',
        payload: { productId: 'p1', name: 'Test', category: 'test-cat' },
        deviceId: 'profile-shape-test',
        timestamp: 1000,
      });

      const res = await fetch(`${baseUrl}/api/profiles/profile-shape-test`);
      expect(res.status).toBe(200);

      const body = (await res.json()) as ProfileApiResponse;
      expect(body).toHaveProperty('success');
      expect(body.success).toBe(true);

      assertProfileDebugResponse(body.data);
    });
  });

  describe('Error response shape', () => {
    it('all error responses have { success: false, error: { code, message } } shape', async () => {
      // VALIDATION_ERROR — missing deviceId
      const res1 = await fetch(`${baseUrl}/api/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PAGE_VIEW', payload: {} }),
      });
      assertErrorShape(await res1.json(), 'VALIDATION_ERROR');

      // INVALID_JSON — malformed body
      const res2 = await fetch(`${baseUrl}/api/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      });
      assertErrorShape(await res2.json(), 'INVALID_JSON');

      // NOT_FOUND — unknown route
      const res3 = await fetch(`${baseUrl}/api/nonexistent`);
      assertErrorShape(await res3.json(), 'NOT_FOUND');
    });
  });
});

// ──────────────────────────────────────────────
// Assertion helpers
// ──────────────────────────────────────────────

function assertSignalResponse(data: unknown): asserts data is SignalResponse {
  expect(data).toBeDefined();
  expect(data).toHaveProperty('success');
  expect((data as SignalResponse).success).toBe(true);
  expect(data).toHaveProperty('signalId');
  expect(typeof (data as SignalResponse).signalId).toBe('string');
  expect(data).toHaveProperty('processedAt');
  expect(typeof (data as SignalResponse).processedAt).toBe('string');
}

function assertPersonalizeResponse(data: unknown): asserts data is PersonalizeResponse {
  expect(data).toBeDefined();

  expect(data).toHaveProperty('requestId');
  expect(typeof (data as PersonalizeResponse).requestId).toBe('string');

  expect(data).toHaveProperty('components');
  expect(Array.isArray((data as PersonalizeResponse).components)).toBe(true);

  expect(data).toHaveProperty('reasoning');
  expect((data as PersonalizeResponse).reasoning).toHaveProperty('intent');
  expect((data as PersonalizeResponse).reasoning).toHaveProperty('confidence');
  expect((data as PersonalizeResponse).reasoning).toHaveProperty('factors');
  expect((data as PersonalizeResponse).reasoning).toHaveProperty('modelVersion');

  expect(data).toHaveProperty('cacheKey');
  expect(typeof (data as PersonalizeResponse).cacheKey).toBe('string');

  expect(data).toHaveProperty('servedAt');
  expect(typeof (data as PersonalizeResponse).servedAt).toBe('string');
}

function assertProfileDebugResponse(data: unknown): asserts data is ProfileDebugResponse {
  expect(data).toBeDefined();

  expect(data).toHaveProperty('profile');
  expect((data as ProfileDebugResponse).profile).toHaveProperty('deviceId');
  expect((data as ProfileDebugResponse).profile).toHaveProperty('categoryAffinity');
  expect((data as ProfileDebugResponse).profile).toHaveProperty('priceSensitivity');
  expect((data as ProfileDebugResponse).profile).toHaveProperty('intentSignals');
  expect((data as ProfileDebugResponse).profile).toHaveProperty('engagementLevel');
  expect((data as ProfileDebugResponse).profile).toHaveProperty('lifecycleStage');

  expect(data).toHaveProperty('intentScores');
  expect(Array.isArray((data as ProfileDebugResponse).intentScores)).toBe(true);

  expect(data).toHaveProperty('signalCount');
  expect(typeof (data as ProfileDebugResponse).signalCount).toBe('number');
}

function assertErrorShape(body: unknown, expectedCode: string): void {
  const err = body as { success: boolean; error: { code: string; message: string } };
  expect(err).toHaveProperty('success', false);
  expect(err).toHaveProperty('error');
  expect(err.error).toHaveProperty('code', expectedCode);
  expect(err.error).toHaveProperty('message');
  expect(typeof err.error.message).toBe('string');
  expect(err.error.message.length).toBeGreaterThan(0);
}
