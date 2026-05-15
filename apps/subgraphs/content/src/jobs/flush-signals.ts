import {
  KEY_NS,
  getPersonalizationRedis,
} from '../config/personalization-redis';
import { signalProcessor } from '../services/personalization/signal-ingestion';

const FLUSH_INTERVAL_MS = 30_000;
const BATCH_SIZE = 50;

/**
 * Periodically flushes per-device signal queues to Medusa.
 * Uses `signal-queue:index` to avoid scanning all Redis keys.
 */
export function startFlushSignalsJob(): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const redis = await getPersonalizationRedis();
      const indexKey = `${KEY_NS}signal-queue:index`;
      const deviceIds: string[] = [];

      for (let i = 0; i < BATCH_SIZE; i++) {
        const id = await redis.sPop(indexKey);
        if (!id) {
          break;
        }
        deviceIds.push(id);
      }

      if (deviceIds.length === 0) {
        return;
      }

      let totalFlushed = 0;
      for (const deviceId of deviceIds) {
        try {
          const count = await signalProcessor.flushQueue(deviceId);
          totalFlushed += count;
        } catch (err) {
          console.error(
            `[FlushSignals] Flush failed for ${deviceId}, re-queuing:`,
            err
          );
          await redis.sAdd(indexKey, deviceId);
        }
      }

      if (totalFlushed > 0) {
        console.log(
          `[FlushSignals] Flushed ${totalFlushed} signals for ${deviceIds.length} device(s)`
        );
      }
    } catch (err) {
      console.error('[FlushSignals] Error:', err);
    }
  }, FLUSH_INTERVAL_MS);
}
