import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fénix Carnes | Centro de pedidos",
  description: "Panel operativo de pedidos recibidos por el agente de IA",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
