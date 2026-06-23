import { describe, it, expect, beforeEach } from 'vitest';
import { SignalStore } from '../store/signal-store.js';
import { ProfileStore } from '../store/profile-store.js';

// ──────────────────────────────────────────────
// SignalStore Tests
// ──────────────────────────────────────────────

describe('SignalStore', () => {
  let store: SignalStore;

  beforeEach(() => {
    store = new SignalStore();
  });

  it('addSignal returns a signalId string', () => {
    const id = store.addSignal({
      type: 'PAGE_VIEW',
      payload: {},
      deviceId: 'device-1',
    });
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('stores signals by deviceId', () => {
    store.addSignal({ type: 'PAGE_VIEW', payload: {}, deviceId: 'device-a' });
    store.addSignal({ type: 'PRODUCT_VIEW', payload: { productId: 'p1' }, deviceId: 'device-b' });

    const signalsA = store.getSignals('device-a');
    const signalsB = store.getSignals('device-b');

    expect(signalsA).toHaveLength(1);
    expect(signalsA[0]!.type).toBe('PAGE_VIEW');

    expect(signalsB).toHaveLength(1);
    expect(signalsB[0]!.type).toBe('PRODUCT_VIEW');
  });

  it('getSignals returns signals newest first', () => {
    store.addSignal({ type: 'PAGE_VIEW', payload: { page: 'home' }, deviceId: 'device-1', timestamp: 1000 });
    store.addSignal({ type: 'PAGE_VIEW', payload: { page: 'product' }, deviceId: 'device-1', timestamp: 2000 });
    store.addSignal({ type: 'CART_ADD', payload: {}, deviceId: 'device-1', timestamp: 3000 });

    const signals = store.getSignals('device-1');
    expect(signals).toHaveLength(3);
    // Newest first
    expect(signals[0]!.timestamp).toBe(3000);
    expect(signals[1]!.timestamp).toBe(2000);
    expect(signals[2]!.timestamp).toBe(1000);
  });

  it('getSignalCount returns correct count', () => {
    expect(store.getSignalCount('device-1')).toBe(0);

    store.addSignal({ type: 'PAGE_VIEW', payload: {}, deviceId: 'device-1' });
    expect(store.getSignalCount('device-1')).toBe(1);

    store.addSignal({ type: 'PRODUCT_VIEW', payload: {}, deviceId: 'device-1' });
    store.addSignal({ type: 'CART_ADD', payload: {}, deviceId: 'device-1' });
    expect(store.getSignalCount('device-1')).toBe(3);
  });

  it('unknown deviceId returns empty array from getSignals', () => {
    const signals = store.getSignals('nonexistent-device');
    expect(signals).toEqual([]);
  });

  it('unknown deviceId returns 0 from getSignalCount', () => {
    const count = store.getSignalCount('nonexistent-device');
    expect(count).toBe(0);
  });

  it('enforces max signal cap of 10,000 and drops oldest', () => {
    // Add 10,001 signals for the same device
    for (let i = 0; i < 10_001; i++) {
      store.addSignal({
        type: 'PAGE_VIEW',
        payload: { seq: i },
        deviceId: 'device-cap',
      });
    }

    const count = store.getSignalCount('device-cap');
    expect(count).toBe(10_000);

    // The oldest signal (seq=0) should have been dropped
    const signals = store.getSignals('device-cap');
    const seqs = signals.map((s) => s.payload.seq as number);
    expect(seqs).not.toContain(0);
    // The newest should be present
    expect(seqs).toContain(10_000);
  });

  it('clear() removes all data and resets counter', () => {
    store.addSignal({ type: 'PAGE_VIEW', payload: {}, deviceId: 'device-1' });
    store.addSignal({ type: 'PRODUCT_VIEW', payload: {}, deviceId: 'device-2' });

    expect(store.getSignalCount('device-1')).toBe(1);
    expect(store.getSignalCount('device-2')).toBe(1);

    store.clear();

    expect(store.getSignalCount('device-1')).toBe(0);
    expect(store.getSignalCount('device-2')).toBe(0);
    expect(store.getSignals('device-1')).toEqual([]);
  });
});

// ──────────────────────────────────────────────
// ProfileStore Tests
// ──────────────────────────────────────────────

describe('ProfileStore', () => {
  let signalStore: SignalStore;
  let profileStore: ProfileStore;

  beforeEach(() => {
    signalStore = new SignalStore();
    profileStore = new ProfileStore(signalStore);
  });

  it('unknown deviceId returns default empty profile', () => {
    const profile = profileStore.build('unknown-device');

    expect(profile.deviceId).toBe('unknown-device');
    expect(profile.userId).toBeUndefined();
    expect(profile.categoryAffinity).toEqual({});
    expect(profile.priceSensitivity).toEqual({ score: 0, avgViewedPrice: 0, dealClickRate: 0 });
    expect(profile.intentSignals).toEqual({ researchDepth: 0, checkoutConversion: 0 });
    expect(profile.engagementLevel).toBe('LOW');
    expect(profile.lifecycleStage).toBe('NEW');
    expect(profile.sessionCount).toBe(0);
    expect(profile.orderCount).toBe(0);
    expect(profile.cartActivity).toBe(0);
    expect(profile.hesitationCount).toBe(0);
    expect(profile.searchHistory).toEqual([]);
    expect(profile.recentProducts).toEqual([]);
  });

  it('single PAGE_VIEW creates category affinity', () => {
    signalStore.addSignal({
      type: 'PAGE_VIEW',
      payload: { category: 'electronics' },
      deviceId: 'device-1',
      timestamp: 1000,
    });

    const profile = profileStore.build('device-1');

    expect(profile.categoryAffinity['electronics']).toBeDefined();
    expect(profile.categoryAffinity['electronics']!.views).toBe(1);
    expect(profile.categoryAffinity['electronics']!.score).toBeCloseTo(0.15);
  });

  it('PRODUCT_VIEW adds to recentProducts (max 20)', () => {
    // Add 21 product views
    for (let i = 0; i < 21; i++) {
      signalStore.addSignal({
        type: 'PRODUCT_VIEW',
        payload: { productId: `prod-${i}`, name: `Product ${i}`, category: 'electronics', price: 100 },
        deviceId: 'device-1',
        timestamp: 1000 + i,
      });
    }

    const profile = profileStore.build('device-1');

    expect(profile.recentProducts).toHaveLength(20);
    // Should keep the newest 20 (ids 1..20, since 0 was the oldest and dropped)
    const ids = profile.recentProducts!.map((p) => p.productId);
    expect(ids).not.toContain('prod-0');
    expect(ids).toContain('prod-20');
  });

  it('SEARCH_QUERY increments researchDepth', () => {
    signalStore.addSignal({
      type: 'SEARCH_QUERY',
      payload: { query: 'running shoes' },
      deviceId: 'device-1',
      timestamp: 1000,
    });

    const profile = profileStore.build('device-1');

    expect(profile.intentSignals.researchDepth).toBeCloseTo(0.15);
    expect(profile.searchHistory).toHaveLength(1);
    expect(profile.searchHistory![0]!.query).toBe('running shoes');
  });

  it('CART_ADD increments cartActivity', () => {
    signalStore.addSignal({
      type: 'CART_ADD',
      payload: { productId: 'p1' },
      deviceId: 'device-1',
      timestamp: 1000,
    });
    signalStore.addSignal({
      type: 'CART_ADD',
      payload: { productId: 'p2' },
      deviceId: 'device-1',
      timestamp: 2000,
    });

    const profile = profileStore.build('device-1');

    expect(profile.cartActivity).toBe(2);
  });

  it('CHECKOUT_START increments checkoutConversion', () => {
    signalStore.addSignal({
      type: 'CHECKOUT_START',
      payload: {},
      deviceId: 'device-1',
      timestamp: 1000,
    });

    const profile = profileStore.build('device-1');
    expect(profile.intentSignals.checkoutConversion).toBeCloseTo(0.15);
  });

  it('engagement level is LOW for minimal activity', () => {
    signalStore.addSignal({
      type: 'PAGE_VIEW',
      payload: {},
      deviceId: 'device-1',
      timestamp: 1000,
    });

    const profile = profileStore.build('device-1');
    // 1 session, 0 cartActivity, 0 views (no category extracted since payload has no category)
    expect(profile.engagementLevel).toBe('LOW');
  });

  it('engagement level is HIGH for lots of cart activity', () => {
    // Add 6 CART_ADD signals (cartActivity > 5 → HIGH)
    for (let i = 0; i < 6; i++) {
      signalStore.addSignal({
        type: 'CART_ADD',
        payload: {},
        deviceId: 'device-1',
        timestamp: 1000 + i,
      });
    }

    const profile = profileStore.build('device-1');
    expect(profile.cartActivity).toBe(6);
    expect(profile.engagementLevel).toBe('HIGH');
  });

  it('engagement level is HIGH with many sessions (>10)', () => {
    // Add 12 signals each >30min apart → 12 sessions → sessionCount = 12
    for (let i = 0; i < 12; i++) {
      signalStore.addSignal({
        type: 'PAGE_VIEW',
        payload: { category: 'electronics' },
        deviceId: 'device-1',
        timestamp: 1000 + i * 31 * 60 * 1000, // 31 min apart
      });
    }

    const profile = profileStore.build('device-1');
    // 12 signals with 11 gaps → 12 sessions (gaps + 1 = sessions)
    expect(profile.sessionCount).toBe(12);
    expect(profile.engagementLevel).toBe('HIGH');
  });

  it('detects sessions with >30min gaps between signals', () => {
    // Signal at t=0
    signalStore.addSignal({
      type: 'PAGE_VIEW',
      payload: {},
      deviceId: 'device-1',
      timestamp: 1000,
    });

    // Signal at t=0+31min (gap > 30min)
    signalStore.addSignal({
      type: 'PRODUCT_VIEW',
      payload: { productId: 'p1' },
      deviceId: 'device-1',
      timestamp: 1000 + 31 * 60 * 1000,
    });

    const profile = profileStore.build('device-1');
    // 2 sessions detected (1 gap): sessionCount = 2
    expect(profile.sessionCount).toBe(2);
    expect(profile.currentSession).toBeDefined();
  });

  it('build() with userId sets userId on profile', () => {
    signalStore.addSignal({
      type: 'PAGE_VIEW',
      payload: {},
      deviceId: 'device-1',
      userId: 'user-123',
      timestamp: 1000,
    });

    const profile = profileStore.build('device-1', 'user-123');
    expect(profile.userId).toBe('user-123');
  });

  it('CART_REMOVE decrements cartActivity (min 0)', () => {
    signalStore.addSignal({ type: 'CART_ADD', payload: {}, deviceId: 'device-1', timestamp: 1000 });
    signalStore.addSignal({ type: 'CART_REMOVE', payload: {}, deviceId: 'device-1', timestamp: 2000 });

    const profile = profileStore.build('device-1');
    expect(profile.cartActivity).toBe(0);
  });

  it('CHECKOUT_ABANDON increments hesitationCount', () => {
    signalStore.addSignal({ type: 'CHECKOUT_ABANDON', payload: {}, deviceId: 'device-1', timestamp: 1000 });

    const profile = profileStore.build('device-1');
    expect(profile.hesitationCount).toBe(1);
  });
});
