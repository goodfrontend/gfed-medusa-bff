import { describe, it, expect, afterAll } from 'vitest';
import { createTestServer } from './helpers.js';
import type { ProfileApiResponse } from '../types/profile.js';
import type { ApiResponse } from '../types/common.js';

describe('GET /api/profiles/:deviceId', () => {
  const { server, baseUrl, signalStore } = createTestServer();

  afterAll(() => {
    server.close();
  });

  it('known deviceId returns profile with data', async () => {
    // Add signals for a known device
    signalStore.addSignal({
      type: 'PRODUCT_VIEW',
      payload: { productId: 'p1', name: 'Product 1', category: 'electronics', price: 100 },
      deviceId: 'known-device',
      timestamp: 1000,
    });
    signalStore.addSignal({
      type: 'SEARCH_QUERY',
      payload: { query: 'laptop' },
      deviceId: 'known-device',
      timestamp: 2000,
    });

    const res = await fetch(`${baseUrl}/api/profiles/known-device`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as ProfileApiResponse;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data!.profile.deviceId).toBe('known-device');
    expect(body.data!.profile.categoryAffinity).toBeDefined();
    expect(body.data!.signalCount).toBe(2);
    expect(Array.isArray(body.data!.intentScores)).toBe(true);
    expect(body.data!.intentScores).toHaveLength(4);
  });

  it('unknown deviceId returns default empty profile (not 404)', async () => {
    const res = await fetch(`${baseUrl}/api/profiles/unknown-device`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as ProfileApiResponse;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data!.profile.deviceId).toBe('unknown-device');
    expect(body.data!.profile.categoryAffinity).toEqual({});
    expect(body.data!.profile.engagementLevel).toBe('LOW');
    expect(body.data!.profile.lifecycleStage).toBe('NEW');
    expect(body.data!.signalCount).toBe(0);
  });

  it('returns intentScores array', async () => {
    signalStore.addSignal({
      type: 'PAGE_VIEW',
      payload: { category: 'books' },
      deviceId: 'intent-test',
      timestamp: 1000,
    });

    const res = await fetch(`${baseUrl}/api/profiles/intent-test`);
    const body = (await res.json()) as ProfileApiResponse;

    expect(body.data!.intentScores).toHaveLength(4);
    const intentNames = body.data!.intentScores.map((s) => s.intent);
    expect(intentNames).toContain('buy_now');
    expect(intentNames).toContain('exploring');
    expect(intentNames).toContain('price_shop');
    expect(intentNames).toContain('uncertain');
  });

  it('returns signalCount', async () => {
    signalStore.addSignal({ type: 'PAGE_VIEW', payload: {}, deviceId: 'count-test', timestamp: 1000 });
    signalStore.addSignal({ type: 'PAGE_VIEW', payload: {}, deviceId: 'count-test', timestamp: 2000 });
    signalStore.addSignal({ type: 'PAGE_VIEW', payload: {}, deviceId: 'count-test', timestamp: 3000 });

    const res = await fetch(`${baseUrl}/api/profiles/count-test`);
    const body = (await res.json()) as ProfileApiResponse;

    expect(body.data!.signalCount).toBe(3);
  });

  it('missing deviceId route param returns 404 (route not found)', async () => {
    // /api/profiles without a deviceId should 404
    const res = await fetch(`${baseUrl}/api/profiles/`);
    // Express 5 may or may not match the route with empty param — should be 404
    expect(res.status).toBe(404);

    const body = (await res.json()) as ApiResponse<unknown>;
    expect(body.success).toBe(false);
    expect(body.error!.code).toBe('NOT_FOUND');
  });

  it('profile response has correct shape', async () => {
    signalStore.addSignal({
      type: 'PAGE_VIEW',
      payload: { category: 'shoes' },
      deviceId: 'shape-test',
      timestamp: 1000,
    });

    const res = await fetch(`${baseUrl}/api/profiles/shape-test`);
    const body = (await res.json()) as ProfileApiResponse;

    expect(body.success).toBe(true);
    expect(body.data!.profile).toHaveProperty('deviceId');
    expect(body.data!.profile).toHaveProperty('categoryAffinity');
    expect(body.data!.profile).toHaveProperty('priceSensitivity');
    expect(body.data!.profile).toHaveProperty('intentSignals');
    expect(body.data!.profile).toHaveProperty('engagementLevel');
    expect(body.data!.profile).toHaveProperty('lifecycleStage');
    expect(body.data!.profile).toHaveProperty('firstSeen');
    expect(body.data!.profile).toHaveProperty('lastSeen');
    expect(body.data!.profile).toHaveProperty('sessionCount');
    expect(body.data!.profile).toHaveProperty('searchHistory');
    expect(body.data!.profile).toHaveProperty('cartActivity');
    expect(body.data!.profile).toHaveProperty('hesitationCount');
    expect(body.data!.profile).toHaveProperty('recentProducts');
  });
});
