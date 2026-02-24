import { HttpTypes } from '@medusajs/types';

export const transformShippingOption = (
  option: HttpTypes.StoreCartShippingOption
) => ({
  id: option.id,
  name: option.name,
  amount: option.amount ?? null,
  priceType: option.price_type,
  serviceZoneId: option.service_zone_id,
  insufficientInventory: option.insufficient_inventory,
});
