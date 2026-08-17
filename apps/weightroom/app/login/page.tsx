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
import { DEFAULT_EMAIL_DOMAIN, EMAIL_DOMAINS, GITHUB_VIMASTO_ORG_URL } from "@/constants";
import {
  LOGIN_ERROR_RESPONSE_SCHEMA,
  LOGIN_REQUEST_SCHEMA,
  type LoginRequest,
} from "@/lib/auth/login";
type LoginButtonStatus = "idle" | "loading" | "error_credentials" | "error_network" | "success";

const SUBMIT_BUTTON_VARIANTS = cva(
  "gusm-button-primary flex w-full items-center justify-center gap-2 active:scale-[0.98] disabled:cursor-not-allowed",
  {
    variants: {
      status: {
        idle: "bg-accent text-neutral-950",
        loading: "bg-accent/40 text-neutral-950/40",
        error_credentials: "bg-accent text-neutral-950",
        error_network: "bg-accent text-neutral-950",
        success: "bg-accent/50 text-neutral-950/50",
      },
    },
  },
);

export default function LoginPage() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loginSucceeded, setLoginSucceeded] = useState(false);

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
        body: JSON.stringify(loginRequest),
      });

      if (response.status === 204) {
        setLoginSucceeded(true);
        router.replace("/reserva");
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
      } else if (parsedError.success && parsedError.data.code === "rate_limited") {
        setError("root.network", {
          type: "server",
          message: "Demasiados intentos. Espera un momento antes de volver a intentarlo.",
        });
      } else if (parsedError.success && parsedError.data.code === "account_disabled") {
        setError("root.credentials", {
          type: "server",
          message: "Tu acceso al gimnasio está deshabilitado.",
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
    <main className="flex min-h-full w-full max-w-sm flex-col items-center justify-center gap-12 bg-neutral-950 px-8 py-12">
      <header className="flex flex-col items-center gap-3">
        <div className="size-42">
          <LoginAnimalImage />
        </div>

        <div className="flex flex-col items-center gap-1">
          <h1 className="text-base text-neutral-400">Sala de Musculación</h1>
          <p className="text-sm text-neutral-500 uppercase">UTFSM</p>
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
            <span className="text-sm text-neutral-500">Correo institucional</span>

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
            <span className="text-sm text-neutral-500">Contraseña</span>

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
                className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-neutral-600 transition-colors hover:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-40"
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
        <p className="text-xs text-neutral-500">Creado para la comunidad Sansana de Concepción.</p>

        <Link
          {...EXTERNAL_LINK_PROPS()}
          href={GITHUB_VIMASTO_ORG_URL}
          aria-label="GitHub de Vimasto"
          className="text-neutral-500 transition-colors hover:text-neutral-400"
        >
          <IconGithub className="size-5" />
        </Link>
      </footer>
    </main>
  );
}
