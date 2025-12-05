import { mockFooterData } from '@mocks/data/footer';
import {
  emptyFooterHandler,
  generalErrorHandler,
  nullFooterHandler,
} from '@mocks/msw/handlers/footer';
import { server } from '@mocks/msw/node';
import { footerResolvers } from '@resolvers/footer';
import { createClient } from '@sanity/client';

describe('Footer Resolvers', () => {
  let mockContext: any;

  beforeEach(() => {
    const mockSanityClient = createClient({
      projectId: process.env.SANITY_STUDIO_PROJECT_ID,
      dataset: process.env.SANITY_STUDIO_DATASET,
      apiVersion: process.env.SANITY_STUDIO_API_VERSION,
      useCdn: false,
    });

    mockContext = {
      sanityClient: mockSanityClient,
    };
  });

  describe('Query.footer', () => {
    it('should handle successful footer content retrieval', async () => {
      const result = await footerResolvers.Query.footer();

      expect(result).toEqual(mockFooterData);
      if (result) {
        expect(result.storeName).toBe('Test Store');
        expect(result.social).toHaveLength(2);
      }
    });

    it('should handle empty footer content', async () => {
      server.use(emptyFooterHandler);

      const result = await footerResolvers.Query.footer();

      expect(result).toEqual({});
    });

    it('should handle null footer content', async () => {
      server.use(nullFooterHandler);

      const result = await footerResolvers.Query.footer();

      expect(result).toBeNull();
    });

    it('should handle service errors properly', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      server.use(generalErrorHandler);

      const result = await footerResolvers.Query.footer();
      expect(result).toEqual(null);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching footer content from Sanity:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle data integrity with JSON serialization', async () => {
      const result = await footerResolvers.Query.footer();

      const serialized = JSON.parse(JSON.stringify(result));
      expect(serialized).toEqual(mockFooterData);
    });
  });
});
