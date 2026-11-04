"use client";

import { useState, type FormEvent } from "react";

type Status = { kind: "idle" | "loading" | "success" | "error"; message?: string };

export function RegistrationForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "loading", message: "Registrando tus datos…" });
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: data.get("name"),
      businessName: data.get("businessName"),
      taxId: data.get("taxId"),
      phone: data.get("phone"),
      email: data.get("email"),
      address: data.get("address"),
      neighborhood: data.get("neighborhood"),
      city: data.get("city"),
      requiresInvoice: data.get("requiresInvoice") === "on",
      consent: data.get("consent") === "on",
      website: data.get("website"),
    };
    try {
      const response = await fetch("/api/wholesale-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "No pudimos completar la inscripción.");
      setStatus({ kind: "success", message: result.message || "Tu inscripción quedó registrada." });
      form.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "No pudimos completar la inscripción." });
    }
  }

  if (status.kind === "success") {
    return (
      <section className="registration-success" role="status">
        <span aria-hidden="true">✓</span>
        <h2>¡Listo! Ya recibimos tus datos</h2>
        <p>{status.message}</p>
        <p className="registration-success-note">El equipo de Fénix podrá encontrarte en el sistema con el teléfono y correo que registraste.</p>
      </section>
    );
  }

  return (
    <form className="registration-form" onSubmit={submit}>
      <div className="registration-section-heading">
        <span>01</span><div><h2>Datos del titular</h2><p>La persona con quien coordinaremos pedidos y entregas.</p></div>
      </div>
      <div className="registration-grid">
        <label><span>Nombre completo *</span><input autoComplete="name" maxLength={120} name="name" placeholder="Ej. María González" required /></label>
        <label><span>Nombre del negocio *</span><input autoComplete="organization" maxLength={140} name="businessName" placeholder="Ej. Restaurante La Esquina" required /></label>
        <label><span>NIT o cédula *</span><input inputMode="text" maxLength={30} name="taxId" placeholder="Con dígito de verificación, si aplica" required /></label>
        <label><span>Teléfono / WhatsApp *</span><input autoComplete="tel" inputMode="tel" maxLength={30} name="phone" placeholder="Ej. 300 123 4567" required /></label>
        <label className="registration-wide"><span>Correo electrónico *</span><input autoComplete="email" maxLength={180} name="email" placeholder="nombre@negocio.com" required type="email" /></label>
      </div>

      <div className="registration-section-heading">
        <span>02</span><div><h2>Ubicación del negocio</h2><p>Usaremos estos datos para coordinar la ruta de entrega.</p></div>
      </div>
      <div className="registration-grid">
        <label className="registration-wide"><span>Dirección completa *</span><input autoComplete="street-address" maxLength={220} name="address" placeholder="Calle, carrera, número y referencia" required /></label>
        <label><span>Barrio *</span><input autoComplete="address-level3" maxLength={100} name="neighborhood" placeholder="Ej. El Prado" required /></label>
        <label><span>Ciudad o municipio *</span><input autoComplete="address-level2" defaultValue="Barranquilla" maxLength={100} name="city" required /></label>
      </div>

      <div className="registration-section-heading">
        <span>03</span><div><h2>Facturación y autorización</h2><p>Confirma cómo debemos preparar tu información comercial.</p></div>
      </div>
      <div className="registration-checks">
        <label><input name="requiresInvoice" type="checkbox" /><span><strong>Requiero factura electrónica</strong><small>La factura se emitirá con el NIT o cédula registrado arriba.</small></span></label>
        <label><input name="consent" required type="checkbox" /><span><strong>Autorizo el tratamiento de mis datos *</strong><small>Para gestionar mi inscripción, pedidos y comunicaciones comerciales con Fénix Carnes.</small></span></label>
      </div>
      <label className="registration-honeypot" aria-hidden="true">Sitio web<input autoComplete="off" name="website" tabIndex={-1} /></label>

      {status.kind === "error" && <p className="registration-message is-error" role="alert">{status.message}</p>}
      {status.kind === "loading" && <p className="registration-message" role="status">{status.message}</p>}
      <button className="registration-submit" disabled={status.kind === "loading"} type="submit">
        {status.kind === "loading" ? "Registrando…" : "Completar inscripción"}<span aria-hidden="true">→</span>
      </button>
      <p className="registration-footnote">Tus datos se guardan de forma segura. Si ya estás registrado, actualizaremos tu información sin crear duplicados.</p>
    </form>
  );
}
