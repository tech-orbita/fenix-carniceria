import assert from "node:assert/strict";
import test from "node:test";

import { wholesaleDispatchMessage } from "../src/lib/orders/wholesale-messages.ts";

test("crea el aviso de despacho para el cliente mayorista", () => {
  assert.equal(
    wholesaleDispatchMessage({ customer: "Tienda La Esquina", orderNumber: "FEN-000123" }),
    "Buenas noticias, Tienda La Esquina. Tu pedido FEN-000123 ya va en camino. Esperamos que lo recibas a satisfacción. Gracias por seguir confiando en Fénix.",
  );
});
