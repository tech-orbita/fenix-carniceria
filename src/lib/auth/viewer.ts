import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { CustomerType } from "@/app/dashboard/types";

export type PanelRole = "admin" | "operator";

export type Viewer = {
  userId: string;
  email: string;
  role: PanelRole;
  // Segmento asignado; null significa ambos para administradores u operadores globales.
  customerType: CustomerType | null;
};

// Usuario autenticado y su acceso al panel. Devuelve null si no hay sesión y
// "no-access" si el usuario existe pero no está registrado en panel_users.
export const getViewer = cache(async (): Promise<Viewer | "no-access" | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const { data } = await supabase
    .from("panel_users")
    .select("role, customer_type")
    .eq("user_id", claims.sub)
    .maybeSingle();
  if (!data) return "no-access";

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    role: data.role as PanelRole,
    customerType: (data.customer_type as CustomerType | null) ?? null,
  };
});

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer === "no-access") redirect("/sin-acceso");
  return viewer;
}

export async function requireAdmin() {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") redirect("/");
  return viewer;
}

export function canAccess(viewer: Viewer, customerType: CustomerType) {
  return viewer.role === "admin" || viewer.customerType === null || viewer.customerType === customerType;
}
