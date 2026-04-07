import { handleMedusaError } from '@gfed-medusa/bff-lib-common';

import { MedusaBaseService } from '.';

type StoreRegionCountry = {
  iso_2?: string | null;
};

type StoreRegionRecord = {
  id: string;
  countries?: StoreRegionCountry[] | null;
};

const REGION_LOOKUP_FIELDS = 'id,+countries.*';

export class RegionService extends MedusaBaseService {
  async getRegionIdByCountryCode(
    countryCode?: string | null
  ): Promise<string | null> {
    if (!countryCode?.trim()) {
      return null;
    }

    const normalizedCountryCode = countryCode.trim().toLowerCase();

    try {
      const { regions } = await this.medusa.store.region.list({
        fields: REGION_LOOKUP_FIELDS,
      });
      const matchingRegion = (regions as StoreRegionRecord[] | undefined)?.find(
        (region) =>
          (region.countries ?? []).some(
            (country) => country.iso_2?.toLowerCase() === normalizedCountryCode
          )
      );

      return matchingRegion?.id ?? null;
    } catch (error: unknown) {
      handleMedusaError(error, 'resolve region by country code', [
        'browseProducts',
      ]);
    }
  }
}
