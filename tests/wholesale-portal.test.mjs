import assert from "node:assert/strict";
import test from "node:test";

import { validateWholesalePortalOrder } from "../src/lib/orders/wholesale-portal.ts";

test("valida el formulario libre sin fecha ni comprobante", () => {
  const order = validateWholesalePortalOrder({
    idempotencyKey: "3f14aa0b-d122-4ec8-a641-5236c031fec4",
    customerId: 27,
    businessName: "Tienda Colonial",
    phone: "300 123 4567",
    orderText: "3 lb blanda\n4 lb blanda",
    notes: "Separar por renglones",
  });
  assert.deepEqual(order, {
    idempotencyKey: "3f14aa0b-d122-4ec8-a641-5236c031fec4",
    customerId: 27,
    businessName: "Tienda Colonial",
    phone: "300 123 4567",
    orderText: "3 lb blanda\n4 lb blanda",
    notes: "Separar por renglones",
  });
});

test("exige establecimiento, teléfono y pedido", () => {
  assert.throws(() => validateWholesalePortalOrder({
    idempotencyKey: "3f14aa0b-d122-4ec8-a641-5236c031fec4",
    businessName: "",
    phone: "3001234567",
    orderText: "3 molida",
  }), /establecimiento/);
  assert.throws(() => validateWholesalePortalOrder({
    idempotencyKey: "3f14aa0b-d122-4ec8-a641-5236c031fec4",
    businessName: "Tienda Colonial",
    phone: "123",
    orderText: "3 molida",
  }), /teléfono válido/);
});
