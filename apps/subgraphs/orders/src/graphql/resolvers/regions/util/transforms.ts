import { StoreRegion } from '@medusajs/types';

export const transformRegion = (region: StoreRegion) => ({
  id: region.id,
  name: region.name,
  currencyCode: region.currency_code,
  createdAt: region.created_at,
  countries:
    region.countries?.map((c) => ({
      id: c.id,
      iso2: c.iso_2,
      name: c.name,
      displayName: c.display_name,
    })) ?? [],
});
