"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import * as z from "zod/v4";
import { CheckCircle2, Clock3, RefreshCw, TriangleAlert, XCircle } from "lucide-react";
import { CREATE_SUPABASE_BROWSER_CLIENT } from "@gusm/database/client";
import { clearProfileCache } from "@/lib/profile-cache";
import { UserTopBar } from "@/components/UserTopBar";

const TIMESTAMP_SCHEMA = z.string().refine((value) => !Number.isNaN(Date.parse(value)));
const ISSUE_RESPONSE_SCHEMA = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("ready"),
    tokenId: z.string().uuid(),
    payload: z.string().min(1),
    bookingDate: z.string().date(),
    timeBlockId: z.number().int().positive(),
    expiresAt: TIMESTAMP_SCHEMA,
  }),
  z.object({ state: z.literal("arrived_too_late") }),
  z.object({ state: z.literal("no_current_booking") }),
  z.object({ state: z.literal("outside_window") }),
]);
const STATUS_RESPONSE_SCHEMA = z.object({
  state: z.enum([
    "pending",
    "expired",
    "not_found",
    "checked_in",
    "already_present",
    "no_current_booking",
  ]),
  scannedAt: TIMESTAMP_SCHEMA.nullable(),
});

type QrScreen =
  | { type: "loading" }
  | {
      type: "ready";
      tokenId: string;
      payload: string;
      expiresAt: string;
      timeBlockId: number;
    }
  | { type: "arrived_too_late" }
  | { type: "no_current_booking" }
  | { type: "outside_window" }
  | { type: "error" };
type ScanResult = "checked_in" | "already_present" | "no_current_booking";

const SCAN_RESULT_CONTENT: Record<
  ScanResult,
  { title: string; description: string; icon: typeof CheckCircle2; iconClassName: string }
> = {
  checked_in: {
    title: "Asistencia registrada",
    description: "Tu asistencia quedó marcada para este bloque.",
    icon: CheckCircle2,
    iconClassName: "text-emerald-400",
  },
  already_present: {
    title: "Asistencia ya registrada",
    description: "Tu asistencia para este bloque ya estaba marcada.",
    icon: CheckCircle2,
    iconClassName: "text-accent",
  },
  no_current_booking: {
    title: "No tienes una reserva vigente",
    description: "Comunícate con el staff si necesitas consultar disponibilidad de sobrecupo.",
    icon: XCircle,
    iconClassName: "text-rose-400",
  },
};

