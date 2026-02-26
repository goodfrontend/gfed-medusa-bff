import { handlers as cartHandlers } from './cart';
import { handlers as fulfillmentHandlers } from './fulfillment';
import { handlers as orderHandlers } from './order';
import { handlers as paymentHandlers } from './payment';

export const handlers = [
  ...cartHandlers,
  ...fulfillmentHandlers,
  ...orderHandlers,
  ...paymentHandlers,
];
