import 'dotenv/config';

import { sanityClient } from '../../config/sanity';
import { Footer } from '../../generated/graphql';
import { FOOTER_QUERY } from './groq-queries';

export const footerResolvers = {
  Query: {
    footer: async (): Promise<Footer | null> => {
      const footerId = process.env.SANITY_STUDIO_FOOTER_ID;
      try {
        const result = await sanityClient.fetch(FOOTER_QUERY, {
          footerId,
        });
        return result;
      } catch (error) {
        console.error('Error fetching footer content from Sanity:', error);
        return null;
      }
    },
  },
};