function getRemainingSeconds(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatRemainingSeconds(seconds: number) {
  return `00:${seconds.toString().padStart(2, "0")}`;
}

export default function CheckInQrPage() {
  const router = useRouter();
  const issueLockRef = useRef(false);
  const [screen, setScreen] = useState<QrScreen>({ type: "loading" });
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isStatusUnavailable, setIsStatusUnavailable] = useState(false);

  const issueQr = useCallback(async () => {
    if (issueLockRef.current) return;

    issueLockRef.current = true;
    setScreen({ type: "loading" });
    setScanResult(null);
    setIsStatusUnavailable(false);

    try {
      const response = await fetch("/api/qr/issue", {
        method: "POST",
        cache: "no-store",
      });
      const payload: unknown = await response.json();
      const issueResponse = ISSUE_RESPONSE_SCHEMA.safeParse(payload);

      if (!response.ok || !issueResponse.success) {
        throw new Error("The QR issuer returned an invalid response.");
      }

      if (issueResponse.data.state === "ready") {
        setScreen({
          type: "ready",
          tokenId: issueResponse.data.tokenId,
          payload: issueResponse.data.payload,
          expiresAt: issueResponse.data.expiresAt,
          timeBlockId: issueResponse.data.timeBlockId,
        });
      } else {
        setScreen({ type: issueResponse.data.state });
      }
    } catch (error) {
      console.error("[CHECK_IN_QR] could not load a QR token.", error);
      setScreen({ type: "error" });
    } finally {
      issueLockRef.current = false;
    }
  }, []);

  useEffect(() => {
    void issueQr();
  }, [issueQr]);

  useEffect(() => {
    if (screen.type !== "ready" || scanResult) return;
    const activeQr = screen;

    function updateRemainingTime() {
      const nextRemainingSeconds = getRemainingSeconds(activeQr.expiresAt);
      setRemainingSeconds(nextRemainingSeconds);

      if (nextRemainingSeconds === 0) {
        void issueQr();
      }
    }

    updateRemainingTime();
    const intervalId = window.setInterval(updateRemainingTime, 1_000);
    return () => window.clearInterval(intervalId);
  }, [issueQr, scanResult, screen]);

  useEffect(() => {
    if (screen.type !== "ready" || scanResult) return;
    const activeQr = screen;

    let isCancelled = false;

    async function readQrStatus() {
      try {
        const response = await fetch("/api/qr/status", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokenId: activeQr.tokenId }),
        });
        const payload: unknown = await response.json();
        const statusResponse = STATUS_RESPONSE_SCHEMA.safeParse(payload);

        if (isCancelled) return;

        if (!response.ok || !statusResponse.success) {
          setIsStatusUnavailable(true);
          return;
        }

        setIsStatusUnavailable(false);

        if (statusResponse.data.state === "expired" || statusResponse.data.state === "not_found") {
          void issueQr();
        } else if (
          statusResponse.data.state === "checked_in" ||
          statusResponse.data.state === "already_present" ||
          statusResponse.data.state === "no_current_booking"
        ) {
          if (statusResponse.data.state === "checked_in") clearProfileCache();
          setScanResult(statusResponse.data.state);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("[CHECK_IN_QR] could not read QR token status.", error);
          setIsStatusUnavailable(true);
        }
      }
    }

    void readQrStatus();
    const intervalId = window.setInterval(() => void readQrStatus(), 1_250);
    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [issueQr, scanResult, screen]);

  async function signOut() {
    const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[CHECK_IN_QR] could not sign out.", error);
      return;
    }

    clearProfileCache();
    router.replace("/login");
  }

  function dismissScanResult() {
    setScanResult(null);
    void issueQr();
  }

  const scanResultContent = scanResult ? SCAN_RESULT_CONTENT[scanResult] : null;
  const ScanResultIcon = scanResultContent?.icon;

  return (
    <main className="flex min-h-svh w-full justify-center bg-bg">
      <div className="relative flex min-h-svh gusm-app-shell flex-col">
        <header className="sticky top-0 z-20 border-b border-divider bg-surface">
          <UserTopBar
            onBack={() => router.push("/reserva")}
            pageTitle="Asistencia"
            showActiveBookings={false}
            onGoProfile={() => router.push("/perfil")}
            onSignOut={signOut}
          />
        </header>

        <section className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
          {screen.type === "loading" && (
            <div className="flex flex-col items-center gap-4 text-muted">
              <RefreshCw className="size-8 animate-spin text-accent" aria-hidden="true" />
              <p className="text-base">Preparando tu código de asistencia…</p>
            </div>
          )}

          {screen.type === "ready" && (
            <div className="flex w-full flex-col items-center">
              <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
                Bloque {screen.timeBlockId}
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-foreground">Escanea tu código QR</h1>
              <p className="mt-2 max-w-72 text-sm leading-6 text-muted">
                Muéstralo al lector de la sala antes de que el código venza.
              </p>

              <div className="mt-8 rounded-3xl border border-accent/40 bg-accent p-4 shadow-accent">
                <QRCodeSVG
                  value={screen.payload}
                  size={272}
                  level="M"
                  bgColor="#FFFFFF"
                  fgColor="#004B85"
                  includeMargin
                  aria-label="Código QR para registrar asistencia"
                />
              </div>

              <div className="mt-6 flex items-center gap-2 rounded-full border border-divider bg-input px-4 py-2 text-sm text-muted">
                <Clock3 className="size-4 text-accent" aria-hidden="true" />
                <span>Se renueva en {formatRemainingSeconds(remainingSeconds)}</span>
              </div>

              {isStatusUnavailable && (
                <p role="alert" className="mt-4 max-w-72 text-sm leading-6 text-rose-300">
                  No podemos verificar la lectura en este momento. Genera un código nuevo antes de
                  intentar otra vez.
                </p>
              )}

              <button
                type="button"
                onClick={() => void issueQr()}
                className="mt-5 flex items-center gap-2 text-base font-medium text-accent transition-colors hover:text-accent/75"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Generar otro código
              </button>
              <p className="mt-2 max-w-72 text-xs leading-5 text-dim">
                Si el lector no respondió, este código se invalida de inmediato.
              </p>
            </div>
          )}

          {screen.type === "arrived_too_late" && (
            <QrNotice
              icon={TriangleAlert}
              title="Has llegado tarde"
              description="Conversa con el staff para solicitar autorización presencial."
              actionLabel="Volver a reservas"
              onAction={() => router.push("/reserva")}
            />
          )}

          {screen.type === "no_current_booking" && (
            <QrNotice
              icon={XCircle}
              title="No tienes una reserva vigente"
              description="Revisa tus reservas o conversa con el staff si estás en la sala."
              actionLabel="Volver a reservas"
              onAction={() => router.push("/reserva")}
            />
          )}

          {screen.type === "outside_window" && (
            <QrNotice
              icon={Clock3}
              title="El QR aún no está disponible"
              description="Puedes marcar asistencia desde el inicio hasta 15 minutos después del comienzo de tu bloque confirmado."
              actionLabel="Actualizar"
              onAction={() => void issueQr()}
            />
          )}

          {screen.type === "error" && (
            <QrNotice
              icon={TriangleAlert}
              title="No fue posible preparar el QR"
              description="Revisa tu conexión e inténtalo nuevamente."
              actionLabel="Reintentar"
              onAction={() => void issueQr()}
            />
          )}
        </section>

        {scanResultContent && ScanResultIcon && (
          <div className="absolute inset-x-0 bottom-0 z-30 flex min-h-[calc(100%-4.5rem)] items-center justify-center bg-bg/80 px-6 backdrop-blur-sm">
            <section className="w-full max-w-sm rounded-3xl border border-divider bg-surface p-6 text-center shadow-2xl">
              <ScanResultIcon
                className={`mx-auto size-12 ${scanResultContent.iconClassName}`}
                aria-hidden="true"
              />
              <h2 className="mt-4 text-xl font-semibold text-foreground">
                {scanResultContent.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">{scanResultContent.description}</p>
              <button
                type="button"
                onClick={dismissScanResult}
                className="mt-6 w-full gusm-button-primary"
              >
                Entendido
              </button>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

type QrNoticeProps = {
  icon: typeof Clock3;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

function QrNotice({ icon: Icon, title, description, actionLabel, onAction }: QrNoticeProps) {
  return (
    <div className="flex max-w-sm flex-col items-center">
      <Icon className="size-11 text-accent" aria-hidden="true" />
      <h1 className="mt-5 text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
      <button type="button" onClick={onAction} className="mt-7 w-full gusm-button-primary">
        {actionLabel}
      </button>
    </div>
  );
}
