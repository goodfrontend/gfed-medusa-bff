export const createMockPaymentProviders = () => [
  { id: 'pp_stripe_stripe' },
  { id: 'pp_system_default' },
];

export const createMockPaymentCollection = () => ({
  id: 'pc_123',
  currency_code: 'usd',
  amount: 2000,
  status: 'not_paid',
  payment_providers: createMockPaymentProviders(),
  payment_sessions: [],
});
