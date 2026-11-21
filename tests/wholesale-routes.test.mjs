import { test } from "node:test";
import assert from "node:assert/strict";

import { customerIdentityKey, splitWholesaleRouteFilters, wholesaleCustomerRouteId, wholesaleRouteFilters, wholesaleRouteLabel, wholesaleRouteRank, wholesaleRoutes } from "../src/lib/orders/wholesale-routes.ts";

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

test("incluye sin clasificar como filtro de clientes que no tienen ruta", () => {
  assert.deepEqual(splitWholesaleRouteFilters(wholesaleRouteFilters("Norte,Sin clasificar,Norte")), {
    assigned: ["Norte"],
    includeUnassigned: true,
  });
});

test("organiza las rutas en un orden estable y deja sin clasificar al final", () => {
  const routes = ["Norte", "Sin clasificar", "Centro"];
  assert.deepEqual(routes.toSorted((left, right) => wholesaleRouteRank(left) - wholesaleRouteRank(right)), [
    "Centro",
    "Norte",
    "Sin clasificar",
  ]);
});

test("un pedido nuevo conserva la ruta que el usuario asignó al cliente", () => {
  assert.equal(wholesaleCustomerRouteId({ route_id: 12 }, 99), 12);
  assert.equal(wholesaleCustomerRouteId({ route_id: null }, 99), null);
  assert.equal(wholesaleCustomerRouteId(null, 99), 99);
});
