import assert from "node:assert/strict";
import test from "node:test";

import { selectedWholesaleCustomer, wholesaleBusinessesForPhone } from "../src/lib/orders/wholesale-customer-lookup.ts";

const customers = [
  { id: 1, name: "Jorge Rico", business_name: "LA GRANJA", phone: "+57 313 522 2698" },
  { id: 2, name: "Jorge Rico", business_name: "GRANJA DEL NORTE", phone: "3135222698" },
  { id: 3, name: "Otra persona", business_name: "OTRO NEGOCIO", phone: "3001234567" },
];

test("el teléfono devuelve únicamente sus establecimientos registrados", () => {
  assert.deepEqual(wholesaleBusinessesForPhone(customers, "313 522 2698"), [
    { customerId: 2, businessName: "GRANJA DEL NORTE" },
    { customerId: 1, businessName: "LA GRANJA" },
  ]);
});

test("la selección se valida por identificador y teléfono, no por texto escrito", () => {
  assert.equal(selectedWholesaleCustomer(customers, { phone: "3135222698", customerId: 1, businessName: "nombre distinto" })?.business_name, "LA GRANJA");
  assert.equal(selectedWholesaleCustomer(customers, { phone: "3001234567", customerId: 1, businessName: "LA GRANJA" }), undefined);
});

test("conserva compatibilidad con el nombre exacto de formularios anteriores", () => {
  assert.equal(selectedWholesaleCustomer(customers, { phone: "3135222698", businessName: "la granja" })?.id, 1);
});
