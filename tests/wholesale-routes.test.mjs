import { test } from "node:test";
import assert from "node:assert/strict";

import { customerIdentityKey, wholesaleRouteLabel, wholesaleRoutes } from "../src/lib/orders/wholesale-routes.ts";

test("ofrece las siete rutas operativas solicitadas", () => {
  assert.deepEqual(wholesaleRoutes, ["Centro", "Cacique", "Cordialidad", "Soledad", "Norte", "Galapa", "Barrio"]);
  assert.equal(wholesaleRouteLabel("Centro"), "Ruta Centro");
});

test("identifica mayoristas por establecimiento aunque compartan teléfono", () => {
  const first = customerIdentityKey("wholesale", { businessName: "El Oasis", name: "Andrés", phone: "+573103990661" });
  const same = customerIdentityKey("wholesale", { businessName: "  EL   OASIS ", name: "Otra persona", phone: "+570000000000" });
  const other = customerIdentityKey("wholesale", { businessName: "La Hormiga", name: "Andrés", phone: "+573103990661" });
  assert.equal(first, same);
  assert.notEqual(first, other);
});

test("mantiene el teléfono como identidad del minorista", () => {
  assert.equal(customerIdentityKey("retail", { name: "Cliente", phone: "+57 300 123 4567" }), "phone:573001234567");
});
