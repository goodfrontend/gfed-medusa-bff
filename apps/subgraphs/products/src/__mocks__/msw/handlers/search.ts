import { HttpResponse, http } from 'msw';

import {
  createMockAlgoliaHit,
  createMockAlgoliaHits,
  createMockAlgoliaResponse,
} from '@mocks/search';

const ALGOLIA_SEARCH_ENDPOINT = `https://${process.env.ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${process.env.ALGOLIA_PRODUCT_INDEX_NAME}/query`;

export const handlers = [
  http.post(ALGOLIA_SEARCH_ENDPOINT, async () => {
    return HttpResponse.json(createMockAlgoliaResponse());
  }),
];

export const emptySearchHandler = http.post(ALGOLIA_SEARCH_ENDPOINT, () =>
  HttpResponse.json(createMockAlgoliaResponse([], { nbPages: 0 }))
);

export const customParamHandler = http.post(ALGOLIA_SEARCH_ENDPOINT, () =>
  HttpResponse.json(
    createMockAlgoliaResponse(createMockAlgoliaHits(5), {
      hitsPerPage: 10,
      page: 1,
    })
  )
);

export const invalidDataHandler = http.post(ALGOLIA_SEARCH_ENDPOINT, () =>
  HttpResponse.json({
    hits: [
      createMockAlgoliaHit({
        title: null,
        description: undefined,
        thumbnail: null,
      }),
    ],
    nbHits: 1,
  })
);

export const largeDataSetsHandler = http.post(ALGOLIA_SEARCH_ENDPOINT, () =>
  HttpResponse.json(
    createMockAlgoliaResponse(createMockAlgoliaHits(1000), { nbPages: 50 })
  )
);

export const networkTimeoutErrorHandler = http.post(
  ALGOLIA_SEARCH_ENDPOINT,
  () => HttpResponse.json({ message: 'Network timeout' }, { status: 504 })
);

export const internalServerErrorHandler = http.post(
  ALGOLIA_SEARCH_ENDPOINT,
  () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })
);

export const rateLimitExceededErrorHandler = http.post(
  ALGOLIA_SEARCH_ENDPOINT,
  () => HttpResponse.json({ message: 'Rate limit exceeded' }, { status: 429 })
);

export const unauthorizedErrorHandler = http.post(ALGOLIA_SEARCH_ENDPOINT, () =>
  HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
);

export const invalidCredentialsErrorHandler = http.post(
  ALGOLIA_SEARCH_ENDPOINT,
  () => HttpResponse.json({ message: 'Invalid credentials' }, { status: 403 })
);

export const searchNotFoundErrorHandler = http.post(
  ALGOLIA_SEARCH_ENDPOINT,
  () => HttpResponse.json({ message: 'Search not found' }, { status: 404 })
);
