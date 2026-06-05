"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import clsx from "clsx";
import { cva } from "class-variance-authority";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type LoginStatus =
  | "idle"
  | "loading"
  | "error_credentials"
  | "error_network"
  | "success";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK — dominios institucionales
// TODO: reemplazar con query a tabla `domains` en Supabase
//       SELECT value, label FROM email_domains WHERE active = true ORDER BY sort_order
// ─────────────────────────────────────────────────────────────────────────────

type EmailDomain = { value: string; label: string };

const MOCK_DOMAINS: EmailDomain[] = [
  { value: "usm.cl", label: "usm.cl" },
  { value: "sansano.usm.cl", label: "sansano.usm.cl" },
  { value: "postgrado.usm.cl", label: "postgrado.usm.cl" },
];

const DEFAULT_DOMAIN = MOCK_DOMAINS[0]!.value;

// ─────────────────────────────────────────────────────────────────────────────
// MOCK — credenciales de prueba
// TODO: reemplazar submit con supabase.auth.signInWithPassword({ email, password })
//       El middleware leerá app_metadata.role del JWT y hará redirect() al
//       route group correspondiente: (user)/readonly | (staff)/dashboard | etc.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_VALID_EMAIL = "ivan.gallardo@usm.cl";
const MOCK_DELAY_MS = 1400;

// ─────────────────────────────────────────────────────────────────────────────
// CVA — variantes del botón de submit
// ─────────────────────────────────────────────────────────────────────────────

const submitButtonVariants = cva(
  "w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed",
  {
    variants: {
      status: {
        idle: "bg-accent text-black",
        loading: "bg-accent/40 text-black/40",
        error_credentials: "bg-accent text-black",
        error_network: "bg-accent text-black",
        success: "bg-accent/50 text-black/50",
      },
    },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Mensajes de error por estado
// ─────────────────────────────────────────────────────────────────────────────

const ERROR_MESSAGES: Partial<Record<LoginStatus, string>> = {
  error_credentials: "Correo o contraseña incorrectos.",
  error_network: "Sin conexión. Verifica tu red e intenta de nuevo.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[9px] text-zinc-600 tracking-[0.18em] uppercase mb-1.5 px-0.5">
      {children}
    </span>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/[.06] border border-red-500/20">
      <AlertTriangle size={12} className="text-red-400 shrink-0 mt-px" />
      <span className="text-[11px] text-red-400">{message}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginView
// ─────────────────────────────────────────────────────────────────────────────

export default function LoginView() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [domain, setDomain] = useState(DEFAULT_DOMAIN);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [status, setStatus] = useState<LoginStatus>("idle");

  const email = `${username.trim().toLowerCase()}@${domain}`;
  const isLoading = status === "loading";
  const isSuccess = status === "success";
  const isDisabled = isLoading || isSuccess || !username.trim() || !password;
  const isError = status === "error_credentials" || status === "error_network";
  const errorMsg = ERROR_MESSAGES[status];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (isDisabled) return;

    setStatus("loading");

    // TODO: reemplazar con supabase.auth.signInWithPassword({ email, password })
    setTimeout(() => {
      if (email === MOCK_VALID_EMAIL) {
        setStatus("success");
        setTimeout(() => router.push("/booking"), 500);
      } else {
        setStatus("error_credentials");
      }
    }, MOCK_DELAY_MS);
  }

  function handleFieldChange(): void {
    if (isError) setStatus("idle");
  }

  function toggleShowPass(): void {
    setShowPass((p) => !p);
  }

  return (
    <div className="min-h-dvh flex justify-center bg-neutral-950">
      <div className="w-full max-w-[520px] min-h-dvh flex flex-col bg-black">
        {/* ── Área central ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-center px-8 py-12">
          {/* ── Identidad ──────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-accent/10 border border-accent/20">
              <Dumbbell size={22} className="text-accent" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-zinc-400 tracking-[0.22em] uppercase">
                Sala de Musculación
              </span>
              <span className="text-[9px] text-zinc-700 tracking-[0.15em] uppercase">
                UTFSM
              </span>
            </div>
          </div>

          {/* ── Formulario ─────────────────────────────────────────────────── */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-5"
            noValidate
          >
            {/* Correo — usuario + @ + dominio ─────────────────────────────── */}
            <div>
              <FieldLabel>Correo institucional</FieldLabel>

              <div
                className={clsx(
                  "flex items-center bg-input rounded-xl border transition-colors duration-150",
                  "focus-within:border-accent/40",
                  isError
                    ? "border-red-500/30 focus-within:border-red-500/50"
                    : "border-zinc-800",
                  (isLoading || isSuccess) && "opacity-50",
                )}
              >
                <input
                  type="text"
                  autoComplete="username"
                  placeholder="usuario"
                  value={username}
                  disabled={isLoading || isSuccess}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    handleFieldChange();
                  }}
                  className="flex-1 min-w-0 bg-transparent px-4 py-3 text-sm text-zinc-300 outline-none placeholder:text-zinc-700 disabled:cursor-not-allowed"
                />

                <span className="shrink-0 text-sm text-zinc-600 select-none">
                  @
                </span>

                <div className="shrink-0 w-px h-5 bg-zinc-800 mx-1" />

                <div className="relative shrink-0 flex items-center pr-3">
                  <select
                    value={domain}
                    disabled={isLoading || isSuccess}
                    onChange={(e) => {
                      setDomain(e.target.value);
                      handleFieldChange();
                    }}
                    className="appearance-none bg-transparent py-3 pl-2 pr-5 text-sm text-zinc-400 outline-none cursor-pointer disabled:cursor-not-allowed"
                  >
                    {MOCK_DOMAINS.map((d) => (
                      <option
                        key={d.value}
                        value={d.value}
                        className="bg-zinc-900 text-zinc-300"
                      >
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
                  />
                </div>
              </div>
            </div>

            {/* Contraseña ──────────────────────────────────────────────────── */}
            <div>
              <FieldLabel>Contraseña</FieldLabel>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  disabled={isLoading || isSuccess}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    handleFieldChange();
                  }}
                  className={clsx(
                    "w-full bg-input rounded-xl px-4 py-3 pr-11 text-sm text-zinc-300 outline-none",
                    "border transition-colors duration-150 placeholder:text-zinc-700",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isError
                      ? "border-red-500/30 focus:border-red-500/50"
                      : "border-zinc-800 focus:border-accent/40",
                  )}
                />
                <button
                  type="button"
                  onClick={toggleShowPass}
                  disabled={isLoading || isSuccess}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-40"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {errorMsg && <ErrorBanner message={errorMsg} />}

            <button
              type="submit"
              disabled={isDisabled}
              className={submitButtonVariants({ status })}
            >
              {isLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span className="text-[13px]">Verificando…</span>
                </>
              ) : (
                <span className="text-[13px] tracking-wide">Ingresar</span>
              )}
            </button>
          </form>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-8 pb-10 text-center">
          <p className="text-[10px] text-zinc-800 leading-relaxed">
            <a
              href="https://github.com/vimasto"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-800 hover:text-zinc-600 transition-colors"
            >
              Repositorio.
            </a>{" "}
            <span className="text-zinc-600">
              Creado para la comunidad Sansana de Concepción.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
