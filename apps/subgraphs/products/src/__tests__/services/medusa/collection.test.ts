import Medusa from '@medusajs/js-sdk';
import { mockMedusa } from '@mocks/medusa';
import { CollectionService } from '@services/medusa/collection';

import { COLLECTION_FIELDS } from '../../../constants/medusa';

jest.mock('@medusajs/js-sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockMedusa),
}));

describe('CollectionService', () => {
  let collectionService: CollectionService;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    collectionService = new CollectionService(mockMedusa as unknown as Medusa);
    (collectionService as any).medusa = mockMedusa;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('getCollections', () => {
    it('should handle successful collection retrieval', async () => {
      const mockCollections = [
        { id: 'col_1', title: 'Summer Collection', handle: 'summer' },
        { id: 'col_2', title: 'Winter Collection', handle: 'winter' },
      ];
      mockMedusa.store.collection.list.mockResolvedValue({
        collections: mockCollections,
      });

      const result = await collectionService.getCollections();
      expect(result).toEqual(mockCollections);
      expect(mockMedusa.store.collection.list).toHaveBeenCalledWith({
        fields: COLLECTION_FIELDS,
      });
    });

    it('should handle empty collection response', async () => {
      mockMedusa.store.collection.list.mockResolvedValue({
        collections: [],
      });

      const result = await collectionService.getCollections();
      expect(result).toEqual([]);
    });

    it('should throw error on failure', async () => {
      mockMedusa.store.collection.list.mockRejectedValue(
        new Error('Collection fetch failed')
      );
      await expect(collectionService.getCollections()).rejects.toThrow();
    });
  });

  describe('getCollection', () => {
    it('should handle successful single collection retrieval', async () => {
      const mockCollection = {
        id: 'col_1',
        title: 'Summer Collection',
        handle: 'summer',
      };
      mockMedusa.store.collection.retrieve.mockResolvedValue({
        collection: mockCollection,
      });

      const result = await collectionService.getCollection('col_1');
      expect(result).toEqual(mockCollection);
      expect(mockMedusa.store.collection.retrieve).toHaveBeenCalledWith(
        'col_1',
        { fields: COLLECTION_FIELDS }
      );
    });

    it('should return null when collection not found', async () => {
      mockMedusa.store.collection.retrieve.mockResolvedValue({});
      const result = await collectionService.getCollection('nonexistent');
      expect(result).toBeNull();
    });

    it('should throw error on failure', async () => {
      mockMedusa.store.collection.retrieve.mockRejectedValue(
        new Error('Collection not found')
      );
      await expect(
        collectionService.getCollection('invalid')
      ).rejects.toThrow();
    });
  });
});
