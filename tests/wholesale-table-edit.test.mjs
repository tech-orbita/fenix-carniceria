import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/lib/orders/wholesale-table-edit.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const compiledModule = { exports: {} };
vm.runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports });
const { changedWholesaleTableRow } = compiledModule.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("solo envía la celda que cambió y no revalida textos históricos", () => {
  const original = {
    routeName: "Barrio",
    notes: "",
    quantities: { Blanda: "30 hueso negro porfa", Espaldilla: "3" },
  };
  const draft = {
    routeName: "Barrio",
    notes: "",
    quantities: { Blanda: "30 hueso negro porfa", Espaldilla: "3", Ubre: "4 lb" },
  };

  assert.deepEqual(
    plain(changedWholesaleTableRow("192", original, draft, ["Blanda", "Espaldilla", "Ubre"])),
    {
      orderId: "192",
      routeName: "Barrio",
      notes: "",
      quantities: [{ productName: "Ubre", value: "4 lb" }],
    },
  );
});

test("omite filas que no fueron modificadas", () => {
  const row = { routeName: "Centro", notes: "nota", quantities: { Pechuga: "15 lb" } };
  assert.equal(changedWholesaleTableRow("189", row, { ...row, quantities: { ...row.quantities } }, ["Pechuga"]), null);
});

test("guarda cambios de ruta aunque no cambie una cantidad", () => {
  const original = { routeName: "Sin clasificar", notes: "", quantities: { Pata: "2" } };
  const draft = { routeName: "Soledad", notes: "", quantities: { Pata: "2" } };
  assert.deepEqual(plain(changedWholesaleTableRow("200", original, draft, ["Pata"])), {
    orderId: "200",
    routeName: "Soledad",
    notes: "",
    quantities: [],
  });
});
