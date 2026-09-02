"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, X } from "lucide-react";
import * as z from "zod/v4";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CREATE_SUPABASE_BROWSER_CLIENT } from "@gusm/database/client";
import { ProfileCalendar, type ProfileAttendanceEntry } from "@/components/ProfileCalendar";
import { StreakMilestoneProgress } from "@/components/StreakMilestoneProgress";
import { type AppRole, UserTopBar } from "@/components/UserTopBar";
import { getSantiagoToday } from "@/components/UserCalendarBanner";
import { clearQueryCache } from "@/lib/query-client";
import { CURRENT_USER_QUERY_KEY, PROFILE_QUERY_KEY, profileMonthQueryKey } from "@/lib/query-keys";
import type { CurrentUser } from "@/lib/current-user";
import { applyThemePreference, type ThemePreference } from "@/lib/theme";

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
    themePreference: z.enum(["dark", "light"]),
  }),
  attendance: z
    .array(
      z.object({
        bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.enum(["present", "absent"]),
      }),
    )
    .optional(),
});

type Profile = z.infer<typeof PROFILE_RESPONSE_SCHEMA>["profile"];
type ProfileResponse = z.infer<typeof PROFILE_RESPONSE_SCHEMA>;
type ProfileMonthResponse = ProfileResponse & { monthQuery: string };
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

async function getProfile(monthQuery: string): Promise<ProfileMonthResponse> {
  const profileParameters = new URLSearchParams({ month: monthQuery, includeAttendance: "true" });
  const response = await fetch(`/api/profile?${profileParameters.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Profile request was rejected.");

  const payload: unknown = await response.json();
  const profileResponse = PROFILE_RESPONSE_SCHEMA.safeParse(payload);
  if (!profileResponse.success) throw new Error("Profile response is invalid.");

  applyThemePreference(profileResponse.data.profile.themePreference);
  return { ...profileResponse.data, monthQuery };
}

async function saveProfileData(profileData: ProfileMutationPayload) {
  const response = await fetch("/api/profile", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profileData),
  });

  if (response.status !== 204) throw new Error("Profile update was rejected.");
}

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = getSantiagoToday();
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(today));
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
  const profileQuery = useQuery({
    queryKey: profileMonthQueryKey(monthQuery),
    queryFn: () => getProfile(monthQuery),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  const profile = profileQuery.data?.profile ?? null;
  const attendanceForVisibleMonth: ProfileAttendanceEntry[] =
    profileQuery.data?.monthQuery === monthQuery ? (profileQuery.data.attendance ?? []) : [];
  const isLoading = profileQuery.isLoading;
  const loadError = profileQuery.isError;
  const saveProfileMutation = useMutation({
    mutationFn: saveProfileData,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    },
  });

  useEffect(() => {
    if (!profile) return;

    queryClient.setQueryData<CurrentUser>(CURRENT_USER_QUERY_KEY, {
      userName: profile.userName,
      role: profile.role,
      streakWeeks: profile.streakWeeks,
      themePreference: profile.themePreference,
    });
  }, [profile, queryClient]);

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
      await saveProfileMutation.mutateAsync(profileData.data);
      setIsEditorOpen(false);
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

    clearQueryCache();
    router.replace("/login");
  }

  async function updateThemePreference(themePreference: ThemePreference) {
    try {
      const response = await fetch("/api/theme-preference", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreference }),
      });

      if (response.status !== 204) {
        throw new Error("Theme preference update was rejected.");
      }

      queryClient.setQueriesData<ProfileMonthResponse>(
        { queryKey: PROFILE_QUERY_KEY },
        (currentProfile) =>
          currentProfile
            ? {
                ...currentProfile,
                profile: { ...currentProfile.profile, themePreference },
              }
            : currentProfile,
      );
      queryClient.setQueryData<CurrentUser>(CURRENT_USER_QUERY_KEY, (user) =>
        user ? { ...user, themePreference } : user,
      );
      return true;
    } catch (error) {
      console.error("[PROFILE] could not update theme preference.", error);
      return false;
    }
  }

  function goToPreviousMonth() {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    if (monthQuery === getMonthQuery(getMonthStart(today))) return;

    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1));
  }

  const cachedStreakWeeks = profileQuery.data?.profile.streakWeeks ?? 0;
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
            onGoOvercapacity={() => router.push("/bloque")}
            onGoSettings={() => router.push("/configuracion")}
            onSignOut={signOut}
            onThemePreferenceChange={profile ? updateThemePreference : undefined}
          />
        </header>

        <div className="flex flex-1 flex-col gap-4 px-4 py-5">
          {loadError && !profile ? (
            <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-base text-foreground-muted">No fue posible cargar tu perfil.</p>
              <button
                type="button"
                onClick={() => void profileQuery.refetch()}
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
                today={today}
              />

              <StreakMilestoneProgress streakWeeks={profile?.streakWeeks ?? cachedStreakWeeks} />

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
                    <h2 className="mt-1 text-lg font-semibold text-foreground">Tu información</h2>
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
                    <dd className="mt-1 truncate text-base font-medium text-foreground">
                      {getProfileValue(age)}
                    </dd>
                  </div>
                  <div className="min-w-0 px-3 py-3">
                    <dt className="text-sm text-dim">Sexo declarado</dt>
                    <dd className="mt-1 truncate text-base font-medium text-foreground">
                      {getProfileValue(sexLabel)}
                    </dd>
                  </div>
                  <div className="min-w-0 px-3 py-3">
                    <dt className="text-sm text-dim">Altura</dt>
                    <dd className="mt-1 truncate text-base font-medium text-foreground">
                      {profile?.heightCm === null || profile?.heightCm === undefined
                        ? "No informada"
                        : `${profile.heightCm} cm`}
                    </dd>
                  </div>
                  <div className="min-w-0 px-3 py-3">
                    <dt className="text-sm text-dim">Peso</dt>
                    <dd className="mt-1 truncate text-base font-medium text-foreground">
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
                    <dd className="min-w-0 truncate text-base font-medium text-foreground">
                      {profile?.institutionalUsername ?? "No disponible"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-muted">Rol</dt>
                    <dd className="text-base font-medium text-foreground">
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-overlay px-3 py-3 backdrop-blur-sm sm:items-center"
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
                  className="mt-1 text-lg font-semibold text-foreground"
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

            <label className="flex flex-col gap-2 text-sm text-foreground-muted">
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
                className="gusm-input-primary"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-foreground-muted">
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
                className="gusm-input-primary"
              >
                <option value="">No informado</option>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="otro">Otro</option>
                <option value="prefiero_no_decir">Prefiero no decir</option>
              </select>
            </label>

            <div className="flex flex-col gap-4">
              <label className="flex min-w-0 flex-col gap-2 text-sm text-foreground-muted">
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
                  className="gusm-input-primary"
                />
              </label>

              <label className="flex min-w-0 flex-col gap-2 text-sm text-foreground-muted">
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
                  className="gusm-input-primary"
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
                className="gusm-control-height rounded-xl border border-divider px-4 text-base text-foreground-muted transition-colors hover:border-muted disabled:cursor-not-allowed disabled:opacity-50"
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
