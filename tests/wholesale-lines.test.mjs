import assert from "node:assert/strict";
import test from "node:test";

import { formatWholesaleDisplayLines } from "../src/lib/orders/wholesale-lines.ts";

test("mantiene separados los renglones repetidos del mismo producto", () => {
  const result = formatWholesaleDisplayLines([
    { quantity: 3, unit: "cantidad" },
    { quantity: 4, unit: "cantidad" },
  ], String, "cantidad");

  assert.equal(result, "3 / 4");
});

test("conserva unidad y preparación en cada renglón", () => {
  const result = formatWholesaleDisplayLines([
    { quantity: 3, unit: "lb", detail: "C" },
    { quantity: 4, unit: "lb", detail: "C" },
  ], String, "cantidad");

  assert.equal(result, "3 lb C / 4 lb C");
});
