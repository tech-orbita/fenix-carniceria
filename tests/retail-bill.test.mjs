import { test } from "node:test";
import assert from "node:assert/strict";

import { retailBillMessage, retailDispatchMessage } from "../src/lib/orders/retail-bill.ts";

test("arma la cuenta minorista con peso real, domicilio y total", () => {
  const message = retailBillMessage({
    orderNumber: "FEN-000123",
    customer: "Ana Pérez",
    receivedAt: "2026-10-24T15:00:00.000Z",
    paymentStatus: "pending",
    deliveryFee: 5_000,
    adjustments: -1_000,
    items: [
      { productName: "Pulpa", quantity: 2, actualQuantity: 1.5, unit: "kg", unitPrice: 22_000 },
    ],
  });

  assert.match(message, /Pulpa: 1,5 kg × \$\s?22\.000\/kg = \$\s?33\.000/);
  assert.match(message, /Domicilio: \$\s?5\.000/);
  assert.match(message, /Ajustes: -\$\s?1\.000/);
  assert.match(message, /Total a pagar: \$\s?37\.000/);
  assert.match(message, /Quedamos atentos a tu pago/);
});

test("no cobra unidades sin peso real", () => {
  const message = retailBillMessage({
    orderNumber: "FEN-2", customer: "Ana", receivedAt: "2026-10-29T12:00:00Z",
    paymentStatus: "pending", deliveryFee: 0, adjustments: 0,
    items: [{ productName: "Pechuga congelada", quantity: 2, unit: "und", unitPrice: 14_000 }],
  });
  assert.match(message, /2 und · peso pendiente/);
  assert.match(message, /Subtotal: \$\s?0/);
});

test("avisa el despacho sin prometer una hora de entrega", () => {
  const delivery = retailDispatchMessage({ orderNumber: "FEN-3", customer: "Ana", fulfillment: "delivery" });
  const pickup = retailDispatchMessage({ orderNumber: "FEN-4", customer: "Luis", fulfillment: "pickup" });

  assert.match(delivery, /ya salió a despacho/);
  assert.doesNotMatch(delivery, /hora|a las/i);
  assert.match(pickup, /listo para recoger/);
});

test("cobra productos vendidos por unidad", () => {
  const message = retailBillMessage({
    orderNumber: "FEN-5", customer: "Ana", receivedAt: "2026-10-29T12:00:00Z",
    paymentStatus: "pending", deliveryFee: 0, adjustments: 0,
    items: [{ productName: "Pata de res", quantity: 2, actualQuantity: 2, unit: "und", unitPrice: 9_000 }],
  });

  assert.match(message, /2 und × \$\s?9\.000\/und = \$\s?18\.000/);
  assert.doesNotMatch(message, /peso pendiente/);
});
