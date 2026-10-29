import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveSiteUrl } from "../src/lib/auth/site-url.ts";
import { validateNewPassword } from "../src/lib/auth/password.ts";

test("valida longitud y confirmación de la nueva contraseña", () => {
  assert.match(validateNewPassword("corta", "corta"), /8 caracteres/);
  assert.match(validateNewPassword("contraseña-segura", "otra-contraseña"), /no coinciden/);
  assert.equal(validateNewPassword("contraseña-segura", "contraseña-segura"), undefined);
});

test("usa el dominio de producción si la variable pública quedó apuntando a localhost", () => {
  assert.equal(resolveSiteUrl({
    configured: "http://localhost:3000",
    requestOrigin: "https://preview.example.com",
    vercelProductionHost: "fenix-carniceria.vercel.app",
  }), "https://fenix-carniceria.vercel.app");
});
