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
      <aside className="registration-intro">
        <Image alt="Fénix Carnes" className="registration-logo" height={80} priority src="/logo-fenix-bn.svg" width={150} />
        <div className="registration-intro-copy">
          <span className="registration-kicker">Clientes mayoristas</span>
          <h1>Todo listo para hacer negocios juntos.</h1>
          <p>Registra tu negocio con anticipación y agiliza tus próximos pedidos, entregas y facturación.</p>
        </div>
        <ol className="registration-benefits">
          <li><b>1</b><span><strong>Un solo registro</strong><small>Actualizamos tus datos sin crear contactos repetidos.</small></span></li>
          <li><b>2</b><span><strong>Atención más rápida</strong><small>Tu información queda disponible para nuestro equipo mayorista.</small></span></li>
          <li><b>3</b><span><strong>Pedidos organizados</strong><small>Dirección y facturación preparadas desde el primer pedido.</small></span></li>
        </ol>
        <p className="registration-contact">¿Necesitas ayuda? Escríbenos por el canal habitual de Fénix Carnes.</p>
      </aside>
      <section className="registration-card">
        <header><span>Formulario de inscripción</span><h2>Cuéntanos sobre tu negocio</h2><p>Completa los campos marcados con *. Te tomará menos de 3 minutos.</p></header>
        <RegistrationForm />
      </section>
    </main>
  );
}
