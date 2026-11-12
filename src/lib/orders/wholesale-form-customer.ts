export type WholesaleFormCustomer = {
  name: string;
  phone: string;
  business_name?: string;
  tax_id?: string;
  email?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
};

export type ExistingWholesaleCustomer = {
  id: number;
  name: string;
  phone: string;
  business_name: string | null;
  tax_id: string | null;
  email: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  route_id: number | null;
};

export function isExistingWholesaleCustomerOrder(input: {
  source: "form" | "agent";
  customer_type: "retail" | "wholesale";
  form_data?: { form: string };
}) {
  return input.source === "form"
    && input.customer_type === "wholesale"
    && input.form_data?.form === "mayorista-cliente";
}

export function existingWholesaleCustomerPayload(
  submitted: WholesaleFormCustomer,
  existing: ExistingWholesaleCustomer,
): WholesaleFormCustomer {
  return {
    name: existing.name,
    phone: existing.phone,
    business_name: existing.business_name ?? submitted.business_name,
    tax_id: existing.tax_id ?? undefined,
    email: existing.email ?? undefined,
    address: existing.address ?? undefined,
    neighborhood: existing.neighborhood ?? undefined,
    city: existing.city ?? undefined,
  };
}
