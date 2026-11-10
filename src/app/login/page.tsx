import type { Metadata } from "next";
import Image from "next/image";

import "../auth.css";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar | Fénix Carnes" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const notice = params.password === "updated"
    ? "Tu contraseña fue actualizada. Ya puedes iniciar sesión."
    : undefined;
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Image alt="Fénix Carnes" className="auth-logo" height={641} priority src="/logo-fenix.png" width={1200} />
        <h1>Centro de pedidos</h1>
        <p>Ingresa con el usuario que te asignó el administrador.</p>
        {params.recovery === "invalid" && <p className="auth-error">El enlace no es válido o ya venció. Solicita uno nuevo.</p>}
        <LoginForm notice={notice} />
      </section>
    </main>
  );
}
