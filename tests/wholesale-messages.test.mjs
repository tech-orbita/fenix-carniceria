import assert from "node:assert/strict";
import test from "node:test";

import { wholesaleDispatchMessage, wholesaleOrderConfirmationMessage } from "../src/lib/orders/wholesale-messages.ts";

test("crea la confirmación del pedido mayorista con el número real", () => {
  assert.equal(
    wholesaleOrderConfirmationMessage({ customer: "Jan Jader", orderNumber: "FEN-000208" }),
    "Hola, Jan Jader.\n\nHemos recibido correctamente tu pedido en Fénix J.A.\nNúmero de pedido: FEN-000208\n\nNuestro equipo revisará la solicitud para organizar su despacho. Gracias por confiar en nosotros.",
  );
});

test("crea el aviso de despacho para el cliente mayorista", () => {
  assert.equal(
    wholesaleDispatchMessage({ customer: "Tienda La Esquina", orderNumber: "FEN-000123" }),
    "Buenas noticias, Tienda La Esquina. Tu pedido FEN-000123 ya va en camino. Esperamos que lo recibas a satisfacción. Gracias por seguir confiando en Fénix.",
  );
});
