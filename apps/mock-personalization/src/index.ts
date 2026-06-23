import { config } from './config.js';
import { SignalStore } from './store/signal-store.js';
import { ProfileStore } from './store/profile-store.js';
import { createApp } from './app.js';

const signalStore = new SignalStore();
const profileStore = new ProfileStore(signalStore);
const app = createApp(signalStore, profileStore);

app.listen(config.port, () => {
  console.log(`${config.serviceName} v${config.serviceVersion} listening on port ${config.port}`);
});
