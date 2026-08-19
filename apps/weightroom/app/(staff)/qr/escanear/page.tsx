"use client";

import { useEffect, useRef, useState } from "react";
import { QrCode, ScanLine } from "lucide-react";

type ScannerState =
  | "idle"
  | "scanning"
  | "checked_in"
  | "already_present"
  | "no_current_booking"
  | "invalid_token"
  | "token_used"
  | "token_expired"
  | "error";
type ScannerAccess = "loading" | "authorized" | "forbidden";

const SCANNER_MESSAGES: Record<Exclude<ScannerState, "idle" | "scanning">, string> = {
  checked_in: "Asistencia registrada.",
  already_present: "La asistencia ya estaba registrada.",
  no_current_booking: "No existe una reserva confirmada para el bloque actual.",
  invalid_token: "El código leído no es un QR de asistencia válido.",
  token_used: "Este código QR ya fue utilizado.",
  token_expired: "Este código QR expiró. Pide a la persona que lo actualice.",
  error: "No fue posible procesar la lectura. Intenta nuevamente.",
};

function getStatusClassName(state: ScannerState) {
  if (state === "checked_in" || state === "already_present") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  }

  if (state === "idle" || state === "scanning") {
    return "border-accent/30 bg-accent/10 text-accent";
  }

  return "border-rose-400/30 bg-rose-400/10 text-rose-300";
}

export default function CheckInScannerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [payload, setPayload] = useState("");
  const [scannerState, setScannerState] = useState<ScannerState>("idle");
  const [scannerAccess, setScannerAccess] = useState<ScannerAccess>("loading");

  useEffect(() => {
    let isCancelled = false;

    async function loadScannerAccess() {
      try {
        const response = await fetch("/api/current-user", { cache: "no-store" });
        const body: unknown = await response.json();

        if (isCancelled) return;

        if (response.ok && isStaffContext(body)) {
          setScannerAccess("authorized");
        } else {
          setScannerAccess("forbidden");
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("[CHECK_IN_SCANNER] could not verify staff access.", error);
          setScannerAccess("forbidden");
        }
      }
    }

    void loadScannerAccess();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (scannerAccess !== "authorized") return;
    inputRef.current?.focus();
  }, [scannerAccess, scannerState]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payload) return;

    setScannerState("scanning");

    try {
      const response = await fetch("/api/qr/scan", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const body: unknown = await response.json();

      if (!response.ok || !isScannerResponse(body)) {
        throw new Error("The scanner endpoint returned an invalid response.");
      }

      setScannerState(body.state);
    } catch (error) {
      console.error("[CHECK_IN_SCANNER] could not process QR payload.", error);
      setScannerState("error");
    } finally {
      setPayload("");
    }
  }

  const statusMessage =
    scannerState === "idle"
      ? "Esperando una lectura del escáner Zebra."
      : scannerState === "scanning"
        ? "Procesando lectura…"
        : SCANNER_MESSAGES[scannerState];

  return (
    <main className="flex min-h-svh w-full justify-center bg-bg">
      <div className="flex min-h-svh gusm-app-shell flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex size-16 items-center justify-center rounded-3xl border border-accent/30 bg-accent/10 text-accent">
          <QrCode className="size-8" aria-hidden="true" />
        </div>
        <p className="mt-6 text-sm font-medium tracking-[0.16em] text-accent uppercase">
          Estación de staff
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-100">Registrar asistencia</h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
          Mantén esta vista abierta. El Zebra USB envía el QR como teclado y confirma con Enter.
        </p>

        {scannerAccess === "authorized" && (
          <>
            <form onSubmit={handleSubmit} className="mt-8 w-full max-w-sm">
              <label htmlFor="qr-payload" className="sr-only">
                Contenido del QR
              </label>
              <input
                ref={inputRef}
                id="qr-payload"
                value={payload}
                onChange={(event) => setPayload(event.target.value)}
                onFocus={() => setScannerState("idle")}
                autoComplete="off"
                className="gusm-input-primary w-full text-center font-mono"
                placeholder="Esperando lectura…"
              />
            </form>

            <div
              role="status"
              className={`mt-5 flex w-full max-w-sm items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm ${getStatusClassName(scannerState)}`}
            >
              <ScanLine className="size-4 shrink-0" aria-hidden="true" />
              <span>{statusMessage}</span>
            </div>
          </>
        )}

        {scannerAccess === "loading" && (
          <p className="mt-8 text-base text-muted">Verificando acceso de la estación…</p>
        )}

        {scannerAccess === "forbidden" && (
          <p role="alert" className="mt-8 max-w-sm text-base text-rose-300">
            Esta estación requiere una sesión vigente de gym staff o administrador.
          </p>
        )}
      </div>
    </main>
  );
}

function isScannerResponse(
  value: unknown,
): value is { state: Exclude<ScannerState, "idle" | "scanning" | "error"> } {
  if (!value || typeof value !== "object" || !("state" in value)) return false;

  return (
    value.state === "checked_in" ||
    value.state === "already_present" ||
    value.state === "no_current_booking" ||
    value.state === "invalid_token" ||
    value.state === "token_used" ||
    value.state === "token_expired"
  );
}

function isStaffContext(value: unknown): value is { role: "gym_staff" | "admin" } {
  if (!value || typeof value !== "object" || !("role" in value)) return false;

  return value.role === "gym_staff" || value.role === "admin";
}
