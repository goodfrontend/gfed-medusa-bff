import { HttpTypes } from '@medusajs/types';

export const transformShippingOption = (
  option: HttpTypes.StoreCartShippingOption
) => {
  // service_zone is dynamically fetched via Medusa fields expansion at runtime
  const dynamicOption = option as any;
  const serviceZoneRaw = dynamicOption.service_zone;

  const calculatedPriceRaw = dynamicOption.calculated_price;
  const pricesRaw: any[] = dynamicOption.prices ?? [];
  const derivedAmount =
    option.amount ??
    pricesRaw.find((price) => typeof price?.amount === 'number')?.amount ??
    null;

  return {
    id: option.id,
    name: option.name,
    amount: derivedAmount,
    priceType: option.price_type,
    serviceZoneId: option.service_zone_id,
    insufficientInventory: option.insufficient_inventory,
    calculatedPrice: calculatedPriceRaw ? { amount: calculatedPriceRaw.amount ?? null } : null,
    prices: pricesRaw.map((p) => ({
      amount: p.amount ?? null,
      currencyCode: p.currency_code ?? null,
      priceRules: (p.price_rules ?? []).map((r: any) => ({
        attribute: r.attribute,
        operator: r.operator,
        value: r.value,
      })),
    })),
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
