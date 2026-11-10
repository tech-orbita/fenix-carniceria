"use server";

import { validateNewPassword } from "@/lib/auth/password";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordState = { ok?: boolean; message?: string };

export async function changeOwnPassword(_state: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const viewer = await requireViewer();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  const validation = validateNewPassword(password, confirmation);
  if (!currentPassword) return { ok: false, message: "Escribe tu contraseña actual." };
  if (validation) return { ok: false, message: validation };
  if (currentPassword === password) return { ok: false, message: "La nueva contraseña debe ser diferente a la actual." };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: viewer.email, password: currentPassword });
  if (signInError) return { ok: false, message: "La contraseña actual no es correcta." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: "No fue posible actualizar la contraseña." };
  return { ok: true, message: "Contraseña actualizada correctamente." };
}
