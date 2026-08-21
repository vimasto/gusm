"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function TermsPage() {
  const [acceptanceError, setAcceptanceError] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const router = useRouter();

  async function acceptCurrentTerms() {
    setAcceptanceError(false);
    setIsAccepting(true);

    try {
      const response = await fetch("/api/terms/accept", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptCurrentTerms: true }),
      });

      if (response.status !== 204) {
        setAcceptanceError(true);
        setIsAccepting(false);
        return;
      }

      router.replace("/reserva");
    } catch {
      setAcceptanceError(true);
      setIsAccepting(false);
    }
  }

  return (
    <main className="relative flex min-h-full gusm-app-shell flex-col gap-8 px-8 py-12">
      <header className="flex flex-col gap-3">
        <p className="text-sm tracking-[0.16em] text-accent uppercase">GYMU · versión 2</p>
        <h1 className="text-2xl font-semibold text-foreground">Términos y condiciones</h1>
        <p className="text-base leading-6 text-muted">Sala de Musculación UTFSM Concepción</p>
      </header>

      <article className="flex flex-col gap-5 rounded-2xl border border-accent/15 px-5 py-5 text-sm leading-6 text-muted">
        <p className="text-justify">
          GYMU es la aplicación de gestión y reserva de la Sala de Musculación UTFSM Concepción,
          desarrollada por estudiantes de Ingeniería Informática, autorizada y respaldada por el
          DEFIDER.
        </p>

        <section>
          <h2 className="text-base font-semibold text-foreground">Datos tratados</h2>
          <p className="text-justify">
            Para gestionar la Sala de Musculación, GYMU trata los datos necesarios para tu cuenta,
            rol, reservas, confirmaciones, asistencias, inasistencias y advertencias operativas.
            Durante la autenticación institucional se verifican tus credenciales mediante un
            servicio perteneciente a la universidad. GYMU no almacena tu RUT ni tu correo
            institucional completo; conserva solo el identificador institucional anterior a
            <span aria-label="arroba"> @</span> cuando es necesario para la operación y las métricas
            internas.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Datos voluntarios de perfil</h2>
          <p className="text-justify">
            Puedes proporcionar voluntariamente tu fecha de nacimiento, sexo declarado, altura y
            peso. Estos datos se usan para tu perfil, estadísticas de participación y análisis
            operativo. No se utilizan para diagnósticos médicos ni para decisiones automatizadas
            sobre tu acceso a la Sala de Musculación. Puedes omitirlos sin afectar la reserva
            básica.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Finalidades y acceso</h2>
          <p className="text-justify">
            DEFIDER podrá utilizar los datos para administrar cupos, asistencia y funcionamiento de
            la Sala de Musculación, además de elaborar métricas, informes y presentaciones
            operativas. Estas se elaborarán preferentemente con información agregada o anonimizada.
            El acceso a información identificable estará limitado al personal autorizado según sus
            funciones.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Protección y uso de datos</h2>
          <p className="text-justify">
            Tus datos JAMÁS serán vendidos, arrendados ni cedidos con fines comerciales o no
            comerciales. Solo podrán ser tratados por personas o sistemas que participen en la
            operación institucional de GYMU, sujetos a controles de acceso y a las finalidades aquí
            informadas.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Tus derechos</h2>
          <p className="text-justify">
            Puedes solicitar información, rectificación, actualización o eliminación de tus datos
            personales, según corresponda, escribiendo a
            <a
              href="mailto:javier.mellan@usm.cl"
              className="text-accent underline underline-offset-2"
            >
              {" "}
              javier.mellan@usm.cl
            </a>
            . Una solicitud de eliminación puede estar limitada por la conservación necesaria de
            registros operativos, estadísticos o exigidos por normativa aplicable.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Aceptación y actualizaciones</h2>
          <p className="text-justify">
            Al seleccionar “He leído y acepto”, declaras haber revisado estos términos y autorizas
            el tratamiento descrito para las finalidades señaladas. La aceptación registra la fecha
            y versión vigente. Si los términos cambian, solicitaremos una nueva aceptación antes de
            permitir el acceso.
          </p>
        </section>
      </article>

      {acceptanceError && (
        <p role="alert" className="text-sm text-rose-500">
          No fue posible registrar tu aceptación. Intenta nuevamente.
        </p>
      )}

      <button
        type="button"
        disabled={isAccepting}
        onClick={acceptCurrentTerms}
        className="flex gusm-button-primary items-center justify-center gap-2 disabled:cursor-not-allowed"
      >
        {isAccepting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Registrando…
          </>
        ) : (
          "He leído y acepto"
        )}
      </button>
    </main>
  );
}
