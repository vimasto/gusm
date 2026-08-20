import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { clsx } from "clsx";

const montserrat = localFont({
  src: "./fonts/Montserrat-VariableFont_wght.ttf",
  variable: "--font-montserrat",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GYMU",
  description: "Gestión de la Sala de Musculación UTFSM Concepción",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${montserrat.variable} h-full antialiased`}>
      <body
        className={clsx(
          "flex flex-col items-center justify-center scroll-smooth font-sans",
          "min-h-svh w-full bg-bg text-neutral-100 antialiased",
        )}
      >
        {children}
      </body>
    </html>
  );
}
