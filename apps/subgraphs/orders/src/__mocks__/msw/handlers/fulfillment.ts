import { HttpResponse, http } from 'msw';

import {
  createMockCalculatedShippingOption,
  createMockShippingOption,
} from '@mocks/shipping';

export const handlers = [
  http.get(`${process.env.MEDUSA_API_URL}/store/shipping-options`, () => {
    return HttpResponse.json({
      shipping_options: [createMockShippingOption()],
    });
  }),

  http.post(
    `${process.env.MEDUSA_API_URL}/store/shipping-options/:optionId/calculate`,
    () => {
      return HttpResponse.json({
        shipping_option: createMockCalculatedShippingOption(),
      });
    }
  ),
];

export const shippingOptionsErrorHandler = http.get(
  `${process.env.MEDUSA_API_URL}/store/shipping-options`,
  () => HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })
);

export const calculateShippingOptionErrorHandler = http.post(
  `${process.env.MEDUSA_API_URL}/store/shipping-options/:optionId/calculate`,
  () => HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })
);
