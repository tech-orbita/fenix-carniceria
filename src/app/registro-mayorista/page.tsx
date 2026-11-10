import type { Metadata } from "next";
import Image from "next/image";

import "./registration.css";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = {
  title: "Inscripción mayorista | Fénix Carnes",
  description: "Registra los datos de tu negocio para comprar como cliente mayorista de Fénix Carnes.",
};

export default function WholesaleRegistrationPage() {
  return (
    <main className="registration-page">
      <div className="registration-shell">
        <header className="registration-brand">
          <div className="registration-logo-frame">
            <Image alt="Fénix Carnes" className="registration-logo" height={160} priority src="/logo-fenix-bn.svg" width={300} />
          </div>
          <span className="registration-kicker">Calidad · Frescura · Compromiso</span>
          <h1>Inscripción de clientes mayoristas</h1>
          <p>Registra tu negocio con anticipación y agiliza tus próximos pedidos, entregas y facturación.</p>
          <ul className="registration-benefits" aria-label="Beneficios del registro">
            <li><b>01</b><span>Un solo registro</span></li>
            <li><b>02</b><span>Atención más rápida</span></li>
            <li><b>03</b><span>Pedidos organizados</span></li>
          </ul>
        </header>
        <section className="registration-card">
          <header><span>Formulario de inscripción</span><h2>Cuéntanos sobre tu negocio</h2><p>Completa los campos marcados con *. Te tomará menos de 3 minutos.</p></header>
          <RegistrationForm />
        </section>
        <footer className="registration-contact">¿Necesitas ayuda? Escríbenos por el canal habitual de Fénix Carnes.</footer>
      </div>
    </main>
  );
}
