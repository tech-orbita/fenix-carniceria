import { test } from "node:test";
import assert from "node:assert/strict";

import {
  existingWholesaleCustomerPayload,
  isExistingWholesaleCustomerOrder,
} from "../src/lib/orders/wholesale-form-customer.ts";

test("el formulario Cliente Mayorista reutiliza la ficha registrada", () => {
  assert.equal(isExistingWholesaleCustomerOrder({
    source: "form",
    customer_type: "wholesale",
    form_data: { form: "mayorista-cliente" },
  }), true);
  assert.deepEqual(existingWholesaleCustomerPayload(
    { name: "Tienda registrada", business_name: "Tienda registrada", phone: "3000000000" },
    {
      id: 8,
      name: "Ana Pérez",
      phone: "+573111111111",
      business_name: "Tienda registrada",
      tax_id: "900123456",
      email: "ana@example.com",
      address: "Calle 10 # 20-30",
      neighborhood: "Centro",
      city: "Barranquilla",
      route_id: 4,
    },
  ), {
    name: "Ana Pérez",
    phone: "+573111111111",
    business_name: "Tienda registrada",
    tax_id: "900123456",
    email: "ana@example.com",
    address: "Calle 10 # 20-30",
    neighborhood: "Centro",
    city: "Barranquilla",
  });
});

test("Nuevo Mayorista sigue el flujo que registra o actualiza el cliente", () => {
  assert.equal(isExistingWholesaleCustomerOrder({
    source: "form",
    customer_type: "wholesale",
    form_data: { form: "nuevo-mayorista" },
  }), false);
});
