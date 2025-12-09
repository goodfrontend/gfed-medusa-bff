import { Customer, CustomerAddress } from '@graphql/generated/graphql';
import { StoreCustomer } from '@medusajs/types';
import { BaseCustomerAddress } from '@medusajs/types/dist/http/customer/common';

export function transformCustomerAddress(
  address: BaseCustomerAddress
): CustomerAddress {
  return {
    id: address.id,
    addressName: address.address_name,
    isDefaultBilling: address.is_default_billing,
    isDefaultShipping: address.is_default_shipping,
    customerId: address.customer_id,
    company: address.company,
    firstName: address.first_name,
    lastName: address.last_name,
    address1: address.address_1,
    address2: address.address_2,
    city: address.city,
    countryCode: address.country_code,
    province: address.province,
    postalCode: address.postal_code,
    phone: address.phone,
  };
}

export function transformCustomer(customer: StoreCustomer): Customer {
  return {
    id: customer.id,
    email: customer.email,
    defaultBillingAddressId: customer.default_billing_address_id,
    defaultShippingAddressId: customer.default_shipping_address_id,
    companyName: customer.company_name,
    firstName: customer.first_name,
    lastName: customer.last_name,
    addresses: customer.addresses.map((address) =>
      transformCustomerAddress(address)
    ),
    phone: customer.phone,
  };
}
