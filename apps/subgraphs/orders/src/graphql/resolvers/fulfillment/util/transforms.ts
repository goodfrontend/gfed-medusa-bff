import { HttpTypes } from '@medusajs/types';

export const transformShippingOption = (
  option: HttpTypes.StoreCartShippingOption
) => {
  // service_zone is dynamically fetched via Medusa fields expansion at runtime
  const dynamicOption = option as any;
  const serviceZoneRaw = dynamicOption.service_zone;

  return {
    id: option.id,
    name: option.name,
    amount: option.amount ?? null,
    priceType: option.price_type,
    serviceZoneId: option.service_zone_id,
    insufficientInventory: option.insufficient_inventory,
    serviceZone: serviceZoneRaw
      ? {
          fulfillmentSetType: serviceZoneRaw.fulfillment_set?.type ?? null,
          location: serviceZoneRaw.fulfillment_set?.location
            ? {
                address: serviceZoneRaw.fulfillment_set.location.address
                  ? {
                      city: serviceZoneRaw.fulfillment_set.location.address.city ?? null,
                      countryCode:
                        serviceZoneRaw.fulfillment_set.location.address.country_code ?? null,
                      address1:
                        serviceZoneRaw.fulfillment_set.location.address.address_1 ?? null,
                      postalCode:
                        serviceZoneRaw.fulfillment_set.location.address.postal_code ?? null,
                    }
                  : null,
              }
            : null,
        }
      : null,
  };
};
