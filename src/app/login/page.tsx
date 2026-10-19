import type { Metadata } from "next";
import Image from "next/image";

import "../auth.css";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar | Fénix Carnes" };

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Image alt="Fénix Carnes" className="auth-logo" height={641} priority src="/logo-fenix.png" width={1200} />
        <h1>Centro de pedidos</h1>
        <p>Ingresa con el usuario que te asignó el administrador.</p>
        <LoginForm />
      </section>
    </main>
  );
}
