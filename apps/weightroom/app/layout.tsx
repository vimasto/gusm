import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { clsx } from "clsx";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Student",
  description: "Gusm student",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} h-full antialiased`}>
      <body
        className={clsx(
          "flex flex-col items-center justify-center scroll-smooth font-sans",
          "min-h-svh min-w-full bg-neutral-950 text-neutral-100 antialiased",
        )}
      >
        {children}
      </body>
    </html>
  );
}
