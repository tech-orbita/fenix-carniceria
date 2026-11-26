import assert from "node:assert/strict";
import test from "node:test";

import { customerIdentityKey, splitWholesaleRouteFilters, wholesaleCustomerRouteId, wholesaleRouteFilters, wholesaleRouteRank } from "../src/lib/orders/wholesale-routes.ts";

test("separa negocios mayoristas con el mismo nombre usando el teléfono", () => {
  assert.equal(customerIdentityKey("wholesale", {
    businessName: "Tienda La Fe",
    name: "Holman",
    phone: "315 0285755",
  }), "business:tienda la fe|phone:573150285755");
  assert.notEqual(
    customerIdentityKey("wholesale", { businessName: "Tienda La Fe", name: "Holman", phone: "315 0285755" }),
    customerIdentityKey("wholesale", { businessName: "Tienda La Fe", name: "Stiven", phone: "317 3737077" }),
  );
});

test("normaliza filtros de ruta y descarta valores desconocidos", () => {
  assert.deepEqual(
    wholesaleRouteFilters("Norte,Barrios principales,7 de Abril, Sin clasificar,Norte,Desconocida"),
    ["Norte", "Barrios principales", "7 de Abril", "Sin clasificar"],
  );
});

test("separa clientes sin ruta de las rutas asignadas", () => {
  assert.deepEqual(splitWholesaleRouteFilters(["Centro", "Sin clasificar", "Norte"]), {
    assigned: ["Centro", "Norte"],
    includeUnassigned: true,
  });
});

test("conserva el filtro sin clasificar aunque sea el único seleccionado", () => {
  assert.deepEqual(splitWholesaleRouteFilters(wholesaleRouteFilters("Sin clasificar")), {
    assigned: [],
    includeUnassigned: true,
  });
});

test("mantiene un orden estable de rutas aunque se seleccionen en otro orden", () => {
  const selectedInClickOrder = ["Norte", "Centro", "Sin clasificar"];
  assert.deepEqual(selectedInClickOrder.toSorted((left, right) => wholesaleRouteRank(left) - wholesaleRouteRank(right)), [
    "Centro",
    "Norte",
    "Sin clasificar",
  ]);
});

test("incluye sin clasificar como filtro de clientes que no tienen ruta", () => {
  assert.deepEqual(splitWholesaleRouteFilters(wholesaleRouteFilters("Norte,Sin clasificar,Norte")), {
    assigned: ["Norte"],
    includeUnassigned: true,
  });
});

test("organiza las rutas en un orden estable y deja sin clasificar al final", () => {
  const routes = ["7 de Abril", "Norte", "Sin clasificar", "Barrios principales", "Centro"];
  assert.deepEqual(routes.toSorted((left, right) => wholesaleRouteRank(left) - wholesaleRouteRank(right)), [
    "Centro",
    "Norte",
    "Barrios principales",
    "7 de Abril",
    "Sin clasificar",
  ]);
});

test("un pedido nuevo conserva la ruta que el usuario asignó al cliente", () => {
  assert.equal(wholesaleCustomerRouteId({ route_id: 12 }, 99), 12);
  assert.equal(wholesaleCustomerRouteId({ route_id: null }, 99), null);
  assert.equal(wholesaleCustomerRouteId(null, 99), 99);
});
