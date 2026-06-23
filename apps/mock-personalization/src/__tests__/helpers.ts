import { createApp } from '../app.js';
import { SignalStore } from '../store/signal-store.js';
import { ProfileStore } from '../store/profile-store.js';
import type { Server } from 'http';

export function createTestServer(): {
  app: ReturnType<typeof createApp>;
  signalStore: SignalStore;
  profileStore: ProfileStore;
  server: Server;
  baseUrl: string;
} {
  const signalStore = new SignalStore();
  const profileStore = new ProfileStore(signalStore);
  const app = createApp(signalStore, profileStore);
  const server = app.listen(0);
  const addr = server.address() as { address: string; family: string; port: number };
  const baseUrl = `http://localhost:${addr.port}`;
  return { app, signalStore, profileStore, server, baseUrl };
}
