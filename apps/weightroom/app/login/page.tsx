"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { EXTERNAL_LINK_PROPS } from "@gusm/utils/link";
import { EmailDomainSelect } from "@/components/EmailDomainSelect";
import { IconGithub } from "@/components/icons";
import { LoginAnimalImage } from "@/components/LoginAnimalImage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DEFAULT_EMAIL_DOMAIN, EMAIL_DOMAINS, GITHUB_VIMASTO_ORG_URL } from "@/constants";
import {
  LOGIN_ERROR_RESPONSE_SCHEMA,
  LOGIN_REQUEST_SCHEMA,
  type LoginRequest,
} from "@/lib/auth/login";
import { clearQueryCache } from "@/lib/query-client";
import type { ThemePreference } from "@/lib/theme";
type LoginButtonStatus = "idle" | "loading" | "error_credentials" | "error_network" | "success";

const SUBMIT_BUTTON_VARIANTS = cva(
  "gusm-button-primary flex w-full items-center justify-center gap-2 active:scale-[0.98] disabled:cursor-not-allowed",
  {
    variants: {
      status: {
        idle: "bg-accent-fill text-accent-foreground",
        loading: "bg-accent-fill/40 text-accent-foreground/40",
        error_credentials: "bg-accent-fill text-accent-foreground",
        error_network: "bg-accent-fill text-accent-foreground",
        success: "bg-accent-fill/50 text-accent-foreground/50",
      },
    },
  },
);

