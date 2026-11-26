import { normalizedWholesaleBusiness, normalizedWholesalePhone } from "./wholesale-routes.ts";

export type WholesaleLookupCustomer = {
  id: number;
  name: string;
  business_name: string | null;
  phone: string | null;
};

export type WholesaleBusinessOption = {
  customerId: number;
  businessName: string;
};

export function wholesaleBusinessesForPhone(customers: WholesaleLookupCustomer[], phone: string): WholesaleBusinessOption[] {
  const normalizedPhone = normalizedWholesalePhone(phone);
  if (!normalizedPhone) return [];
  return customers
    .filter((customer) => normalizedWholesalePhone(customer.phone) === normalizedPhone)
    .map((customer) => ({ customerId: customer.id, businessName: customer.business_name || customer.name }))
    .sort((left, right) => left.businessName.localeCompare(right.businessName, "es"));
}

export function selectedWholesaleCustomer<T extends WholesaleLookupCustomer>(
  customers: T[],
  input: { phone: string; customerId?: number; businessName: string },
): T | undefined {
  const phoneMatches = wholesaleBusinessesForPhone(customers, input.phone);
  if (input.customerId) {
    const selected = phoneMatches.find((customer) => customer.customerId === input.customerId);
    return selected ? customers.find((customer) => customer.id === selected.customerId) : undefined;
  }
  const normalizedBusiness = normalizedWholesaleBusiness(input.businessName);
  const matches = phoneMatches.filter((customer) => normalizedWholesaleBusiness(customer.businessName) === normalizedBusiness);
  return matches.length === 1 ? customers.find((customer) => customer.id === matches[0].customerId) : undefined;
}
