"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { parseOrderTextDetailed } from "@/lib/orders/product-parser";

type Notice = { kind: "idle" | "loading" | "error" | "success"; message?: string };
const exampleOrder = `3 lb blanda
4 lb blanda
2 lb molida especial`;

export function WholesaleOrderForm({ demo = false }: { demo?: boolean }) {
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderText, setOrderText] = useState("");
  const [notes, setNotes] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [notice, setNotice] = useState<Notice>({ kind: "idle" });
  const [receipt, setReceipt] = useState<string | null>(null);
  const [registrationRequired, setRegistrationRequired] = useState(false);
  const parsed = useMemo(() => parseOrderTextDetailed(orderText), [orderText]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.items.length) {
      setNotice({ kind: "error", message: "Escribe al menos un producto para poder revisar el pedido." });
      return;
    }
    setRegistrationRequired(false);
    setNotice({ kind: "loading", message: demo ? "Comprobando la prueba…" : "Guardando tu pedido…" });
    if (demo) {
      try {
        const response = await fetch("https://fenix-carniceria.vercel.app/api/wholesale-order/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessName, phone, orderText, notes, items: parsed.items, variant: "free_text", testAccess: "620ec1f64681e8ea2cac222a21601638d79caf8a6ec3d4a6" }),
        });
        const result = await response.json() as { error?: string; orderNumber?: string };
        if (!response.ok || !result.orderNumber) throw new Error(result.error || "No pudimos guardar la prueba.");
        setReceipt(result.orderNumber);
        setNotice({ kind: "success", message: "Prueba guardada en el panel con la marca PRUEBA." });
      } catch (error) {
        setNotice({ kind: "error", message: error instanceof Error ? error.message : "No pudimos guardar la prueba." });
      }
      return;
    }
    try {
      const response = await fetch("/api/wholesale-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey, businessName, phone, orderText, notes }),
      });
      const result = await response.json() as { error?: string; orderNumber?: string; registrationRequired?: boolean };
      setRegistrationRequired(result.registrationRequired === true);
      if (!response.ok || !result.orderNumber) throw new Error(result.error || "No pudimos guardar el pedido.");
      setReceipt(result.orderNumber);
      setNotice({ kind: "success", message: "Pedido guardado correctamente." });
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "No pudimos guardar el pedido." });
    }
  }

  function reset() {
    setOrderText(""); setNotes(""); setIdempotencyKey(crypto.randomUUID()); setReceipt(null); setRegistrationRequired(false); setNotice({ kind: "idle" });
  }

  if (receipt) return (
    <section className="wholesale-order-card portal-receipt" role="status">
        <span className="portal-receipt-check">✓</span><p>{demo ? "Prueba visible en el panel" : "Pedido recibido"}</p><h2>{receipt}</h2><strong>{businessName}</strong>
      <ul><li>Los renglones repetidos se conservaron por separado.</li><li>La ruta asignada al establecimiento se aplicó automáticamente.</li></ul>
      <button className="portal-primary-button" onClick={reset} type="button">Hacer otro pedido</button>
    </section>
  );

  return (
    <section className="wholesale-order-card order-card">
      <header className="portal-single-header"><span>Pedido mayorista</span><h2>Datos y pedido en un solo formulario</h2><p>El establecimiento y el teléfono se validan juntos. Una misma persona puede pedir para negocios diferentes sin que se mezclen.</p></header>
      <form className="portal-order-form" onSubmit={submit}>
        <div className="portal-customer-fields">
          <label><span>Nombre del establecimiento</span><input autoComplete="organization" maxLength={160} onChange={(event) => setBusinessName(event.target.value)} placeholder="Ej. Tienda Colonial" required value={businessName} /></label>
          <label><span>Teléfono / WhatsApp</span><input autoComplete="tel" inputMode="tel" maxLength={30} onChange={(event) => setPhone(event.target.value)} placeholder="Ej. 300 123 4567" required value={phone} /></label>
        </div>
        <label className="portal-free-order"><span>Escribe tu pedido</span><small>Puedes escribir como lo haces hoy. Para mayor precisión, usa un producto por renglón. Si repites un producto, cada renglón se conserva.</small><textarea maxLength={6000} onChange={(event) => setOrderText(event.target.value)} placeholder={exampleOrder} required rows={8} value={orderText} /></label>
        <section className="portal-order-preview" aria-live="polite">
          <header><div><span>Revisión antes de enviar</span><h3>Así recibiremos tu pedido</h3></div><strong>{parsed.items.length} {parsed.items.length === 1 ? "renglón" : "renglones"}</strong></header>
          {parsed.items.length ? <ol>{parsed.items.map((item, index) => <li key={`${index}-${item.product_name}`}><b>{item.quantity || "Sin cantidad"}{item.quantity ? ` ${item.unit === "cantidad" ? "" : item.unit}` : ""}</b><span>{item.product_name}{item.preparation ? ` · ${item.preparation}` : ""}</span></li>)}</ol> : <p>Escribe el pedido arriba y aquí podrás revisarlo antes de aprobar el envío.</p>}
          {parsed.unresolved.length > 0 && <p className="portal-preview-warning">Revisa estas líneas: {parsed.unresolved.join(" · ")}</p>}
        </section>
        <div className="portal-details-grid"><label className="portal-wide"><span>Observaciones <small>opcional</small></span><textarea maxLength={2000} onChange={(event) => setNotes(event.target.value)} placeholder="Indicaciones generales para preparar el pedido" rows={3} value={notes} /></label></div>
        {notice.message && <p className={`portal-notice is-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.message}</p>}
        {registrationRequired ? <p className="portal-registration-required"><Link href="/registro-mayorista">Registrarme como cliente mayorista</Link></p> : null}
        <div className="portal-submit-row"><p>Comprueba el resumen antes de enviar. No necesitas escoger productos de una lista.</p><button className="portal-primary-button" disabled={notice.kind === "loading"} type="submit">{notice.kind === "loading" ? "Revisando…" : demo ? "Probar envío" : "Enviar pedido"}</button></div>
      </form>
    </section>
  );
}
