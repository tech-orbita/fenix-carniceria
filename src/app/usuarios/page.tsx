import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/viewer";
import type { PanelRole } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";

import "../auth.css";
import type { CustomerType } from "../dashboard/types";
import { signOut } from "../login/actions";
import { UsersManager } from "./users-manager";
import type { PanelUserRow } from "./users-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Usuarios | Fénix Carnes" };

export default async function UsersPage() {
  const viewer = await requireAdmin();
  const admin = createAdminClient();
  const [{ data: access }, { data: authUsers }] = await Promise.all([
    admin.from("panel_users").select("user_id, role, customer_type, created_at").order("created_at"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const emails = new Map((authUsers?.users ?? []).map((user) => [user.id, user.email ?? ""]));
  const users: PanelUserRow[] = (access ?? []).map((row) => ({
    userId: row.user_id,
    email: emails.get(row.user_id) ?? "(sin correo)",
    role: row.role as PanelRole,
    customerType: (row.customer_type as CustomerType | null) ?? null,
  }));

  return (
    <main className="users-page">
      <header className="users-header">
        <h1>Usuarios del panel</h1>
        <div className="session-bar">
          <span>{viewer.email} · Administrador</span>
          <Link href="/mi-cuenta">Mi contraseña</Link>
          <Link href="/">Volver al panel</Link>
          <form action={signOut}><button type="submit">Salir</button></form>
        </div>
      </header>
      <UsersManager currentUserId={viewer.userId} users={users} />
    </main>
  );
}
