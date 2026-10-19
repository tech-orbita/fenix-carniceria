import "../auth.css";
import { signOut } from "../login/actions";

export default function NoAccessPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Sin acceso al panel</h1>
        <p>Tu usuario no tiene un rol asignado. Pide al administrador que te dé acceso.</p>
        <form action={signOut}><button className="auth-submit" type="submit">Cerrar sesión</button></form>
      </section>
    </main>
  );
}
