import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grado Derecho",
  description: "Plataforma de práctica para examen de grado de Derecho",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CL">
      <body>{children}</body>
    </html>
  );
}
