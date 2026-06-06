"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { clsx } from "clsx";
import { Dumbbell, Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod/v4";
import { EXTERNAL_LINK_PROPS } from "@gusm/utils/link";
import { IconGithub } from "@/components/icons";
import { GITHUB_VIMASTO_ORG_URL } from "@/constants";

const LOGIN_SCHEMA = z.object({
  email: z.email().trim().min(1, "Ingresa tu correo institucional."),
  password: z.string().min(1, "Ingresa tu contraseña."),
});

type LoginFormValues = z.infer<typeof LOGIN_SCHEMA>;

const MOCK_VALID_EMAIL = "ivan.gallardo@usm.cl";
const MOCK_DELAY_MS = 1400;

export default function LoginView() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loginSucceeded, setLoginSucceeded] = useState(false);

  const router = useRouter();

  const {
    clearErrors,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LOGIN_SCHEMA),
    reValidateMode: "onChange",
  });

  const formDisabled = isSubmitting || loginSucceeded;

  async function handleLoginSubmit(formValues: LoginFormValues) {
    clearErrors("root");

    await new Promise<void>((resolve) => {
      setTimeout(resolve, MOCK_DELAY_MS);
    });

    if (formValues.email !== MOCK_VALID_EMAIL) {
      setError("root.credentials", {
        type: "server",
        message: "Correo o contraseña incorrectos.",
      });
      return;
    }

    setLoginSucceeded(true);
    router.push("/booking");
  }

  return (
    <main className="flex min-h-full w-full flex-col items-center justify-center gap-12 max-w-sm bg-neutral-950 px-8 py-12">
      <header className="flex flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl border border-accent/20 bg-accent/10">
          <Dumbbell size={22} className="text-accent" />
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-sm text-neutral-400">Sala de Musculación</p>
          <p className="text-xs text-neutral-500 uppercase">UTFSM</p>
        </div>
      </header>

      <form
        noValidate
        onSubmit={handleSubmit(handleLoginSubmit)}
        className="flex flex-col flex-1 gap-5 w-full"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Correo institucional</span>

            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="nombre@usm.cl"
              disabled={formDisabled}
              aria-invalid={errors.email ? "true" : "false"}
              className={clsx(
                "gusm-input-primary w-full",
                errors.email && "border-rose-700/60 focus-visible:border-rose-700/60",
              )}
              {...register("email", {
                onChange: () => clearErrors("root"),
              })}
            />
          </label>

          {errors.email?.message && (
            <span className="text-xs text-rose-500">{errors.email.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="grid gap-1">
            <span className="text-xs text-neutral-500">Contraseña</span>

            <span className="relative">
              <input
                id="password"
                type={passwordVisible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={formDisabled}
                aria-invalid={errors.password ? "true" : "false"}
                {...register("password", {
                  onChange: () => clearErrors("root"),
                })}
                className={clsx(
                  "gusm-input-primary w-full pr-11",
                  errors.password && "border-rose-700/60 focus-visible:border-rose-700/60",
                )}
              />

              <button
                type="button"
                onClick={() => setPasswordVisible(!passwordVisible)}
                disabled={formDisabled}
                aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-neutral-600 transition-colors hover:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {passwordVisible ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </span>

            {errors.password?.message && (
              <span className="text-xs text-rose-500">{errors.password.message}</span>
            )}
          </label>
        </div>

        {errors.root?.credentials?.message && (
          <span className="text-xs text-rose-500">{errors.root.credentials.message}</span>
        )}

        {isSubmitting ? (
          <button
            type="button"
            disabled={formDisabled}
            className={clsx("w-full gusm-button-primary flex items-center justify-center gap-2")}
          >
            <Loader2 size={14} className="animate-spin" />
            Verificando…
          </button>
        ) : (
          <button
            type="submit"
            disabled={formDisabled}
            className={clsx("w-full gusm-button-primary")}
          >
            Ingresar
          </button>
        )}
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
