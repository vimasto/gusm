import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, MoveUpRight } from "lucide-react";
import { clsx } from "clsx";
import { LandingSection } from "@/components/LandingSection";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "GYMU · Hazte espacio",
  description:
    "Reserva tu bloque en la Sala de Musculación UTFSM Concepción. Hazte espacio para entrenar con GYMU.",
};

export default function RootPage() {
  return (
    <div className="flex min-h-svh w-full justify-center bg-bg">
      <div className={clsx("gusm-app-shell", styles.landing)}>
        <header className="flex h-24 items-center justify-between gap-6">
          <span className={styles.wordmark}>GYMU</span>
          <Link
            href="/login"
            prefetch={false}
            className={clsx(styles.link, "gap-2 text-base font-semibold")}
          >
            Ingresar <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
        </header>
        <main>
          <section className={styles.hero} aria-labelledby="landing-title">
            <div className={styles.heroCopy}>
              <h1 id="landing-title" className={styles.headline}>
                Hazte
                <br />
                <span>espacio.</span>
              </h1>
              <p className="mt-6 max-w-80 text-base leading-7 text-muted">
                Reserva tu bloque en la Sala de Musculación UTFSM Concepción.
              </p>
              <Link
                href="/login"
                prefetch={false}
                className={clsx(
                  styles.link,
                  styles.cta,
                  "mt-7 bg-accent-fill text-accent-foreground",
                )}
              >
                Ingresar <ArrowUpRight size={25} strokeWidth={1.8} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.sculpture} aria-hidden="true">
              <div className={styles.orbit} />
              <Image
                src="/landing/weight-sculpture.webp"
                width={1200}
                height={1200}
                alt=""
                sizes="(min-width: 1024px) 620px, (min-width: 520px) 480px, calc(100vw - 40px)"
                loading="eager"
                fetchPriority="high"
                className={styles.sculptureImage}
              />
            </div>
          </section>
          <LandingSection
            className={clsx(styles.sequence, styles.reveal)}
            aria-label="Cómo funciona GYMU"
          >
            <p className="mb-9 max-w-64 text-sm leading-6 text-muted">
              Un espacio en tu día.
              <br />
              Tres pasos para estar aquí.
            </p>
            <ol className={styles.steps}>
              <li className={styles.step}>
                <h2>
                  Reserva<span aria-hidden="true">.</span>
                </h2>
                <p>Elige el día y el bloque que calzan contigo.</p>
              </li>
              <li className={styles.step}>
                <h2>
                  Confirma<span aria-hidden="true">.</span>
                </h2>
                <p>
                  Confirma entre cuatro y una hora antes. Si reservas en la última hora, ya queda
                  confirmado.
                </p>
              </li>
              <li className={styles.step}>
                <h2>
                  Entrena<span aria-hidden="true">.</span>
                </h2>
                <p>Presenta tu QR en los primeros 15 minutos del bloque. La sala te espera.</p>
              </li>
            </ol>
          </LandingSection>
          <LandingSection
            className={clsx(styles.streak, styles.reveal)}
            aria-labelledby="streak-title"
          >
            <div className={styles.streakCopy}>
              <h2 id="streak-title">
                Tu constancia
                <br />
                <span className="text-accent">cuenta.</span>
              </h2>
              <p className="mt-6 max-w-80 text-base leading-7 text-muted">
                Una asistencia por semana hace crecer tu racha. Encuentra tu ritmo y vuelve a la
                sala.
              </p>
            </div>
            <div className={styles.weekArtwork} aria-hidden="true">
              <div className={styles.weekTrail} />
              <div className={styles.week}>
                <Check strokeWidth={1.5} />
                <span>Semana</span>
              </div>
              <div className={styles.week}>
                <Check strokeWidth={1.5} />
                <span>Otra más</span>
              </div>
              <div className={styles.week}>
                <MoveUpRight strokeWidth={1.5} />
                <span>Y sigues.</span>
              </div>
            </div>
          </LandingSection>
        </main>
        <footer className={styles.footer}>
          <div>
            <span className={styles.footerBrand} aria-hidden="true">
              GYMU
            </span>
            <p className="mt-4 text-sm leading-6 text-muted">
              Sala de Musculación
              <br />
              UTFSM Concepción
            </p>
          </div>
          <Link
            href="/terminos"
            prefetch={false}
            className={clsx(styles.link, "text-base text-muted")}
          >
            Términos de uso <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </footer>
      </div>
    </div>
  );
}
