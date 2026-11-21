import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const wholesalePortalCookie = "fenix_wholesale_portal";
const sessionSeconds = 12 * 60 * 60;

type PortalSession = { customerId: number; expiresAt: number };

function secret() {
  const value = process.env.WHOLESALE_PORTAL_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("WHOLESALE_PORTAL_SECRET must contain at least 32 characters.");
  return value;
}

function signature(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createWholesalePortalSession(customerId: number) {
  const payload: PortalSession = { customerId, expiresAt: Math.floor(Date.now() / 1000) + sessionSeconds };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { value: `${encoded}.${signature(encoded)}`, maxAge: sessionSeconds };
}

export function readWholesalePortalSession(value?: string): PortalSession | null {
  if (!value) return null;
  const [encoded, supplied] = value.split(".");
  if (!encoded || !supplied) return null;
  const expected = signature(encoded);
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<PortalSession>;
    if (!Number.isSafeInteger(parsed.customerId) || !Number.isSafeInteger(parsed.expiresAt)) return null;
    if (Number(parsed.expiresAt) <= Math.floor(Date.now() / 1000)) return null;
    return { customerId: Number(parsed.customerId), expiresAt: Number(parsed.expiresAt) };
  } catch {
    return null;
  }
}

export function portalFingerprint(request: Request, identity: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHmac("sha256", secret()).update(`${ip}:${identity}`).digest("hex");
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const expectedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  try { return new URL(origin).host === expectedHost; }
  catch { return false; }
}

