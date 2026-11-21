"use client";

import { useMemo, useState, type FormEvent } from "react";

type Product = { name: string; category: string; defaultUnit?: "kg" | "und" };
type Row = { id: string; productName: string; quantity: string; unit: "cantidad" | "kg" | "lb" | "und"; preparation: string };
type Notice = { kind: "idle" | "loading" | "error" | "success"; message?: string };

const initialRow: Row = { id: "row-1", productName: "", quantity: "", unit: "lb", preparation: "" };
const createRow = (): Row => ({ ...initialRow, id: crypto.randomUUID() });

export function CatalogOrderForm({ demo = false, products }: { demo?: boolean; products: Product[] }) {
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [rows, setRows] = useState<Row[]>([initialRow]);
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [notice, setNotice] = useState<Notice>({ kind: "idle" });
  const [receipt, setReceipt] = useState<string | null>(null);
  const categories = useMemo(() => [...new Set(products.map((product) => product.category))], [products]);

  function updateRow(id: string, field: keyof Omit<Row, "id">, value: string) {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      if (field === "productName") {
        const product = products.find((candidate) => candidate.name === value);
        return { ...row, productName: value, unit: product?.defaultUnit ?? row.unit };
      }
      return { ...row, [field]: value };
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice({ kind: "loading", message: "Comprobando la prueba…" });
    if (demo) {
      try {
        const response = await fetch("https://fenix-carniceria.vercel.app/api/wholesale-order/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessName,
            phone,
            notes,
            paymentProofName: proof?.name,
            variant: "catalog",
            testAccess: "620ec1f64681e8ea2cac222a21601638d79caf8a6ec3d4a6",
            items: rows.map((row) => ({ productName: row.productName, quantity: Number(row.quantity), unit: row.unit, preparation: row.preparation })),
          }),
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
    setNotice({ kind: "error", message: "Esta versión está disponible únicamente para revisión." });
  }

  function reset() {
    setRows([createRow()]); setNotes(""); setProof(null); setReceipt(null); setNotice({ kind: "idle" });
  }

  if (receipt) return (
    <section className="wholesale-order-card portal-receipt" role="status">
      <span className="portal-receipt-check">✓</span><p>Prueba visible en el panel</p><h2>{receipt}</h2><strong>{businessName}</strong>
      <ul><li>Se conservaron {rows.length} renglones de productos.</li>{proof ? <li>El comprobante quedó incluido en la simulación.</li> : null}</ul>
      <button className="portal-primary-button" onClick={reset} type="button">Hacer otra prueba</button>
    </section>
  );

  return (
    <section className="wholesale-order-card order-card">
      <header className="portal-single-header"><span>Opción A · catálogo</span><h2>Datos y pedido en una sola pantalla</h2><p>Esta opción reduce errores de nombres porque cada producto se escoge de la lista.</p></header>
      <form className="portal-order-form" onSubmit={submit}>
        <div className="portal-customer-fields">
          <label><span>Nombre del establecimiento</span><input autoComplete="organization" maxLength={160} onChange={(event) => setBusinessName(event.target.value)} placeholder="Ej. Tienda Colonial" required value={businessName} /></label>
          <label><span>Teléfono / WhatsApp</span><input autoComplete="tel" inputMode="tel" maxLength={30} onChange={(event) => setPhone(event.target.value)} placeholder="Ej. 300 123 4567" required value={phone} /></label>
        </div>
        <div className="portal-section-title"><div><span>Productos</span><h3>Un producto por renglón</h3></div><p>El mismo producto puede agregarse varias veces con cantidades o preparaciones diferentes.</p></div>
        <div className="portal-lines">
          {rows.map((row, index) => (
            <fieldset className="portal-line" key={row.id}>
              <legend>Renglón {index + 1}</legend>
              <label className="portal-product"><span>Producto</span><select onChange={(event) => updateRow(row.id, "productName", event.target.value)} required value={row.productName}><option value="">Escoge un producto</option>{categories.map((category) => <optgroup key={category} label={category}>{products.filter((product) => product.category === category).map((product) => <option key={`${category}-${product.name}`} value={product.name}>{product.name}</option>)}</optgroup>)}</select></label>
              <label><span>Cantidad</span><input inputMode="decimal" max="10000" min="0.001" onChange={(event) => updateRow(row.id, "quantity", event.target.value)} placeholder="Ej. 3" required step="0.001" type="number" value={row.quantity} /></label>
              <label><span>Unidad</span><select onChange={(event) => updateRow(row.id, "unit", event.target.value)} value={row.unit}><option value="lb">Libras</option><option value="kg">Kilos</option><option value="und">Unidades</option><option value="cantidad">Sin unidad</option></select></label>
              <label className="portal-preparation"><span>Preparación o detalle</span><input maxLength={250} onChange={(event) => updateRow(row.id, "preparation", event.target.value)} placeholder="Ej. limpio, ancho, relajado" value={row.preparation} /></label>
              {rows.length > 1 ? <button aria-label={`Eliminar renglón ${index + 1}`} className="portal-remove-line" onClick={() => setRows((current) => current.filter((candidate) => candidate.id !== row.id))} type="button">Eliminar</button> : null}
            </fieldset>
          ))}
        </div>
        <button className="portal-add-line" onClick={() => setRows((current) => [...current, createRow()])} type="button">+ Agregar otro renglón</button>
        <div className="portal-details-grid">
          <label className="portal-wide"><span>Observaciones <small>opcional</small></span><textarea maxLength={2000} onChange={(event) => setNotes(event.target.value)} placeholder="Indicaciones generales para preparar el pedido" rows={3} value={notes} /></label>
          <label className="portal-upload portal-wide"><span>Comprobante de pago <small>opcional</small></span><input accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setProof(event.target.files?.[0] ?? null)} type="file" /><small>JPG, PNG, WEBP o PDF · máximo 8 MB. Recibirlo no confirma el pago.</small></label>
        </div>
        {notice.message ? <p className={`portal-notice is-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.message}</p> : null}
        <div className="portal-submit-row"><p>Revisa los renglones antes de probar el envío.</p><button className="portal-primary-button" disabled={notice.kind === "loading"} type="submit">{notice.kind === "loading" ? "Revisando…" : "Probar envío"}</button></div>
      </form>
    </section>
  );
}
