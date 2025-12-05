import { HttpResponse, http } from 'msw';

import {
  createMockMedusaProduct,
  createMockMedusaProducts,
} from '@mocks/products';

/* Success (i.e. happy path) handlers */
export const handlers = [
  http.get(`${process.env.MEDUSA_API_URL}/store/products`, () =>
    HttpResponse.json({
      products: createMockMedusaProducts(5),
      count: 5,
      limit: 20,
      offset: 0,
    })
  ),
  http.get(`${process.env.MEDUSA_API_URL}/store/products/:id`, () =>
    HttpResponse.json({
      product: createMockMedusaProduct(),
    })
  ),
];

/* Other handlers */
export const emptyProductsHandler = http.get(
  `${process.env.MEDUSA_API_URL}/store/products`,
  () =>
    HttpResponse.json({
      products: [],
      count: 0,
      limit: 20,
      offset: 0,
    })
);

export const networkTimeoutErrorHandler = http.get(
  `${process.env.MEDUSA_API_URL}/store/products`,
  () => HttpResponse.json({ message: 'Network timeout' }, { status: 504 })
);

export const internalServerErrorHandler = http.get(
  `${process.env.MEDUSA_API_URL}/store/products`,
  () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })
);

export const rateLimitExceededErrorHandler = http.get(
  `${process.env.MEDUSA_API_URL}/store/products`,
  () => HttpResponse.json({ message: 'Rate limit exceeded' }, { status: 429 })
);

export const invalidProductDataHandler = http.get(
  `${process.env.MEDUSA_API_URL}/store/products`,
  () =>
    HttpResponse.json({
      products: [
        { id: 'valid_prod', title: 'Valid Product' },
        null,
        undefined,
        { id: 'another_valid', title: 'Another Valid' },
      ],
      count: 0,
      limit: 20,
      offset: 0,
    })
);

export const largeDataSetsHandler = http.get(
  `${process.env.MEDUSA_API_URL}/store/products`,
  () =>
    HttpResponse.json({
      products: createMockMedusaProducts(1000),
      count: 1000,
      limit: 1000,
      offset: 0,
    })
);

export const productNotFoundHandler = http.get(
  `${process.env.MEDUSA_API_URL}/store/products/:id`,
  ({ params }) =>
    HttpResponse.json(
      { message: `Product with id: ${params.id} was not found` },
      { status: 404 }
    )
);

export const publishableKeyRequiredHandler = http.get(
  `${process.env.MEDUSA_API_URL}/store/products/:id`,
  () =>
    HttpResponse.json(
      {
        message:
          'Publishable API key required in the request header: x-publishable-api-key. You can manage your keys in settings in the dashboard.',
      },
      { status: 400 }
    )
);

export const unauthorizedAccessHandler = http.get(
  `${process.env.MEDUSA_API_URL}/store/products/:id`,
  () => HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
);

export const rateLimitExceededProductErrorHandler = http.get(
  `${process.env.MEDUSA_API_URL}/store/products/:id`,
  () => HttpResponse.json({ message: 'Rate limit exceeded' }, { status: 429 })
);
