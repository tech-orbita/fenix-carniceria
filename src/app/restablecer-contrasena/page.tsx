import type { Metadata } from "next";
import Image from "next/image";

import "../auth.css";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Nueva contraseña | Fénix Carnes" };

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Image alt="Fénix Carnes" className="auth-logo" height={641} priority src="/logo-fenix.png" width={1200} />
        <h1>Crea una nueva contraseña</h1>
        <p>Usa entre 8 y 72 caracteres y evita compartirla con otras personas.</p>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