export default function LoginPage() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loginSucceeded, setLoginSucceeded] = useState(false);
  const [loginThemePreference, setLoginThemePreference] = useState<ThemePreference | null>(null);

  const router = useRouter();

  const {
    clearErrors,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<LoginRequest>({
    resolver: zodResolver(LOGIN_REQUEST_SCHEMA),
    reValidateMode: "onChange",
    defaultValues: {
      domain: DEFAULT_EMAIL_DOMAIN,
      username: "",
      password: "",
    },
  });

  const formDisabled = isSubmitting || loginSucceeded;
  const emailErrorMessage = errors.username?.message ?? errors.domain?.message;
  const buttonStatus: LoginButtonStatus = isSubmitting
    ? "loading"
    : loginSucceeded
      ? "success"
      : errors.root?.credentials
        ? "error_credentials"
        : errors.root?.network
          ? "error_network"
          : "idle";

  function clearRootError() {
    clearErrors("root");
  }

  function togglePasswordVisibility() {
    setPasswordVisible(!passwordVisible);
  }

  async function handleLoginSubmit(loginRequest: LoginRequest) {
    clearErrors("root");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...loginRequest,
          ...(loginThemePreference ? { themePreference: loginThemePreference } : {}),
        }),
      });

      if (response.status === 204) {
        clearQueryCache();
        setLoginSucceeded(true);
        const termsAcceptanceRequired =
          response.headers.get("X-GUSM-Terms-Acceptance-Required") === "true";
        router.replace(termsAcceptanceRequired ? "/terminos" : "/reserva");
        return;
      }

      const responsePayload: unknown = await response
        .json()
        .catch(function ignoreInvalidResponse() {
          return null;
        });
      const parsedError = LOGIN_ERROR_RESPONSE_SCHEMA.safeParse(responsePayload);

      if (parsedError.success && parsedError.data.code === "invalid_credentials") {
        setError("root.credentials", {
          type: "server",
          message: "Correo o contraseña incorrectos.",
        });
      } else if (parsedError.success && parsedError.data.code === "institutional_profile_invalid") {
        setError("root.network", {
          type: "server",
          message:
            "El servidor no entregó una ficha institucional válida. Intenta nuevamente más tarde.",
        });
      } else if (
        parsedError.success &&
        parsedError.data.code === "institutional_response_invalid"
      ) {
        setError("root.network", {
          type: "server",
          message: "El servidor devolvió una respuesta inesperada. Intenta nuevamente más tarde.",
        });
      } else if (
        parsedError.success &&
        parsedError.data.code === "institutional_session_rejected"
      ) {
        setError("root.credentials", {
          type: "server",
          message: "El servidor rechazó la sesión. Verifica tus credenciales e intenta nuevamente.",
        });
      } else if (
        parsedError.success &&
        parsedError.data.code === "institutional_service_unavailable"
      ) {
        setError("root.network", {
          type: "server",
          message:
            "El servidor institucional no está disponible. Puede estar caído o en mantenimiento. Intenta nuevamente más tarde.",
        });
      } else if (parsedError.success && parsedError.data.code === "rate_limited") {
        setError("root.network", {
          type: "server",
          message: "Demasiados intentos. Espera un momento antes de volver a intentarlo.",
        });
      } else if (parsedError.success && parsedError.data.code === "account_disabled") {
        setError("root.credentials", {
          type: "server",
          message: "Tu acceso a la Sala de Musculación está deshabilitado.",
        });
      } else {
        setError("root.network", {
          type: "server",
          message: "No fue posible verificar tus credenciales. Intenta nuevamente.",
        });
      }
    } catch {
      setError("root.network", {
        type: "server",
        message: "No fue posible conectar con el servicio de autenticación.",
      });
    }
  }

  return (
    <div className="flex min-h-svh w-full justify-center bg-bg">
      <main className="relative flex min-h-svh gusm-app-shell flex-col items-center justify-center gap-12 px-8 py-12">
        <ThemeToggle
          className="absolute top-4 right-4"
          onThemePreferenceSelect={setLoginThemePreference}
        />
        <header className="flex flex-col items-center gap-3">
          <div className="size-42">
            <LoginAnimalImage />
          </div>

          <div className="flex flex-col items-center gap-1">
            <h1 className="text-base text-foreground-muted">Sala de Musculación</h1>
            <p className="text-sm text-muted uppercase">UTFSM</p>
          </div>
        </header>

        <form
          noValidate
          onSubmit={handleSubmit(handleLoginSubmit)}
          aria-busy={isSubmitting}
          className="flex w-full flex-1 flex-col gap-5"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="username" className="flex flex-col gap-1">
              <span className="text-sm text-muted">Correo institucional</span>

              <span className="flex w-full">
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  inputMode="text"
                  placeholder="nombre"
                  disabled={formDisabled}
                  aria-invalid={Boolean(emailErrorMessage)}
                  aria-describedby={emailErrorMessage ? "username-error" : undefined}
                  className={clsx(
                    "gusm-input-primary w-full rounded-r-none",
                    emailErrorMessage && "border-rose-700/60 focus-visible:border-rose-700/60",
                  )}
                  {...register("username", { onChange: clearRootError })}
                />

                <EmailDomainSelect
                  id="domain"
                  aria-label="Dominio del correo institucional"
                  aria-invalid={Boolean(errors.domain)}
                  disabled={formDisabled}
                  hasError={Boolean(errors.domain)}
                  {...register("domain", { onChange: clearRootError })}
                  domains={EMAIL_DOMAINS}
                />
              </span>
            </label>

            {emailErrorMessage && (
              <span id="username-error" className="text-sm text-rose-500">
                {emailErrorMessage}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="grid gap-1">
              <span className="text-sm text-muted">Contraseña</span>

              <span className="relative">
                <input
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={formDisabled}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  {...register("password", {
                    onChange: clearRootError,
                  })}
                  className={clsx(
                    "gusm-input-primary w-full pr-11",
                    errors.password && "border-rose-700/60 focus-visible:border-rose-700/60",
                  )}
                />

                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  disabled={formDisabled}
                  aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-dim transition-colors hover:text-foreground-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>

              {errors.password?.message && (
                <span id="password-error" className="text-sm text-rose-500">
                  {errors.password.message}
                </span>
              )}
            </label>
          </div>

          {errors.root?.credentials?.message && (
            <span role="alert" className="text-sm text-rose-500">
              {errors.root.credentials.message}
            </span>
          )}

          {errors.root?.network?.message && (
            <span role="alert" className="text-sm text-rose-500">
              {errors.root.network.message}
            </span>
          )}

          <button
            type="submit"
            disabled={formDisabled}
            className={SUBMIT_BUTTON_VARIANTS({ status: buttonStatus })}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Verificando…
              </>
            ) : (
              "Ingresar"
            )}
          </button>
        </form>

        <footer className="flex flex-col items-center gap-2">
          <p className="text-xs text-muted">Creado para la comunidad Sansana de Concepción.</p>

          <Link
            {...EXTERNAL_LINK_PROPS()}
            href={GITHUB_VIMASTO_ORG_URL}
            aria-label="GitHub de Vimasto"
            className="text-muted transition-colors hover:text-foreground-muted"
          >
            <IconGithub className="size-5" />
          </Link>
        </footer>
      </main>
    </div>
  );
}
