import 'dotenv/config';

import { createClient } from '@sanity/client';

const SANITY_PROJECT_ID =
  process.env.SANITY_STUDIO_PROJECT_ID || 'your-project-id';
const SANITY_DATASET = process.env.SANITY_STUDIO_DATASET || 'production';
const SANITY_API_VERSION =
  process.env.SANITY_STUDIO_API_VERSION || '2023-05-03';

export const sanityClient = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  useCdn: true,
  apiVersion: SANITY_API_VERSION,
  token: process.env.SANITY_API_TOKEN,
});

export const sanityConfig = {
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  useCdn: true,
  apiVersion: SANITY_API_VERSION,
};
