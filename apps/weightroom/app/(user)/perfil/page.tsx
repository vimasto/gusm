"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, X } from "lucide-react";
import * as z from "zod/v4";
import { CREATE_SUPABASE_BROWSER_CLIENT } from "@gusm/database/client";
import { ProfileCalendar, type ProfileAttendanceEntry } from "@/components/ProfileCalendar";
import { type AppRole, UserTopBar } from "@/components/UserTopBar";
import { getSantiagoToday } from "@/components/UserCalendarBanner";

const PROFILE_RESPONSE_SCHEMA = z.object({
  profile: z.object({
    userName: z.string().min(1),
    role: z.enum(["student", "u_staff", "gym_staff", "admin"]),
    institutionalUsername: z.string().min(1).nullable(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    reportedSex: z.enum(["masculino", "femenino", "otro", "prefiero_no_decir"]).nullable(),
    heightCm: z.number().int().nullable(),
    weightKg: z.number().nullable(),
    streakWeeks: z.number().int().nonnegative(),
  }),
  attendance: z.array(
    z.object({
      bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status: z.enum(["present", "absent"]),
    }),
  ),
});

type Profile = z.infer<typeof PROFILE_RESPONSE_SCHEMA>["profile"];
type ProfileFormValues = {
  dateOfBirth: string;
  reportedSex: "" | "masculino" | "femenino" | "otro" | "prefiero_no_decir";
  heightCm: string;
  weightKg: string;
};
type ProfileMutationPayload = {
  dateOfBirth: string | null;
  reportedSex: "masculino" | "femenino" | "otro" | "prefiero_no_decir" | null;
  heightCm: number | null;
  weightKg: number | null;
};

const REPORTED_SEX_LABELS = {
  masculino: "Masculino",
  femenino: "Femenino",
  otro: "Otro",
  prefiero_no_decir: "Prefiero no decir",
} as const;

const ROLE_LABELS: Record<AppRole, string> = {
  student: "Estudiante",
  u_staff: "Personal USM",
  gym_staff: "Equipo de sala",
  admin: "Administración",
};

const MIN_HEIGHT_CM = 120;
const MAX_HEIGHT_CM = 230;
const MIN_WEIGHT_KG = 35;
const MAX_WEIGHT_KG = 300;

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthQuery(month: Date) {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
}

function getAge(dateOfBirth: string, today: Date) {
  const [yearText, monthText, dayText] = dateOfBirth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const birthdayHasOccurred =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);

  return today.getFullYear() - year - (birthdayHasOccurred ? 0 : 1);
}

