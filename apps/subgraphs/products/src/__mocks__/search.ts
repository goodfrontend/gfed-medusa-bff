export const createMockAlgoliaHit = (overrides = {}) => ({
  id: 'prod_1',
  title: 'Test Product',
  description: 'A test product description',
  thumbnail: 'https://example.com/thumbnail.jpg',
  handle: 'test-product',
  ...overrides,
});

export const createMockAlgoliaHits = (count = 3) =>
  Array.from({ length: count }, (_, i) =>
    createMockAlgoliaHit({
      id: `prod_${i + 1}`,
      title: `Test Product ${i + 1}`,
      handle: `test-product-${i + 1}`,
    })
  );

export const createMockAlgoliaResponse = (
  hits = createMockAlgoliaHits(5),
  overrides = {}
) => ({
  hits,
  nbHits: hits.length,
  page: 0,
  nbPages: 1,
  hitsPerPage: 20,
  query: '',
  params: '',
  processingTimeMS: 1,
  facets: {},
  facetDistribution: {},
  exhaustiveFacetsCount: true,
  exhaustiveNbHits: true,
  exhaustiveTypo: true,
  index: 'products',
  indexUsed: 'products',
  abTestVariantID: null,
  abTestID: null,
  aroundLatLng: null,
  automaticRadius: null,
  serverUsed: 'c7-use-2.algolia.net',
  parsedQuery: '',
  timeAfterSearch: 0,
  timeoutCounts: false,
  userData: null,
  ...overrides,
});
