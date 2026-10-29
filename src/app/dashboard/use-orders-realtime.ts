"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

import type { CustomerType } from "./types";

// Escucha los canales privados de Supabase Realtime (uno por segmento) que emite la base
// de datos cuando cambian los pedidos, y vuelve a pedir los datos al servidor. RLS sobre
// realtime.messages impide que un operador escuche el segmento que no tiene asignado.
export function useOrdersRealtime(customerTypes: CustomerType[]) {
  const router = useRouter();
  const topicsKey = customerTypes.join(",");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playNewOrderSound = useCallback(() => {
    if (!soundEnabledRef.current) return;
    const context = audioContextRef.current;
    if (!context || context.state !== "running") return;
    const now = context.currentTime;
    for (const [index, frequency] of [659.25, 783.99].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * 0.18;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    }
  }, []);

  const toggleSound = useCallback(async () => {
    if (soundEnabledRef.current) {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      return;
    }
    const AudioContextConstructor = window.AudioContext;
    const context = audioContextRef.current ?? new AudioContextConstructor();
    audioContextRef.current = context;
    await context.resume();
    soundEnabledRef.current = true;
    setSoundEnabled(true);
    playNewOrderSound();
  }, [playNewOrderSound]);

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
    const handleChange = (message: { payload?: { table?: string; operation?: string } }) => {
      if (message.payload?.table === "orders" && message.payload.operation?.toUpperCase() === "INSERT") {
        playNewOrderSound();
      }
      scheduleRefresh();
    };
    const channels: ReturnType<typeof supabase.channel>[] = [];

    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      for (const customerType of topicsKey.split(",")) {
        let connectedBefore = false;
        channels.push(supabase
          .channel(`orders:${customerType}`, { config: { private: true } })
          .on("broadcast", { event: "changed" }, handleChange)
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
  }, [playNewOrderSound, router, topicsKey]);

  return { soundEnabled, toggleSound };
}
