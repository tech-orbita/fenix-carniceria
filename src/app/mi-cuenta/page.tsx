import type { Metadata } from "next";
import Link from "next/link";

import { requireViewer } from "@/lib/auth/viewer";

import "../auth.css";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi contraseña | Fénix Carnes" };

export default async function MyAccountPage() {
  const viewer = await requireViewer();
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-back-link" href="/">← Volver al panel</Link>
        <h1>Cambiar mi contraseña</h1>
        <p>{viewer.email}</p>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
