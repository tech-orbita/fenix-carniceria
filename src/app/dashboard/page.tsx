import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  const email =
    typeof data.claims.email === "string" ? data.claims.email : "Usuario";

  return (
    <main className="shell min-h-screen py-12">
      <nav className="flex items-center justify-between">
        <Link className="font-bold" href="/">
          Pedidos Fenix
        </Link>
        <form action={logout}>
          <button className="button secondary" type="submit">
            Cerrar sesión
          </button>
        </form>
      </nav>

      <section className="mt-16 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <span className="text-sm font-semibold text-emerald-700">
          Sesión verificada
        </span>
        <h1 className="mt-3 text-4xl font-bold">Panel de pedidos</h1>
        <p className="mt-3 text-zinc-600">
          Conectado como <strong>{email}</strong>.
        </p>
        <p className="mt-8 rounded-2xl bg-zinc-50 p-5 text-sm leading-6 text-zinc-600">
          La infraestructura está lista. El siguiente paso será definir el
          modelo de pedidos, sedes, productos y permisos con políticas RLS.
        </p>
      </section>
    </main>
  );
}
