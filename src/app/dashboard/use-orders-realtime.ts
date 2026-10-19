"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

import type { CustomerType } from "./types";

// Escucha los canales privados de Supabase Realtime (uno por segmento) que emite la base
// de datos cuando cambian los pedidos, y vuelve a pedir los datos al servidor. RLS sobre
// realtime.messages impide que un operador escuche el segmento que no tiene asignado.
export function useOrdersRealtime(customerTypes: CustomerType[]) {
  const router = useRouter();
  const topicsKey = customerTypes.join(",");

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return;
    const supabase = createClient();
    let timeout: number | undefined;
    let cancelled = false;
    const scheduleRefresh = () => {
      // Agrupa ráfagas de cambios (p. ej. todas las cantidades de una fila) en un solo refresco.
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => router.refresh(), 300);
    };
    const channels: ReturnType<typeof supabase.channel>[] = [];

    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      for (const customerType of topicsKey.split(",")) {
        let connectedBefore = false;
        channels.push(supabase
          .channel(`orders:${customerType}`, { config: { private: true } })
          .on("broadcast", { event: "changed" }, scheduleRefresh)
          .subscribe((status) => {
            // Al reconectar se pudieron perder avisos: refresca para quedar al día.
            if (status === "SUBSCRIBED" && connectedBefore) scheduleRefresh();
            if (status === "SUBSCRIBED") connectedBefore = true;
          }));
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [router, topicsKey]);
}
