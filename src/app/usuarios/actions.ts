"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/viewer";
import type { PanelRole } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";

import type { CustomerType } from "../dashboard/types";

type Result = { ok: boolean; message: string };

const roles: PanelRole[] = ["admin", "operator"];
const customerTypes: CustomerType[] = ["retail", "wholesale"];

function validAccess(role: PanelRole, customerType: CustomerType | null) {
  if (!roles.includes(role)) return false;
  return role === "admin" ? customerType === null : customerType !== null && customerTypes.includes(customerType);
}

function validPassword(password: string) {
  return typeof password === "string" && password.length >= 8 && password.length <= 72;
}

export async function createPanelUser(input: { email: string; password: string; role: PanelRole; customerType: CustomerType | null }): Promise<Result> {
  await requireAdmin();
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Escribe un correo válido." };
  if (!validPassword(input.password)) return { ok: false, message: "La contraseña debe tener al menos 8 caracteres." };
  if (!validAccess(input.role, input.customerType)) return { ok: false, message: "Elige el rol y, para operadores, el segmento." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password: input.password, email_confirm: true });
  if (error || !data.user) {
    return { ok: false, message: error?.code === "email_exists" ? "Ya existe un usuario con ese correo." : "No se pudo crear el usuario." };
  }

  const { error: accessError } = await admin.from("panel_users").insert({ user_id: data.user.id, role: input.role, customer_type: input.customerType });
  if (accessError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, message: "No se pudo asignar el rol al usuario." };
  }

  revalidatePath("/usuarios");
  return { ok: true, message: `Usuario ${email} creado.` };
}

export async function updatePanelUserAccess(userId: string, role: PanelRole, customerType: CustomerType | null): Promise<Result> {
  const viewer = await requireAdmin();
  if (!validAccess(role, customerType)) return { ok: false, message: "Elige el rol y, para operadores, el segmento." };
  if (userId === viewer.userId && role !== "admin") return { ok: false, message: "No puedes quitarte tu propio rol de administrador." };

  const { error } = await createAdminClient()
    .from("panel_users")
    .upsert({ user_id: userId, role, customer_type: customerType });
  if (error) return { ok: false, message: "No se pudo actualizar el acceso." };

  revalidatePath("/usuarios");
  return { ok: true, message: "Acceso actualizado." };
}

export async function resetPanelUserPassword(userId: string, password: string): Promise<Result> {
  await requireAdmin();
  if (!validPassword(password)) return { ok: false, message: "La contraseña debe tener al menos 8 caracteres." };
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, message: "No se pudo cambiar la contraseña." };
  return { ok: true, message: "Contraseña actualizada." };
}

export async function deletePanelUser(userId: string): Promise<Result> {
  const viewer = await requireAdmin();
  if (userId === viewer.userId) return { ok: false, message: "No puedes eliminar tu propio usuario." };
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) return { ok: false, message: "No se pudo eliminar el usuario." };

  revalidatePath("/usuarios");
  return { ok: true, message: "Usuario eliminado." };
}
