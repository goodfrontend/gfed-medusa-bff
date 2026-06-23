import type { Signal, SignalType } from '../types/signals.js';

/**
 * In-memory signal accumulator.
 * Stores signals by deviceId, with a maximum cap per device.
 * Not a singleton — instantiated by routes for testability.
 */
export class SignalStore {
  private signals: Map<string, Signal[]> = new Map();
  private static MAX_SIGNALS_PER_DEVICE = 10_000;
  private signalCounter = 0;

  /**
   * Add a signal and return its generated ID.
   * Signals are stored with deviceId as key. If the device exceeds the max
   * signal count, the oldest signals are dropped.
   */
  addSignal(params: {
    type: SignalType;
    payload: Record<string, unknown>;
    deviceId: string;
    userId?: string;
    url?: string;
    timestamp?: number;
    page?: string;
  }): string {
    const id = `sig_${Date.now()}_${this.signalCounter++}`;
    const signal: Signal = {
      id,
      type: params.type,
      payload: params.payload,
      deviceId: params.deviceId,
      userId: params.userId,
      url: params.url,
      timestamp: params.timestamp ?? Date.now(),
      page: params.page,
      processedAt: new Date().toISOString(),
    };

    const existing = this.signals.get(params.deviceId) ?? [];
    existing.push(signal);

    if (existing.length > SignalStore.MAX_SIGNALS_PER_DEVICE) {
      existing.splice(0, existing.length - SignalStore.MAX_SIGNALS_PER_DEVICE);
    }

    this.signals.set(params.deviceId, existing);
    return id;
  }

  /**
   * Get all signals for a device, newest first.
   * Returns an empty array if the deviceId is unknown.
   */
  getSignals(deviceId: string): Signal[] {
    const existing = this.signals.get(deviceId);
    if (!existing) {
      return [];
    }
    return [...existing].reverse();
  }

  /**
   * Get the number of signals stored for a device.
   * Returns 0 if the deviceId is unknown.
   */
  getSignalCount(deviceId: string): number {
    return this.signals.get(deviceId)?.length ?? 0;
  }

  /** Clear all stored signals and reset the counter. Useful for testing. */
  clear(): void {
    this.signals.clear();
    this.signalCounter = 0;
  }
}
