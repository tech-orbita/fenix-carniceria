import { test } from "node:test";
import assert from "node:assert/strict";

import { retailBillMessage } from "../src/lib/orders/retail-bill.ts";

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

  assert.match(message, /Pulpa: 1,5 kg × \$\s?22\.000 = \$\s?33\.000/);
  assert.match(message, /Domicilio: \$\s?5\.000/);
  assert.match(message, /Ajustes: -\$\s?1\.000/);
  assert.match(message, /Total a pagar: \$\s?37\.000/);
  assert.match(message, /Quedamos atentos a tu pago/);
});
