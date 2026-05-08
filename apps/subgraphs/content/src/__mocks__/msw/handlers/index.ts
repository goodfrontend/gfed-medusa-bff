import { handlers as contextualBannerHandlers } from './contextual-banner';
import { handlers as sanityHandlers } from './footer';
import { handlers as homeBannerHandlers } from './home-banner';

export const handlers = [
  ...homeBannerHandlers,
  ...contextualBannerHandlers,
  ...sanityHandlers,
];
