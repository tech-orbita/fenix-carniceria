import type { Metadata } from "next";
import Image from "next/image";

import "../auth.css";
import { RecoveryForm } from "./recovery-form";

export const metadata: Metadata = { title: "Recuperar contraseña | Fénix Carnes" };

export default function RecoverPasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Image alt="Fénix Carnes" className="auth-logo" height={641} priority src="/logo-fenix.png" width={1200} />
        <h1>Recuperar contraseña</h1>
        <p>Escribe el correo de tu usuario y te enviaremos un enlace seguro.</p>
        <RecoveryForm />
      </section>
    </main>
  );
}
