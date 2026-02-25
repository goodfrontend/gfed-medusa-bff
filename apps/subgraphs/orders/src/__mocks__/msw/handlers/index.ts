import { handlers as cartHandlers } from './cart';
import { handlers as fulfillmentHandlers } from './fulfillment';
import { handlers as paymentHandlers } from './payment';

export const handlers = [...cartHandlers, ...fulfillmentHandlers, ...paymentHandlers];
