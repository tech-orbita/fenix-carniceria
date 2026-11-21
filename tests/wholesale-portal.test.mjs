import assert from "node:assert/strict";
import test from "node:test";

import { safeUploadName, validateWholesalePortalOrder, wholesaleOrderText } from "../src/lib/orders/wholesale-portal.ts";

function futureDate(days = 1) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

test("conserva productos repetidos como renglones separados", () => {
  const order = validateWholesalePortalOrder({
    idempotencyKey: "3f14aa0b-d122-4ec8-a641-5236c031fec4",
    requestedDeliveryDate: futureDate(),
    items: [
      { productName: "Blanda", quantity: 3, unit: "lb", preparation: "Capón" },
      { productName: "Blanda", quantity: 4, unit: "lb", preparation: "Relajada" },
    ],
  });
  assert.equal(order.items.length, 2);
  assert.deepEqual(order.items.map((item) => item.quantity), [3, 4]);
  assert.equal(wholesaleOrderText(order.items), "3 lb Blanda Capón\n4 lb Blanda Relajada");
});

test("rechaza cantidades vacías y fechas pasadas", () => {
  assert.throws(() => validateWholesalePortalOrder({
    idempotencyKey: "3f14aa0b-d122-4ec8-a641-5236c031fec4",
    requestedDeliveryDate: "2020-01-01",
    items: [{ productName: "Blanda", quantity: 0, unit: "lb" }],
  }), /fecha de entrega/);
});

test("limpia el nombre del comprobante sin perder la extensión", () => {
  assert.equal(safeUploadName("Comprobante pago #42.JPG"), "Comprobante-pago-42.jpg");
});