function isDateOfBirthValid(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function createProfileFormValues(profile: Profile): ProfileFormValues {
  return {
    dateOfBirth: profile.dateOfBirth ?? "",
    reportedSex: profile.reportedSex ?? "",
    heightCm: profile.heightCm?.toString() ?? "",
    weightKg: profile.weightKg?.toString() ?? "",
  };
}

function createProfileMutationPayload(
  formValues: ProfileFormValues,
): { data: ProfileMutationPayload } | { error: string } {
  const dateOfBirth = formValues.dateOfBirth || null;
  const reportedSex = formValues.reportedSex || null;

  if (dateOfBirth && !isDateOfBirthValid(dateOfBirth)) {
    return { error: "Ingresa una fecha de nacimiento válida." };
  }

  if ((dateOfBirth === null) !== (reportedSex === null)) {
    return { error: "Fecha de nacimiento y sexo declarado deben registrarse juntos." };
  }

  const heightCm = formValues.heightCm === "" ? null : Number(formValues.heightCm);
  if (!Number.isInteger(heightCm) && heightCm !== null) {
    return { error: "La altura debe ser un número entero." };
  }

  const weightKg = formValues.weightKg === "" ? null : Number(formValues.weightKg);
  if (!Number.isFinite(weightKg) && weightKg !== null) {
    return { error: "El peso debe ser un número válido." };
  }

  if (dateOfBirth === null && heightCm === null && weightKg === null) {
    return { error: "Ingresa al menos un dato voluntario para guardar." };
  }

  return { data: { dateOfBirth, reportedSex, heightCm, weightKg } };
}

function getProfileValue(value: string | number | null) {
  return value === null ? "No informado" : value;
}

function normalizeHeightInput(value: string) {
  const heightCm = Number(value);
  if (!Number.isInteger(heightCm)) return value;

  return String(Math.min(Math.max(heightCm, MIN_HEIGHT_CM), MAX_HEIGHT_CM));
}

function normalizeWeightInput(value: string) {
  const weightKg = Number(value);
  if (!Number.isFinite(weightKg)) return value;

  const normalizedWeight = Math.min(Math.max(weightKg, MIN_WEIGHT_KG), MAX_WEIGHT_KG);
  return String(Math.round(normalizedWeight * 100) / 100);
}

export default function ProfilePage() {
  const router = useRouter();
  const today = getSantiagoToday();
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(today));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attendance, setAttendance] = useState<ProfileAttendanceEntry[]>([]);
  const [loadedMonth, setLoadedMonth] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [formValues, setFormValues] = useState<ProfileFormValues>({
    dateOfBirth: "",
    reportedSex: "",
    heightCm: "",
    weightKg: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const monthQuery = getMonthQuery(visibleMonth);
  const attendanceForVisibleMonth = loadedMonth === monthQuery ? attendance : [];

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      setIsLoading(true);
      setLoadError(false);

      try {
        const response = await fetch(`/api/profile?month=${monthQuery}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Profile request was rejected.");
        }

        const payload: unknown = await response.json();
        const parsedPayload = PROFILE_RESPONSE_SCHEMA.safeParse(payload);
        if (!parsedPayload.success) {
          throw new Error("Profile response is invalid.");
        }

        setProfile(parsedPayload.data.profile);
        setAttendance(parsedPayload.data.attendance);
        setLoadedMonth(monthQuery);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        console.error("[PROFILE] could not load profile data.", error);
        setLoadError(true);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadProfile();
    return () => controller.abort();
  }, [monthQuery, reloadIndex]);

  function openEditor() {
    if (!profile) return;

    setFormValues(createProfileFormValues(profile));
    setFormError(null);
    setIsEditorOpen(true);
  }

  function closeEditor() {
    if (isSaving) return;

    setIsEditorOpen(false);
    setFormError(null);
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profileData = createProfileMutationPayload(formValues);

    if ("error" in profileData) {
      setFormError(profileData.error);
      return;
    }

    setFormError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData.data),
      });

      if (response.status !== 204) {
        throw new Error("Profile update was rejected.");
      }

      setIsEditorOpen(false);
      setReloadIndex((currentIndex) => currentIndex + 1);
    } catch (error) {
      console.error("[PROFILE] could not save profile data.", error);
      setFormError("No fue posible guardar tus datos. Intenta nuevamente.");
    } finally {
      setIsSaving(false);
    }
  }

  async function signOut() {
    const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[PROFILE] could not sign out.", error);
      return;
    }

    router.replace("/login");
  }

  function goToPreviousMonth() {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    if (monthQuery === getMonthQuery(getMonthStart(today))) return;

    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1));
  }

  const age = profile?.dateOfBirth ? getAge(profile.dateOfBirth, today) : null;
  const sexLabel = profile?.reportedSex ? REPORTED_SEX_LABELS[profile.reportedSex] : null;
  return (
    <main className="flex min-h-svh w-full justify-center bg-bg">
      <div className="flex min-h-svh gusm-app-shell flex-col">
        <header className="sticky top-0 z-20 border-b border-divider bg-surface">
          <UserTopBar
            onBack={() => router.push("/reserva")}
            pageTitle="Perfil"
            userName={profile?.userName}
            role={profile?.role}
            showActiveBookings={false}
            onSignOut={signOut}
          />
        </header>

        <div className="flex flex-1 flex-col gap-4 px-4 py-5">
          {loadError && !profile ? (
            <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-base text-neutral-300">No fue posible cargar tu perfil.</p>
              <button
                type="button"
                onClick={() => setReloadIndex((currentIndex) => currentIndex + 1)}
                className="gusm-button-primary"
              >
                Reintentar
              </button>
            </section>
          ) : (
            <>
              <ProfileCalendar
                attendance={attendanceForVisibleMonth}
                isLoading={isLoading}
                month={visibleMonth}
                onPreviousMonth={goToPreviousMonth}
                onNextMonth={goToNextMonth}
                streakWeeks={profile?.streakWeeks ?? 0}
                today={today}
              />

              {loadError && (
                <p role="alert" className="text-sm text-rose-400">
                  No fue posible actualizar este mes. Se muestra la información disponible.
                </p>
              )}

              <section className="rounded-2xl border border-accent/15 bg-input/30 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium tracking-[0.12em] text-dim uppercase">
                      Datos opcionales
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-neutral-100">Tu información</h2>
                  </div>
                  <button
                    type="button"
                    onClick={openEditor}
                    disabled={!profile}
                    aria-label="Editar datos opcionales"
                    className="flex size-11 items-center justify-center rounded-full text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                </div>

                <dl className="mt-4 grid grid-cols-2 divide-x divide-y divide-accent/15 overflow-hidden rounded-xl border border-accent/15">
                  <div className="min-w-0 px-3 py-3">
                    <dt className="text-sm text-dim">Edad</dt>
                    <dd className="mt-1 truncate text-base font-medium text-neutral-200">
                      {getProfileValue(age)}
                    </dd>
                  </div>
                  <div className="min-w-0 px-3 py-3">
                    <dt className="text-sm text-dim">Sexo declarado</dt>
                    <dd className="mt-1 truncate text-base font-medium text-neutral-200">
                      {getProfileValue(sexLabel)}
                    </dd>
                  </div>
                  <div className="min-w-0 px-3 py-3">
                    <dt className="text-sm text-dim">Altura</dt>
                    <dd className="mt-1 truncate text-base font-medium text-neutral-200">
                      {profile?.heightCm === null || profile?.heightCm === undefined
                        ? "No informada"
                        : `${profile.heightCm} cm`}
                    </dd>
                  </div>
                  <div className="min-w-0 px-3 py-3">
                    <dt className="text-sm text-dim">Peso</dt>
                    <dd className="mt-1 truncate text-base font-medium text-neutral-200">
                      {profile?.weightKg === null || profile?.weightKg === undefined
                        ? "No informado"
                        : `${profile.weightKg} kg`}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-2xl border border-accent/15 bg-input/30 px-4 py-4">
                <p className="text-xs font-medium tracking-[0.12em] text-dim uppercase">Cuenta</p>
                <dl className="mt-3 divide-y divide-accent/15 border-y border-accent/15">
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-muted">Usuario institucional</dt>
                    <dd className="min-w-0 truncate text-base font-medium text-neutral-200">
                      {profile?.institutionalUsername ?? "No disponible"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-muted">Rol</dt>
                    <dd className="text-base font-medium text-neutral-200">
                      {profile ? ROLE_LABELS[profile.role] : ""}
                    </dd>
                  </div>
                </dl>
              </section>
            </>
          )}
        </div>
      </div>

      {isEditorOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-3 py-3 backdrop-blur-sm sm:items-center"
          onMouseDown={closeEditor}
        >
          <form
            aria-labelledby="profile-editor-title"
            aria-modal="true"
            role="dialog"
            onSubmit={saveProfile}
            onMouseDown={(event) => event.stopPropagation()}
            className="flex gusm-app-shell w-full flex-col gap-4 rounded-2xl border border-accent/20 px-5 py-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-[0.12em] text-dim uppercase">
                  Datos opcionales
                </p>
                <h2
                  id="profile-editor-title"
                  className="mt-1 text-lg font-semibold text-neutral-100"
                >
                  Actualizar información
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                aria-label="Cerrar edición"
                className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent/10 hover:text-accent disabled:cursor-not-allowed"
                disabled={isSaving}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <p className="text-sm leading-5 text-muted">
              Estos datos son opcionales. Puedes actualizarlos cuando lo necesites.
            </p>

            <label className="flex flex-col gap-2 text-sm text-neutral-300">
              Fecha de nacimiento
              <input
                type="date"
                value={formValues.dateOfBirth}
                onChange={(event) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    dateOfBirth: event.target.value,
                  }))
                }
                max={getMonthQuery(today) + `-${String(today.getDate()).padStart(2, "0")}`}
                className="gusm-input-primary [color-scheme:dark]"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-neutral-300">
              Sexo declarado
              <select
                value={formValues.reportedSex}
                onChange={(event) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    reportedSex:
                      event.target.value === "masculino" ||
                      event.target.value === "femenino" ||
                      event.target.value === "otro" ||
                      event.target.value === "prefiero_no_decir"
                        ? event.target.value
                        : "",
                  }))
                }
                className="gusm-input-primary [color-scheme:dark]"
              >
                <option value="">No informado</option>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="otro">Otro</option>
                <option value="prefiero_no_decir">Prefiero no decir</option>
              </select>
            </label>

            <div className="flex flex-col gap-4">
              <label className="flex min-w-0 flex-col gap-2 text-sm text-neutral-300">
                Altura (cm)
                <input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  value={formValues.heightCm}
                  onChange={(event) =>
                    setFormValues((currentValues) => ({
                      ...currentValues,
                      heightCm: event.target.value,
                    }))
                  }
                  onBlur={(event) =>
                    setFormValues((currentValues) => ({
                      ...currentValues,
                      heightCm: normalizeHeightInput(event.target.value),
                    }))
                  }
                  className="gusm-input-primary [color-scheme:dark]"
                />
              </label>

              <label className="flex min-w-0 flex-col gap-2 text-sm text-neutral-300">
                Peso (kg)
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={formValues.weightKg}
                  onChange={(event) =>
                    setFormValues((currentValues) => ({
                      ...currentValues,
                      weightKg: event.target.value,
                    }))
                  }
                  onBlur={(event) =>
                    setFormValues((currentValues) => ({
                      ...currentValues,
                      weightKg: normalizeWeightInput(event.target.value),
                    }))
                  }
                  className="gusm-input-primary [color-scheme:dark]"
                />
              </label>
            </div>

            {formError && (
              <p role="alert" className="text-sm text-rose-400">
                {formError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={closeEditor}
                disabled={isSaving}
                className="gusm-control-height rounded-xl border border-divider px-4 text-base text-neutral-300 transition-colors hover:border-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex gusm-button-primary items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
