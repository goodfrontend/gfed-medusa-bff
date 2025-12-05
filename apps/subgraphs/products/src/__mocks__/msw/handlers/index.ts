import { handlers as productHandlers } from './product';
import { handlers as searchHandlers } from './search';

export const handlers = [...productHandlers, ...searchHandlers];
