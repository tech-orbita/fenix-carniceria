import Link from "next/link";

export default function Home() {
  return (
    <main className="shell flex min-h-screen flex-col justify-center py-16">
      <div className="max-w-3xl">
        <span className="mb-5 inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
          Base técnica lista
        </span>
        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
          Pedidos Fenix
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
          Proyecto iniciado con Next.js 16, autenticación SSR de Supabase y
          despliegue preparado para Vercel.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="button" href="/login">
            Iniciar sesión
          </Link>
          <Link className="button secondary" href="/dashboard">
            Abrir panel
          </Link>
        </div>
      </div>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          ["Next.js", "App Router, TypeScript y Tailwind CSS"],
          ["Supabase", "Base de datos y Auth con sesiones en cookies"],
          ["Vercel", "Proyecto enlazado para despliegues desde GitHub"],
        ].map(([title, description]) => (
          <article
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
            key={title}
          >
            <h2 className="font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
