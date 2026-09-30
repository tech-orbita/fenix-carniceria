import Link from "next/link";

import { login, signup } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;

  return (
    <main className="shell grid min-h-screen place-items-center py-12">
      <section className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl shadow-zinc-200/50">
        <Link className="text-sm font-semibold text-orange-700" href="/">
          ← Volver al inicio
        </Link>
        <h1 className="mt-6 text-3xl font-bold">Acceso</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Inicia sesión o crea tu cuenta de Pedidos Fenix.
        </p>

        {error ? (
          <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}

        <form className="mt-6 space-y-4">
          <label className="block text-sm font-semibold" htmlFor="email">
            Correo
          </label>
          <input
            autoComplete="email"
            className="field"
            id="email"
            name="email"
            placeholder="tu@empresa.com"
            required
            type="email"
          />

          <label className="block text-sm font-semibold" htmlFor="password">
            Contraseña
          </label>
          <input
            autoComplete="current-password"
            className="field"
            id="password"
            minLength={6}
            name="password"
            required
            type="password"
          />

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button className="button" formAction={login}>
              Entrar
            </button>
            <button className="button secondary" formAction={signup}>
              Crear cuenta
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
