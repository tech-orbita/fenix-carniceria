"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { parseOrderTextDetailed } from "@/lib/orders/product-parser";

type Notice = { kind: "idle" | "loading" | "error" | "success"; message?: string };
type BusinessOption = { customerId: number; businessName: string };
const exampleOrder = `3 lb blanda
4 lb blanda
2 lb molida especial`;

export function WholesaleOrderForm({ demo = false }: { demo?: boolean }) {
  const [businessName, setBusinessName] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [customerNotice, setCustomerNotice] = useState<Notice>({ kind: "idle" });
  const [phone, setPhone] = useState("");
  const [orderText, setOrderText] = useState("");
  const [notes, setNotes] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [notice, setNotice] = useState<Notice>({ kind: "idle" });
  const [receipt, setReceipt] = useState<string | null>(null);
  const [registrationRequired, setRegistrationRequired] = useState(false);
  const parsed = useMemo(() => parseOrderTextDetailed(orderText), [orderText]);

  function changePhone(value: string) {
    setPhone(value);
    if (!demo) {
      setBusinessName("");
      setCustomerId(null);
      setBusinesses([]);
      setRegistrationRequired(false);
      setCustomerNotice({ kind: "idle" });
    }
  }

  async function findBusinesses(): Promise<BusinessOption[] | null> {
    if (demo) return null;
    if (phone.replace(/\D/g, "").length < 8) {
      setCustomerNotice({ kind: "error", message: "Escribe un teléfono válido para buscar tu establecimiento." });
      return null;
    }
    setCustomerNotice({ kind: "loading", message: "Buscando establecimientos registrados…" });
    try {
      const response = await fetch("/api/wholesale-order/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await response.json() as { businesses?: BusinessOption[]; error?: string; registrationRequired?: boolean };
      if (!response.ok) throw new Error(result.error || "No pudimos consultar tus establecimientos.");
      const options = result.businesses ?? [];
      setBusinesses(options);
      setRegistrationRequired(result.registrationRequired === true);
      if (options.length === 1) {
        setCustomerId(options[0].customerId);
        setBusinessName(options[0].businessName);
        setCustomerNotice({ kind: "success", message: `Establecimiento encontrado: ${options[0].businessName}.` });
      } else if (options.length > 1) {
        setCustomerId(null);
        setBusinessName("");
        setCustomerNotice({ kind: "success", message: "Encontramos varios establecimientos. Elige para cuál vas a pedir." });
      } else {
        setCustomerId(null);
        setBusinessName("");
        setCustomerNotice({ kind: "error", message: "No encontramos un cliente mayorista registrado con este teléfono." });
      }
      return options;
    } catch (error) {
      setCustomerNotice({ kind: "error", message: error instanceof Error ? error.message : "No pudimos consultar tus establecimientos." });
      return null;
    }
  }

  function selectBusiness(value: string) {
    const selectedId = Number(value);
    const selected = businesses.find((business) => business.customerId === selectedId);
    setCustomerId(selected?.customerId ?? null);
    setBusinessName(selected?.businessName ?? "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.items.length) {
      setNotice({ kind: "error", message: "Escribe al menos un producto para poder revisar el pedido." });
      return;
    }
    let resolvedCustomerId = customerId;
    let resolvedBusinessName = businessName;
    if (!demo && !resolvedCustomerId) {
      const options = await findBusinesses();
      if (!options?.length) return;
      if (options.length > 1) {
        setNotice({ kind: "error", message: "Elige el establecimiento antes de enviar el pedido." });
        return;
      }
      resolvedCustomerId = options[0].customerId;
      resolvedBusinessName = options[0].businessName;
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
        body: JSON.stringify({ idempotencyKey, customerId: resolvedCustomerId, businessName: resolvedBusinessName, phone, orderText, notes }),
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
      <ul><li>Cada línea de tu pedido se guardó por separado.</li><li>La ruta asignada al establecimiento se aplicó automáticamente.</li></ul>
      <button className="portal-primary-button" onClick={reset} type="button">Hacer otro pedido</button>
    </section>
  );

  return (
    <section className="wholesale-order-card order-card">
      <header className="portal-single-header"><span>Pedido mayorista</span><h2>Datos y pedido en un solo formulario</h2><p>Escribe tu teléfono y cargaremos tus establecimientos registrados. Si tienes más de uno, podrás elegir para cuál vas a pedir.</p></header>
      <form className="portal-order-form" onSubmit={submit}>
        <div className="portal-customer-fields">
          <label><span>Teléfono / WhatsApp</span><input autoComplete="tel" inputMode="tel" maxLength={30} onBlur={() => { if (!demo && phone && customerNotice.kind === "idle") void findBusinesses(); }} onChange={(event) => changePhone(event.target.value)} placeholder="Ej. 300 123 4567" required value={phone} /></label>
          {demo ? <label><span>Nombre del establecimiento</span><input autoComplete="organization" maxLength={160} onChange={(event) => setBusinessName(event.target.value)} placeholder="Ej. Tienda Colonial" required value={businessName} /></label>
            : businesses.length > 1 ? <label><span>Elige el establecimiento</span><select onChange={(event) => selectBusiness(event.target.value)} required value={customerId ?? ""}><option value="">Selecciona un establecimiento</option>{businesses.map((business) => <option key={business.customerId} value={business.customerId}>{business.businessName}</option>)}</select></label>
              : <label><span>Establecimiento</span><input aria-describedby="customer-lookup-status" readOnly value={businessName} placeholder="Se cargará con tu teléfono" /></label>}
        </div>
        {!demo && customerNotice.message ? <p className={`portal-customer-notice is-${customerNotice.kind}`} id="customer-lookup-status" role={customerNotice.kind === "error" ? "alert" : "status"}>{customerNotice.message}</p> : null}
        {!demo && registrationRequired ? <p className="portal-registration-required"><Link href="/registro-mayorista">Registrarme como cliente mayorista</Link></p> : null}
        <label className="portal-free-order"><span>Escribe tu pedido</span><small>Escribe primero la cantidad y después el producto. Usa una línea nueva para cada producto. Si necesitas el mismo producto con cantidades diferentes, escríbelo nuevamente en otra línea.</small><textarea maxLength={6000} onChange={(event) => setOrderText(event.target.value)} placeholder={exampleOrder} required rows={8} value={orderText} /></label>
        <section className="portal-order-preview" aria-live="polite">
          <header><div><span>Revisión antes de enviar</span><h3>Así recibiremos tu pedido</h3></div><strong>{parsed.items.length} {parsed.items.length === 1 ? "producto" : "productos"}</strong></header>
          {parsed.items.length ? <ol>{parsed.items.map((item, index) => <li key={`${index}-${item.product_name}`}><b>{item.quantity || "Sin cantidad"}{item.quantity ? ` ${item.unit === "cantidad" ? "" : item.unit}` : ""}</b><span>{item.product_name}{item.preparation ? ` · ${item.preparation}` : ""}</span></li>)}</ol> : <p>Tu pedido aparecerá aquí organizado para que puedas revisarlo antes de enviarlo.</p>}
          {parsed.unresolved.length > 0 && <p className="portal-preview-warning">Revisa estas líneas: {parsed.unresolved.join(" · ")}</p>}
        </section>
        <div className="portal-details-grid"><label className="portal-wide"><span>Observaciones <small>opcional</small></span><textarea maxLength={2000} onChange={(event) => setNotes(event.target.value)} placeholder="Indicaciones generales para preparar el pedido" rows={3} value={notes} /></label></div>
        {notice.message && <p className={`portal-notice is-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.message}</p>}
        {demo && registrationRequired ? <p className="portal-registration-required"><Link href="/registro-mayorista">Registrarme como cliente mayorista</Link></p> : null}
        <div className="portal-submit-row"><p>Antes de enviar, revisa que las cantidades y los productos estén correctos.</p><button className="portal-primary-button" disabled={notice.kind === "loading"} type="submit">{notice.kind === "loading" ? "Revisando…" : demo ? "Probar envío" : "Enviar pedido"}</button></div>
      </form>
    </section>
  );
}
