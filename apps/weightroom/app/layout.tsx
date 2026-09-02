import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { clsx } from "clsx";
import { QueryProvider } from "@/components/QueryProvider";

const montserrat = localFont({
  src: "./fonts/Montserrat-VariableFont_wght.ttf",
  variable: "--font-montserrat",
  weight: "100 900",
  display: "swap",
});

const THEME_INITIALIZATION_SCRIPT = `(() => {
  try {
    const storedTheme = window.localStorage.getItem("gymu.theme");
    const theme = storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();`;

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
    <html
      lang="es"
      className={`${montserrat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className={clsx(
          "flex flex-col items-center justify-center scroll-smooth font-sans",
          "min-h-svh w-full bg-bg text-foreground antialiased",
        )}
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
      <Script id="initialize-theme" strategy="beforeInteractive">
        {THEME_INITIALIZATION_SCRIPT}
      </Script>
    </html>
  );
}
