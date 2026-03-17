import type { GraphQLResolveInfo } from 'graphql';

import { getSelectedPaths, hasSelectedPath } from './selection';

function buildCustomerFieldsFromPaths(selectedPaths: Set<string>) {
  const fields = new Set<string>([
    'id',
    'email',
    'company_name',
    'first_name',
    'last_name',
    'phone',
  ]);

  if (hasSelectedPath(selectedPaths, 'addresses')) {
    fields.add('+addresses.*');
  }

  return Array.from(fields).join(',');
}

export function buildCustomerFields(info?: GraphQLResolveInfo) {
  if (!info) {
    return buildCustomerFieldsFromPaths(new Set());
  }

  return buildCustomerFieldsFromPaths(getSelectedPaths(info));
}

export const __testUtils = {
  buildCustomerFieldsFromPaths,
};
