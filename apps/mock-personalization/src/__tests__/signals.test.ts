import { describe, it, expect, afterAll } from 'vitest';
import { createTestServer } from './helpers.js';
import type { SignalApiResponse } from '../types/signals.js';
import type { PersonalizeApiResponse } from '../types/personalization.js';
import type { ApiResponse } from '../types/common.js';

describe('POST /api/signals', () => {
  const { server, baseUrl } = createTestServer();

  afterAll(() => {
    server.close();
  });

  const validSignal = {
    type: 'PAGE_VIEW',
    payload: { category: 'electronics' },
    deviceId: 'device-signal-1',
    page: '/electronics',
  };

  it('happy path: valid signal returns 200 with success and signalId', async () => {
    const res = await fetch(`${baseUrl}/api/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validSignal),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as SignalApiResponse;

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data!.success).toBe(true);
    expect(body.data!.signalId).toBeDefined();
    expect(typeof body.data!.signalId).toBe('string');
    expect(body.data!.processedAt).toBeDefined();
    expect(() => new Date(body.data!.processedAt)).not.toThrow();
  });

  it('missing deviceId returns 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/api/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'PAGE_VIEW', payload: {} }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse<unknown>;
    expect(body.success).toBe(false);
    expect(body.error!.code).toBe('VALIDATION_ERROR');
    expect(body.error!.message).toContain('deviceId');
  });

  it('empty deviceId returns 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/api/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'PAGE_VIEW', payload: {}, deviceId: '' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse<unknown>;
    expect(body.success).toBe(false);
    expect(body.error!.code).toBe('VALIDATION_ERROR');
  });

  it('invalid signal type returns 400 with valid types listed', async () => {
    const res = await fetch(`${baseUrl}/api/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'NOT_A_REAL_TYPE', payload: {}, deviceId: 'device-1' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse<unknown>;
    expect(body.success).toBe(false);
    expect(body.error!.code).toBe('VALIDATION_ERROR');
    const errorBody = body.error!;
    expect(errorBody.details).toBeDefined();
    const details = errorBody!.details as Record<string, unknown>;
    expect(details!.validTypes).toBeDefined();
    expect(Array.isArray(details!.validTypes)).toBe(true);
    // Should include known types like PAGE_VIEW
    expect(details!.validTypes).toContain('PAGE_VIEW');
  });

  it('missing type returns 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/api/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: {}, deviceId: 'device-1' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse<unknown>;
    expect(body.success).toBe(false);
    expect(body.error!.code).toBe('VALIDATION_ERROR');
  });

  it('extra fields are accepted (forward compatibility)', async () => {
    const res = await fetch(`${baseUrl}/api/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validSignal,
        unknownField: 'should-be-accepted',
        anotherUnknown: 123,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as SignalApiResponse;
    expect(body.success).toBe(true);
  });

  it('signals are stored per deviceId', async () => {
    const deviceId = 'device-storage-test';

    // Send 2 signals for same device
    await fetch(`${baseUrl}/api/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'PAGE_VIEW', payload: { category: 'books' }, deviceId }),
    });

    await fetch(`${baseUrl}/api/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'CART_ADD', payload: { productId: 'book-1' }, deviceId }),
    });

    // Get a personalized decision that should reflect both signals
    const personalizeRes = await fetch(`${baseUrl}/api/personalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, surface: 'home', page: '/' }),
    });

    expect(personalizeRes.status).toBe(200);
    const personalizeBody = (await personalizeRes.json()) as PersonalizeApiResponse;
    // Should not be cold start (signals exist)
    expect(personalizeBody.data!.reasoning.factors).not.toContain('Cold start — no profile data');
  });

  it('malformed JSON body returns 400 INVALID_JSON', async () => {
    const res = await fetch(`${baseUrl}/api/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json',
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse<unknown>;
    expect(body.success).toBe(false);
    expect(body.error!.code).toBe('INVALID_JSON');
  });

  it('non-object body returns 400 INVALID_JSON', async () => {
    const res = await fetch(`${baseUrl}/api/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify('just a string'),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse<unknown>;
    expect(body.success).toBe(false);
    expect(body.error!.code).toBe('INVALID_JSON');
  });

  it('array body returns 400 INVALID_JSON', async () => {
    const res = await fetch(`${baseUrl}/api/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ type: 'PAGE_VIEW' }]),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse<unknown>;
    expect(body.success).toBe(false);
    expect(body.error!.code).toBe('INVALID_JSON');
  });

  it('handles all valid signal types', async () => {
    const validTypes = [
      'PAGE_VIEW', 'PRODUCT_VIEW', 'PRODUCT_HOVER', 'QUICK_VIEW_OPEN',
      'IMAGE_ZOOM', 'REVIEWS_VIEW', 'SIZE_GUIDE_VIEW', 'SEARCH_QUERY',
      'SEARCH_RESULT_CLICK', 'FILTER_APPLIED', 'SORT_CHANGED', 'CART_ADD',
      'CART_REMOVE', 'CHECKOUT_START', 'CHECKOUT_ABANDON',
    ];

    for (const type of validTypes) {
      const res = await fetch(`${baseUrl}/api/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload: {}, deviceId: 'type-test' }),
      });
      expect(res.status).toBe(200);
    }
  });
});
