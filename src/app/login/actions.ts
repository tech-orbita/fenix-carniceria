"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function credentials(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    redirect("/login?error=Completa%20el%20correo%20y%20la%20contrase%C3%B1a");
  }

  if (!email.includes("@") || password.length < 6) {
    redirect("/login?error=Revisa%20los%20datos%20ingresados");
  }

  return { email, password };
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials(formData));

  if (error) {
    redirect("/login?error=No%20fue%20posible%20iniciar%20sesi%C3%B3n");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const { error } = await supabase.auth.signUp({
    ...credentials(formData),
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect("/login?error=No%20fue%20posible%20crear%20la%20cuenta");
  }

  revalidatePath("/", "layout");
  redirect(
    "/login?message=Revisa%20tu%20correo%20para%20confirmar%20la%20cuenta",
  );
}
