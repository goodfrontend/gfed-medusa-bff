import { logger } from '../../services/logger';
import { sanityClient } from '../../config/sanity';
import { Footer } from '../../generated/graphql';
import { FOOTER_QUERY } from './groq-queries';

export const footerResolvers = {
  Query: {
    footer: async (): Promise<Footer | null> => {
      try {
        const result = await sanityClient.fetch(FOOTER_QUERY);
        return result;
      } catch (error) {
        logger.error({ err: error }, 'Error fetching footer content from Sanity');
        return null;
      }
    },
  },
};
