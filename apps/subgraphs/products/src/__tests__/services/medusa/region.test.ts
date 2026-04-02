import Medusa from '@medusajs/js-sdk';
import { mockMedusa } from '@mocks/medusa';
import { RegionService } from '@services/medusa/region';

jest.mock('@medusajs/js-sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockMedusa),
}));

describe('RegionService', () => {
  let regionService: RegionService;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    regionService = new RegionService(mockMedusa as unknown as Medusa);
    (regionService as any).medusa = mockMedusa;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('getRegionIdByCountryCode', () => {
    it('should return a matching region id for a country code', async () => {
      mockMedusa.store.region.list.mockResolvedValue({
        regions: [
          {
            id: 'reg_eu',
            countries: [{ iso_2: 'de' }, { iso_2: 'fr' }],
          },
          {
            id: 'reg_us',
            countries: [{ iso_2: 'us' }, { iso_2: 'ca' }],
          },
        ],
      });

      const result = await regionService.getRegionIdByCountryCode('US');

      expect(result).toBe('reg_us');
      expect(mockMedusa.store.region.list).toHaveBeenCalledWith({
        fields: 'id,+countries.*',
      });
    });

    it('should return null when no region matches the country code', async () => {
      mockMedusa.store.region.list.mockResolvedValue({
        regions: [
          {
            id: 'reg_eu',
            countries: [{ iso_2: 'de' }, { iso_2: 'fr' }],
          },
        ],
      });

      const result = await regionService.getRegionIdByCountryCode('us');

      expect(result).toBeNull();
    });

    it('should return null for empty country codes without calling Medusa', async () => {
      const result = await regionService.getRegionIdByCountryCode('  ');

      expect(result).toBeNull();
      expect(mockMedusa.store.region.list).not.toHaveBeenCalled();
    });

    it('should surface Medusa errors', async () => {
      mockMedusa.store.region.list.mockRejectedValue(
        new Error('Region lookup failed')
      );

      await expect(
        regionService.getRegionIdByCountryCode('us')
      ).rejects.toThrow(
        'Failed to resolve region by country code: Region lookup failed'
      );
    });
  });
});
