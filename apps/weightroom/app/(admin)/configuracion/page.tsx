"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CalendarDays,
  CalendarRange,
  Download,
  Loader2,
  Repeat2,
  RotateCcw,
  Save,
  Settings2,
  ShieldAlert,
  Trash2,
  UserRoundSearch,
  X,
} from "lucide-react";
import * as z from "zod/v4";
import { CREATE_SUPABASE_BROWSER_CLIENT } from "@gusm/database/client";
import { UserTopBar } from "@/components/UserTopBar";

const CURRENT_USER_SCHEMA = z.object({
  userName: z.string().min(1),
  role: z.enum(["student", "u_staff", "gym_staff", "admin"]),
  streakWeeks: z.number().int().nonnegative(),
});
const TIME_BLOCK_SCHEMA = z.object({
  timeBlockId: z.number().int().positive(),
  startTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
});
const CONFIGURATION_SCHEMA = z.object({
  settings: z.object({
    nSessionsPerDay: z.number().int().positive(),
    overcapacityMaxAbove: z.number().int().nonnegative(),
    standardCapacity: z.number().int().positive(),
  }),
  timeBlocks: z.array(TIME_BLOCK_SCHEMA),
  dateClosures: z.array(
    z.object({
      date: z.string().date(),
      timeBlockId: z.number().int().positive(),
      reason: z.string().min(3).max(240),
    }),
  ),
  dateClosurePeriods: z.array(
    z.object({
      closurePeriodId: z.string().uuid(),
      startDate: z.string().date(),
      endDate: z.string().date(),
      reason: z.string().min(3).max(240),
    }),
  ),
  weeklyClosures: z.array(
    z.object({
      isoWeekday: z.number().int().min(1).max(7),
      timeBlockId: z.number().int().positive(),
      reason: z.string().min(3).max(240),
    }),
  ),
});
const DISCIPLINE_RULE_SCHEMA = z.object({
  discipline_rule_id: z.string().uuid(),
  violation_type: z.enum(["absent", "missed_confirmation", "missed_qr", "unbooked_attendance"]),
  occurrence_threshold: z.number().int().positive(),
  window_days: z.number().int().min(1).max(365),
  action_kind: z.enum(["notice", "disable"]),
  enabled: z.boolean(),
});
const DISCIPLINE_RESPONSE_SCHEMA = z.object({ rules: z.array(DISCIPLINE_RULE_SCHEMA) });
const ADMIN_USER_SCHEMA = z.object({
  user_id: z.string().uuid(),
  institutional_username: z.string().min(1),
  user_name: z.string().min(1),
  user_role: z.enum(["student", "u_staff", "gym_staff", "admin"]),
  disabled_at: z.string().datetime().nullable(),
  disabled_reason: z.string().nullable(),
});
const ADMIN_USERS_RESPONSE_SCHEMA = z.object({ users: z.array(ADMIN_USER_SCHEMA) });

type CurrentUser = z.infer<typeof CURRENT_USER_SCHEMA>;
type Configuration = z.infer<typeof CONFIGURATION_SCHEMA>;
type DisciplineRule = z.infer<typeof DISCIPLINE_RULE_SCHEMA>;
type AdminUser = z.infer<typeof ADMIN_USER_SCHEMA>;
type ClosureCoverage = "block" | "day" | "range";
type ClosureFrequency = "once" | "always";
type Closure =
  | (Configuration["dateClosures"][number] & { scope: "date" })
  | (Configuration["dateClosurePeriods"][number] & { scope: "period" })
  | (Configuration["weeklyClosures"][number] & { scope: "weekly" });
type ExportPeriod = "week" | "month" | "custom";
type ExportCategory = "all" | "bookings" | "attendance" | "warnings" | "discipline";
type DisciplineViolationType = DisciplineRule["violation_type"];
type DisciplineActionKind = DisciplineRule["action_kind"];

const ISO_WEEKDAY_LABELS = [
  "",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const DISCIPLINE_VIOLATION_LABELS: Record<DisciplineViolationType, string> = {
  absent: "Ausencia",
  missed_confirmation: "No reconfirmar",
  missed_qr: "No marcar QR",
  unbooked_attendance: "Ingreso sin reserva",
};
const DISCIPLINE_ACTION_LABELS: Record<DisciplineActionKind, string> = {
  notice: "Advertencia registrada",
  disable: "Deshabilitar acceso",
};
const EXPORT_CATEGORY_LABELS: Record<ExportCategory, string> = {
  all: "Todo",
  bookings: "Reservas",
  attendance: "Asistencia",
  warnings: "Warnings",
  discipline: "Sanciones",
};

function isDisciplineViolationType(value: string): value is DisciplineViolationType {
  return Object.hasOwn(DISCIPLINE_VIOLATION_LABELS, value);
}

function isDisciplineActionKind(value: string): value is DisciplineActionKind {
  return Object.hasOwn(DISCIPLINE_ACTION_LABELS, value);
}

function isExportCategory(value: string): value is ExportCategory {
  return Object.hasOwn(EXPORT_CATEGORY_LABELS, value);
}

function getSantiagoDate() {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = dateParts.find((part) => part.type === "year")?.value;
  const month = dateParts.find((part) => part.type === "month")?.value;
  const day = dateParts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) throw new Error("Santiago date could not be formatted.");

  return `${year}-${month}-${day}`;
}

function getTimeRange(timeBlock: z.infer<typeof TIME_BLOCK_SCHEMA>) {
  return `${timeBlock.startTime.slice(0, 5)} · ${timeBlock.endTime.slice(0, 5)}`;
}

function getDateLabel(date: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function formatDateForQuery(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getExportRange(period: ExportPeriod, anchor: string, startDate: string, endDate: string) {
  if (period === "custom") return { endDate, startDate };

  const [yearText, monthText, dayText] = anchor.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));

  if (period === "month") {
    return {
      endDate: formatDateForQuery(
        new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)),
      ),
      startDate: formatDateForQuery(
        new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)),
      ),
    };
  }

  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  const weekStart = new Date(date);
  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  return { endDate: formatDateForQuery(weekEnd), startDate: formatDateForQuery(weekStart) };
}

function getClosureLabel(closure: Closure, timeBlocks: z.infer<typeof TIME_BLOCK_SCHEMA>[]) {
  if (closure.scope === "period") {
    if (closure.startDate === closure.endDate) {
      return `${getDateLabel(closure.startDate)} · todos los bloques`;
    }

    return `${getDateLabel(closure.startDate)} a ${getDateLabel(closure.endDate)} · todos los bloques`;
  }

  const timeBlock = timeBlocks.find((item) => item.timeBlockId === closure.timeBlockId);
  const blockLabel = timeBlock
    ? `Bloque ${closure.timeBlockId} · ${getTimeRange(timeBlock)}`
    : `Bloque ${closure.timeBlockId}`;
  const recurrenceLabel =
    closure.scope === "date" ? getDateLabel(closure.date) : ISO_WEEKDAY_LABELS[closure.isoWeekday];

  return `${recurrenceLabel} · ${blockLabel}`;
}

function getDisciplineRuleSummary(rule: DisciplineRule) {
  if (rule.violation_type === "absent") {
    return `${rule.occurrence_threshold} ${rule.occurrence_threshold === 1 ? "ausencia" : "ausencias"}`;
  }

  return `${rule.occurrence_threshold} ${rule.occurrence_threshold === 1 ? "vez" : "veces"}: ${DISCIPLINE_VIOLATION_LABELS[rule.violation_type].toLocaleLowerCase("es-CL")}`;
}

export default function ConfigurationPage() {
  const router = useRouter();
  const today = getSantiagoDate();
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [sessionsPerDay, setSessionsPerDay] = useState("1");
  const [overcapacityMax, setOvercapacityMax] = useState("0");
  const [closureCoverage, setClosureCoverage] = useState<ClosureCoverage>("block");
  const [closureFrequency, setClosureFrequency] = useState<ClosureFrequency>("once");
  const [closureStartDate, setClosureStartDate] = useState(today);
  const [closureEndDate, setClosureEndDate] = useState(today);
  const [closureWeekday, setClosureWeekday] = useState("1");
  const [closureTimeBlockId, setClosureTimeBlockId] = useState("1");
  const [closureReason, setClosureReason] = useState("");
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("week");
  const [exportAnchor, setExportAnchor] = useState(today);
  const [exportStartDate, setExportStartDate] = useState(today);
  const [exportEndDate, setExportEndDate] = useState(today);
  const [exportCategory, setExportCategory] = useState<ExportCategory>("all");
  const [disciplineRules, setDisciplineRules] = useState<DisciplineRule[]>([]);
  const [disciplineViolationType, setDisciplineViolationType] =
    useState<DisciplineViolationType>("absent");
  const [disciplineThreshold, setDisciplineThreshold] = useState("1");
  const [disciplineWindowDays, setDisciplineWindowDays] = useState("30");
  const [disciplineActionKind, setDisciplineActionKind] = useState<DisciplineActionKind>("notice");
  const [isSavingDiscipline, setIsSavingDiscipline] = useState(false);
  const [removingDisciplineRuleId, setRemovingDisciplineRuleId] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<AdminUser[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [suspensionTarget, setSuspensionTarget] = useState<AdminUser | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [isUpdatingUserAccess, setIsUpdatingUserAccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingClosure, setIsSavingClosure] = useState(false);
  const [removingClosureKey, setRemovingClosureKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadConfiguration() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [configurationResponse, currentUserResponse] = await Promise.all([
          fetch("/api/configuration", { cache: "no-store", signal: controller.signal }),
          fetch("/api/current-user", { cache: "no-store", signal: controller.signal }),
        ]);

        if (!currentUserResponse.ok) throw new Error("Current user request was rejected.");

        const currentUserPayload: unknown = await currentUserResponse.json();
        const parsedCurrentUser = CURRENT_USER_SCHEMA.safeParse(currentUserPayload);
        if (!parsedCurrentUser.success) throw new Error("Current user response is invalid.");

        if (parsedCurrentUser.data.role !== "admin") {
          router.replace("/reserva");
          return;
        }

        if (!configurationResponse.ok) throw new Error("Configuration request was rejected.");

        const configurationPayload: unknown = await configurationResponse.json();
        const parsedConfiguration = CONFIGURATION_SCHEMA.safeParse(configurationPayload);
        if (!parsedConfiguration.success) throw new Error("Configuration response is invalid.");

        setConfiguration(parsedConfiguration.data);
        setCurrentUser(parsedCurrentUser.data);
        setSessionsPerDay(String(parsedConfiguration.data.settings.nSessionsPerDay));
        setOvercapacityMax(String(parsedConfiguration.data.settings.overcapacityMaxAbove));
        setClosureTimeBlockId(String(parsedConfiguration.data.timeBlocks[0]?.timeBlockId ?? 1));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        console.error("[CONFIGURATION] could not load configuration.", error);
        setErrorMessage("No fue posible cargar la configuración.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadConfiguration();
    return () => controller.abort();
  }, [reloadIndex, router]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDisciplineRules() {
      try {
        const response = await fetch("/api/configuration/discipline", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Discipline rules request was rejected.");

        const payload: unknown = await response.json();
        const parsedRules = DISCIPLINE_RESPONSE_SCHEMA.safeParse(payload);
        if (!parsedRules.success) throw new Error("Discipline rules response is invalid.");

        setDisciplineRules(parsedRules.data.rules.filter((rule) => rule.enabled));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        console.error("[CONFIGURATION] could not load discipline rules.", error);
      }
    }

    void loadDisciplineRules();
    return () => controller.abort();
  }, [reloadIndex]);

  const closures = useMemo<Closure[]>(() => {
    if (!configuration) return [];

    return [
      ...configuration.dateClosures.map((closure) => ({ ...closure, scope: "date" as const })),
      ...configuration.dateClosurePeriods.map((closure) => ({
        ...closure,
        scope: "period" as const,
      })),
      ...configuration.weeklyClosures.map((closure) => ({ ...closure, scope: "weekly" as const })),
    ];
  }, [configuration]);

  const exportRange = getExportRange(exportPeriod, exportAnchor, exportStartDate, exportEndDate);
  const exportRangeDuration =
    new Date(`${exportRange.endDate}T00:00:00.000Z`).getTime() -
    new Date(`${exportRange.startDate}T00:00:00.000Z`).getTime();
  const isExportRangeValid = exportRangeDuration >= 0 && exportRangeDuration <= 31 * 86_400_000;
  const exportUrl =
    exportPeriod === "custom"
      ? `/api/configuration/export?start=${exportRange.startDate}&end=${exportRange.endDate}&category=${exportCategory}`
      : `/api/configuration/export?period=${exportPeriod}&anchor=${exportAnchor}&category=${exportCategory}`;

  async function saveSettings() {
    const nSessionsPerDay = Number(sessionsPerDay);
    const overcapacityMaxAbove = Number(overcapacityMax);

    if (!Number.isInteger(nSessionsPerDay) || nSessionsPerDay <= 0) {
      setErrorMessage("El máximo de sesiones diarias debe ser un entero positivo.");
      return;
    }

    if (!Number.isInteger(overcapacityMaxAbove) || overcapacityMaxAbove < 0) {
      setErrorMessage("El máximo de sobrecupo debe ser un entero igual o superior a cero.");
      return;
    }

    setIsSavingSettings(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/configuration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nSessionsPerDay, overcapacityMaxAbove }),
      });

      if (response.status !== 204) throw new Error("Settings update was rejected.");

      setReloadIndex((value) => value + 1);
    } catch (error) {
      console.error("[CONFIGURATION] could not update operational settings.", error);
      setErrorMessage("No fue posible actualizar las reglas operativas.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function createClosure() {
    const timeBlockId = Number(closureTimeBlockId);
    const isoWeekday = Number(closureWeekday);
    const reason = closureReason.trim();

    if (
      closureCoverage === "block" &&
      (!Number.isInteger(timeBlockId) || timeBlockId < 1 || timeBlockId > 9)
    ) {
      setErrorMessage("Selecciona un bloque horario válido.");
      return;
    }

    if (closureFrequency === "once" && closureStartDate < today) {
      setErrorMessage("No es posible inhabilitar un bloque de una fecha pasada.");
      return;
    }

    if (
      closureFrequency === "always" &&
      (!Number.isInteger(isoWeekday) || isoWeekday < 1 || isoWeekday > 7)
    ) {
      setErrorMessage("Selecciona un día de semana válido.");
      return;
    }

    if (closureCoverage === "range") {
      const closureDuration =
        new Date(`${closureEndDate}T00:00:00.000Z`).getTime() -
        new Date(`${closureStartDate}T00:00:00.000Z`).getTime();

      if (closureDuration < 0 || closureDuration > 365 * 86_400_000) {
        setErrorMessage("El período debe estar ordenado y no superar 366 días.");
        return;
      }
    }

    if (reason.length < 3 || reason.length > 240) {
      setErrorMessage("El motivo debe tener entre 3 y 240 caracteres.");
      return;
    }

    setIsSavingClosure(true);
    setErrorMessage(null);

    const payload =
      closureFrequency === "always"
        ? { action: "create", scope: "weekly", timeBlockId, isoWeekday, reason }
        : closureCoverage === "block"
          ? { action: "create", scope: "date", timeBlockId, date: closureStartDate, reason }
          : {
              action: "create",
              scope: "period",
              startDate: closureStartDate,
              endDate: closureCoverage === "day" ? closureStartDate : closureEndDate,
              reason,
            };

    try {
      const response = await fetch("/api/configuration/closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status !== 204) throw new Error("Closure creation was rejected.");

      setClosureReason("");
      setReloadIndex((value) => value + 1);
    } catch (error) {
      console.error("[CONFIGURATION] could not create closure.", error);
      setErrorMessage(
        "No fue posible guardar la inhabilitación. Verifica que no existan reservas activas.",
      );
    } finally {
      setIsSavingClosure(false);
    }
  }

  async function removeClosure(closure: Closure) {
    const closureKey =
      closure.scope === "date"
        ? `date-${closure.date}-${closure.timeBlockId}`
        : closure.scope === "period"
          ? `period-${closure.closurePeriodId}`
          : `weekly-${closure.isoWeekday}-${closure.timeBlockId}`;
    setRemovingClosureKey(closureKey);
    setErrorMessage(null);

    const payload =
      closure.scope === "date"
        ? { action: "remove", scope: "date", timeBlockId: closure.timeBlockId, date: closure.date }
        : closure.scope === "period"
          ? { action: "remove", scope: "period", closurePeriodId: closure.closurePeriodId }
          : {
              action: "remove",
              scope: "weekly",
              timeBlockId: closure.timeBlockId,
              isoWeekday: closure.isoWeekday,
            };

    try {
      const response = await fetch("/api/configuration/closures", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status !== 204) throw new Error("Closure removal was rejected.");

      setReloadIndex((value) => value + 1);
    } catch (error) {
      console.error("[CONFIGURATION] could not remove closure.", error);
      setErrorMessage("No fue posible anular la inhabilitación.");
    } finally {
      setRemovingClosureKey(null);
    }
  }

  async function saveDisciplineRule() {
    const occurrenceThreshold = Number(disciplineThreshold);
    const windowDays = Number(disciplineWindowDays);

    if (!Number.isInteger(occurrenceThreshold) || occurrenceThreshold <= 0) {
      setErrorMessage("El umbral de la falta debe ser un entero positivo.");
      return;
    }

    if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 365) {
      setErrorMessage("La ventana de evaluación debe tener entre 1 y 365 días.");
      return;
    }

    setIsSavingDiscipline(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/configuration/discipline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          violationType: disciplineViolationType,
          occurrenceThreshold,
          windowDays,
          actionKind: disciplineActionKind,
        }),
      });
      if (response.status !== 204) throw new Error("Discipline rule update was rejected.");

      setReloadIndex((value) => value + 1);
    } catch (error) {
      console.error("[CONFIGURATION] could not save discipline rule.", error);
      setErrorMessage("No fue posible guardar la regla de castigo.");
    } finally {
      setIsSavingDiscipline(false);
    }
  }

  async function removeDisciplineRule(disciplineRuleId: string) {
    setRemovingDisciplineRuleId(disciplineRuleId);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/configuration/discipline", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disciplineRuleId }),
      });
      if (response.status !== 204) throw new Error("Discipline rule removal was rejected.");

      setReloadIndex((value) => value + 1);
    } catch (error) {
      console.error("[CONFIGURATION] could not disable discipline rule.", error);
      setErrorMessage("No fue posible desactivar la regla de castigo.");
    } finally {
      setRemovingDisciplineRuleId(null);
    }
  }

  async function searchUsers() {
    const query = userQuery.trim();
    if (query.length < 2) {
      setErrorMessage("Ingresa al menos dos caracteres del usuario institucional.");
      return;
    }

    setIsSearchingUsers(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/configuration/users?query=${encodeURIComponent(query)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("User search was rejected.");

      const payload: unknown = await response.json();
      const parsedUsers = ADMIN_USERS_RESPONSE_SCHEMA.safeParse(payload);
      if (!parsedUsers.success) throw new Error("User search response is invalid.");

      setUserSearchResults(parsedUsers.data.users);
    } catch (error) {
      console.error("[CONFIGURATION] could not search users.", error);
      setErrorMessage("No fue posible buscar usuarios.");
    } finally {
      setIsSearchingUsers(false);
    }
  }

  async function updateUserAccess(action: "disable" | "restore", user: AdminUser, reason?: string) {
    setIsUpdatingUserAccess(user.user_id);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/configuration/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "disable"
            ? { action, userId: user.user_id, reason }
            : { action, userId: user.user_id },
        ),
      });
      if (response.status !== 204) throw new Error("User access update was rejected.");

      setSuspensionTarget(null);
      setSuspensionReason("");
      await searchUsers();
    } catch (error) {
      console.error("[CONFIGURATION] could not update user access.", error);
      setErrorMessage("No fue posible actualizar el acceso del usuario.");
    } finally {
      setIsUpdatingUserAccess(null);
    }
  }

  function confirmSuspension() {
    const reason = suspensionReason.trim();
    if (!suspensionTarget) return;

    if (reason.length < 3 || reason.length > 240) {
      setErrorMessage("El motivo de suspensión debe tener entre 3 y 240 caracteres.");
      return;
    }

    void updateUserAccess("disable", suspensionTarget, reason);
  }

  function validateExportRange(event: React.MouseEvent<HTMLAnchorElement>) {
    if (isExportRangeValid) return;

    event.preventDefault();
    setErrorMessage("El rango de exportación debe estar ordenado y no superar 32 días.");
  }

  function getClosureKey(closure: Closure) {
    if (closure.scope === "date") return `date-${closure.date}-${closure.timeBlockId}`;
    if (closure.scope === "period") return `period-${closure.closurePeriodId}`;

    return `weekly-${closure.isoWeekday}-${closure.timeBlockId}`;
  }

  async function signOut() {
    const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[CONFIGURATION] could not sign out.", error);
      return;
    }

    router.replace("/login");
  }

  return (
    <main className="flex min-h-svh w-full justify-center bg-bg">
      <div className="relative flex min-h-svh gusm-app-shell flex-col bg-surface">
        <UserTopBar
          onBack={() => router.back()}
          pageTitle="Configuración"
          showActiveBookings={false}
          userName={currentUser?.userName}
          role={currentUser?.role}
          onGoProfile={() => router.push("/perfil")}
          onSignOut={signOut}
        />

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-8">
          <section className="border-b border-divider pb-4">
            <div className="flex items-center gap-3 text-accent">
              <Settings2 className="size-6" aria-hidden="true" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">Reglas de operación</h1>
                <p className="mt-1 text-sm text-muted">
                  Los cambios se aplican inmediatamente a nuevas operaciones.
                </p>
              </div>
            </div>
          </section>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
            >
              {errorMessage}
            </p>
          )}

          {isLoading || !configuration ? (
            <div className="flex flex-1 items-center justify-center py-16 text-muted">
              <Loader2 className="size-6 animate-spin" aria-hidden="true" />
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-divider bg-input/20 p-4">
                <h2 className="text-base font-semibold text-foreground">Límites de reserva</h2>
                <p className="mt-1 text-sm text-muted">
                  La capacidad estándar vigente es de {configuration.settings.standardCapacity}{" "}
                  cupos.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="flex min-w-0 flex-col gap-2 text-sm text-muted">
                    Sesiones diarias
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={sessionsPerDay}
                      onChange={(event) => setSessionsPerDay(event.target.value)}
                      className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-2 text-sm text-muted">
                    Máximo sobrecupo
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={overcapacityMax}
                      onChange={(event) => setOvercapacityMax(event.target.value)}
                      className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={isSavingSettings}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-fill py-3 text-base text-accent-foreground active:scale-[0.98] disabled:opacity-40"
                >
                  {isSavingSettings ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Guardar límites
                </button>
              </section>

              <section className="rounded-2xl border border-divider bg-input/20 p-4">
                <h2 className="text-base font-semibold text-foreground">Inhabilitar bloque</h2>
                <p className="mt-1 text-sm text-muted">
                  El motivo se muestra al usuario al intentar reservar.
                </p>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-divider bg-surface p-1">
                  <button
                    type="button"
                    onClick={() => setClosureCoverage("block")}
                    className={`rounded-lg py-2 text-base ${closureCoverage === "block" ? "bg-accent-fill text-accent-foreground" : "text-muted"}`}
                  >
                    Bloque
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClosureCoverage("day");
                      setClosureFrequency("once");
                    }}
                    className={`rounded-lg py-2 text-base ${closureCoverage === "day" ? "bg-accent-fill text-accent-foreground" : "text-muted"}`}
                  >
                    Día
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClosureCoverage("range");
                      setClosureFrequency("once");
                    }}
                    className={`rounded-lg py-2 text-base ${closureCoverage === "range" ? "bg-accent-fill text-accent-foreground" : "text-muted"}`}
                  >
                    Varios días
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-divider bg-surface p-1">
                  <button
                    type="button"
                    onClick={() => setClosureFrequency("once")}
                    className={`rounded-lg py-2 text-base ${closureFrequency === "once" ? "bg-accent-fill text-accent-foreground" : "text-muted"}`}
                  >
                    Una vez
                  </button>
                  <button
                    type="button"
                    onClick={() => setClosureFrequency("always")}
                    disabled={closureCoverage !== "block"}
                    className={`rounded-lg py-2 text-base ${closureFrequency === "always" ? "bg-accent-fill text-accent-foreground" : "text-muted"} disabled:cursor-not-allowed disabled:opacity-35`}
                  >
                    Siempre
                  </button>
                </div>

                {closureCoverage !== "block" && (
                  <p className="mt-2 text-sm text-muted">
                    El cierre de día completo se programa una vez y reúne todos los bloques bajo un
                    único motivo.
                  </p>
                )}

                <div className="mt-3 flex flex-col gap-3">
                  {closureFrequency === "always" ? (
                    <>
                      <label className="flex flex-col gap-2 text-sm text-muted">
                        Día de la semana
                        <select
                          value={closureWeekday}
                          onChange={(event) => setClosureWeekday(event.target.value)}
                          className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                        >
                          {ISO_WEEKDAY_LABELS.slice(1).map((label, index) => (
                            <option key={label} value={index + 1}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-2 text-sm text-muted">
                        Bloque horario
                        <select
                          value={closureTimeBlockId}
                          onChange={(event) => setClosureTimeBlockId(event.target.value)}
                          className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                        >
                          {configuration.timeBlocks.map((timeBlock) => (
                            <option key={timeBlock.timeBlockId} value={timeBlock.timeBlockId}>
                              Bloque {timeBlock.timeBlockId} · {getTimeRange(timeBlock)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : closureCoverage === "range" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex min-w-0 flex-col gap-2 text-sm text-muted">
                        Desde
                        <input
                          type="date"
                          min={today}
                          value={closureStartDate}
                          onChange={(event) => setClosureStartDate(event.target.value)}
                          className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                        />
                      </label>
                      <label className="flex min-w-0 flex-col gap-2 text-sm text-muted">
                        Hasta
                        <input
                          type="date"
                          min={closureStartDate}
                          value={closureEndDate}
                          onChange={(event) => setClosureEndDate(event.target.value)}
                          className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col gap-2 text-sm text-muted">
                      Fecha
                      <input
                        type="date"
                        min={today}
                        value={closureStartDate}
                        onChange={(event) => setClosureStartDate(event.target.value)}
                        className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                      />
                    </label>
                  )}

                  {closureFrequency === "once" && closureCoverage === "block" && (
                    <label className="flex flex-col gap-2 text-sm text-muted">
                      Bloque horario
                      <select
                        value={closureTimeBlockId}
                        onChange={(event) => setClosureTimeBlockId(event.target.value)}
                        className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                      >
                        {configuration.timeBlocks.map((timeBlock) => (
                          <option key={timeBlock.timeBlockId} value={timeBlock.timeBlockId}>
                            Bloque {timeBlock.timeBlockId} · {getTimeRange(timeBlock)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="flex flex-col gap-2 text-sm text-muted">
                    Motivo
                    <textarea
                      value={closureReason}
                      onChange={(event) => setClosureReason(event.target.value)}
                      maxLength={240}
                      rows={3}
                      placeholder="Ej.: Mantención de equipamiento"
                      className="rounded-xl border border-divider bg-surface px-3 py-2 text-base text-foreground outline-none placeholder:text-dim focus:border-accent/60"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => void createClosure()}
                  disabled={isSavingClosure}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/35 bg-accent/10 py-3 text-base text-accent active:scale-[0.98] disabled:opacity-40"
                >
                  {isSavingClosure ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CalendarDays className="size-4" />
                  )}
                  Guardar inhabilitación
                </button>
              </section>

              <section className="rounded-2xl border border-divider bg-input/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      Inhabilitaciones vigentes
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      Las puntuales vencen al terminar su fecha.
                    </p>
                  </div>
                  <span className="rounded-full border border-divider px-2 py-1 text-sm text-muted">
                    {closures.length}
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {closures.length === 0 ? (
                    <p className="rounded-xl border border-divider bg-surface px-3 py-4 text-center text-sm text-dim">
                      No hay bloques inhabilitados.
                    </p>
                  ) : (
                    closures.map((closure) => {
                      const closureKey = getClosureKey(closure);
                      const isRemoving = removingClosureKey === closureKey;
                      const closureLabel = getClosureLabel(closure, configuration.timeBlocks);

                      return (
                        <article
                          key={closureKey}
                          className="flex items-start gap-3 rounded-xl border border-divider bg-surface px-3 py-3"
                        >
                          {closure.scope === "weekly" ? (
                            <Repeat2
                              className="mt-0.5 size-4 shrink-0 text-accent"
                              aria-hidden="true"
                            />
                          ) : closure.scope === "period" ? (
                            <CalendarRange
                              className="mt-0.5 size-4 shrink-0 text-accent"
                              aria-hidden="true"
                            />
                          ) : (
                            <CalendarDays
                              className="mt-0.5 size-4 shrink-0 text-accent"
                              aria-hidden="true"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{closureLabel}</p>
                            <p className="mt-1 text-sm text-muted">{closure.reason}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void removeClosure(closure)}
                            disabled={isRemoving}
                            aria-label={`Anular ${closureLabel}`}
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/5 text-rose-400 disabled:opacity-40"
                          >
                            {isRemoving ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </button>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-divider bg-input/20 p-4">
                <div className="flex items-start gap-3 text-accent">
                  <ShieldAlert className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Reglas de castigo</h2>
                    <p className="mt-1 text-sm text-muted">
                      Cada falta se evalúa en una ventana móvil. La sanción se aplica al alcanzar
                      exactamente el umbral.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <label className="flex flex-col gap-2 text-sm text-muted">
                    Tipo de falta
                    <select
                      value={disciplineViolationType}
                      onChange={(event) => {
                        if (isDisciplineViolationType(event.target.value)) {
                          setDisciplineViolationType(event.target.value);
                        }
                      }}
                      className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                    >
                      {Object.entries(DISCIPLINE_VIOLATION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-2 text-sm text-muted">
                      Repeticiones
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={disciplineThreshold}
                        onChange={(event) => setDisciplineThreshold(event.target.value)}
                        className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-muted">
                      En últimos días
                      <input
                        type="number"
                        min="1"
                        max="365"
                        step="1"
                        value={disciplineWindowDays}
                        onChange={(event) => setDisciplineWindowDays(event.target.value)}
                        className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-2 text-sm text-muted">
                    Sanción
                    <select
                      value={disciplineActionKind}
                      onChange={(event) => {
                        if (isDisciplineActionKind(event.target.value)) {
                          setDisciplineActionKind(event.target.value);
                        }
                      }}
                      className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                    >
                      {Object.entries(DISCIPLINE_ACTION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => void saveDisciplineRule()}
                  disabled={isSavingDiscipline}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/35 bg-accent/10 py-3 text-base text-accent active:scale-[0.98] disabled:opacity-40"
                >
                  {isSavingDiscipline ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldAlert className="size-4" />
                  )}
                  Guardar regla
                </button>

                <div className="mt-4 flex flex-col gap-2">
                  {disciplineRules.length === 0 ? (
                    <p className="rounded-xl border border-divider bg-surface px-3 py-4 text-center text-sm text-dim">
                      No hay reglas de castigo activas.
                    </p>
                  ) : (
                    disciplineRules.map((rule) => {
                      const isRemoving = removingDisciplineRuleId === rule.discipline_rule_id;
                      const actionLabel = DISCIPLINE_ACTION_LABELS[rule.action_kind];
                      const violationLabel = DISCIPLINE_VIOLATION_LABELS[rule.violation_type];

                      return (
                        <article
                          key={rule.discipline_rule_id}
                          className="flex items-center gap-3 rounded-xl border border-divider bg-surface px-3 py-3"
                        >
                          <ShieldAlert className="size-4 shrink-0 text-accent" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {getDisciplineRuleSummary(rule)} en {rule.window_days} días
                            </p>
                            <p className="mt-1 text-sm text-muted">{actionLabel}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void removeDisciplineRule(rule.discipline_rule_id)}
                            disabled={isRemoving}
                            aria-label={`Desactivar regla: ${violationLabel}`}
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/5 text-rose-400 disabled:opacity-40"
                          >
                            {isRemoving ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </button>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-divider bg-input/20 p-4">
                <div className="flex items-start gap-3 text-accent">
                  <UserRoundSearch className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Acceso de usuarios</h2>
                    <p className="mt-1 text-sm text-muted">
                      Deshabilita o restaura una cuenta por su usuario institucional. No elimina su
                      historial.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <input
                    type="search"
                    value={userQuery}
                    onChange={(event) => setUserQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void searchUsers();
                    }}
                    placeholder="usuario institucional"
                    className="gusm-control-height min-w-0 flex-1 rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none placeholder:text-dim focus:border-accent/60"
                  />
                  <button
                    type="button"
                    onClick={() => void searchUsers()}
                    disabled={isSearchingUsers}
                    className="flex shrink-0 items-center justify-center rounded-xl border border-accent/35 bg-accent/10 px-3 text-accent active:scale-[0.98] disabled:opacity-40"
                    aria-label="Buscar usuario"
                  >
                    {isSearchingUsers ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserRoundSearch className="size-4" />
                    )}
                  </button>
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  {userSearchResults.map((user) => {
                    const isUpdating = isUpdatingUserAccess === user.user_id;
                    const isDisabled = user.disabled_at !== null;

                    return (
                      <article
                        key={user.user_id}
                        className="flex items-center gap-3 rounded-xl border border-divider bg-surface px-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-medium text-foreground">
                            {user.user_name}
                          </p>
                          <p className="mt-1 truncate text-sm text-muted">
                            {user.institutional_username} · {user.user_role}
                          </p>
                          {isDisabled && user.disabled_reason && (
                            <p className="mt-1 text-sm text-rose-400">{user.disabled_reason}</p>
                          )}
                        </div>
                        {isDisabled ? (
                          <button
                            type="button"
                            onClick={() => void updateUserAccess("restore", user)}
                            disabled={isUpdating}
                            className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-accent/35 bg-accent/10 px-2.5 text-base text-accent disabled:opacity-40"
                          >
                            {isUpdating ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <RotateCcw className="size-4" />
                            )}
                            Restaurar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSuspensionTarget(user)}
                            disabled={isUpdating || user.user_role === "admin"}
                            className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 text-base text-rose-400 disabled:opacity-40"
                          >
                            <Ban className="size-4" />
                            Suspender
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-divider bg-input/20 p-4">
                <h2 className="text-base font-semibold text-foreground">Exportación operativa</h2>
                <p className="mt-1 text-sm text-muted">
                  Filtra reservas, asistencia, warnings o sanciones. Los datos de perfil
                  corresponden al instante de cada registro.
                </p>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-divider bg-surface p-1">
                  <button
                    type="button"
                    onClick={() => setExportPeriod("week")}
                    className={`rounded-lg py-2 text-base ${exportPeriod === "week" ? "bg-accent-fill text-accent-foreground" : "text-muted"}`}
                  >
                    Semana
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportPeriod("month")}
                    className={`rounded-lg py-2 text-base ${exportPeriod === "month" ? "bg-accent-fill text-accent-foreground" : "text-muted"}`}
                  >
                    Mes
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportPeriod("custom")}
                    className={`rounded-lg py-2 text-base ${exportPeriod === "custom" ? "bg-accent-fill text-accent-foreground" : "text-muted"}`}
                  >
                    Rango
                  </button>
                </div>

                {exportPeriod === "custom" ? (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-2 text-sm text-muted">
                      Desde
                      <input
                        type="date"
                        value={exportStartDate}
                        onChange={(event) => setExportStartDate(event.target.value)}
                        className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-muted">
                      Hasta
                      <input
                        type="date"
                        value={exportEndDate}
                        onChange={(event) => setExportEndDate(event.target.value)}
                        className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="mt-3 flex flex-col gap-2 text-sm text-muted">
                    Fecha de referencia
                    <input
                      type="date"
                      value={exportAnchor}
                      onChange={(event) => setExportAnchor(event.target.value)}
                      className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                    />
                  </label>
                )}

                <label className="mt-3 flex flex-col gap-2 text-sm text-muted">
                  Categoría
                  <select
                    value={exportCategory}
                    onChange={(event) => {
                      const category = event.target.value;
                      if (isExportCategory(category)) setExportCategory(category);
                    }}
                    className="gusm-control-height rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none focus:border-accent/60"
                  >
                    {Object.entries(EXPORT_CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="mt-2 text-sm text-dim">
                  {getDateLabel(exportRange.startDate)} a {getDateLabel(exportRange.endDate)}. El
                  rango máximo es de 32 días.
                </p>

                <a
                  href={exportUrl}
                  onClick={validateExportRange}
                  aria-disabled={!isExportRangeValid}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-accent/35 bg-accent/10 px-4 py-2.5 text-base text-accent active:scale-[0.98]"
                >
                  <Download className="size-4" aria-hidden="true" />
                  Descargar CSV
                </a>
              </section>
            </>
          )}
        </div>

        {suspensionTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay px-5">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="suspension-title"
              className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-surface p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium tracking-widest text-rose-400">SUSPENSIÓN</p>
                  <h2 id="suspension-title" className="mt-2 text-xl font-semibold text-foreground">
                    Deshabilitar a {suspensionTarget.user_name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSuspensionTarget(null)}
                  aria-label="Cancelar suspensión"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-input hover:text-foreground active:scale-95"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                El usuario no podrá iniciar sesión ni realizar operaciones hasta que restaures su
                acceso.
              </p>
              <label className="mt-4 flex flex-col gap-2 text-sm text-muted">
                Motivo
                <textarea
                  value={suspensionReason}
                  onChange={(event) => setSuspensionReason(event.target.value)}
                  maxLength={240}
                  rows={3}
                  placeholder="Ej.: Incumplimiento reiterado de las normas"
                  className="rounded-xl border border-divider bg-input px-3 py-2 text-base text-foreground outline-none placeholder:text-dim focus:border-rose-500/60"
                />
              </label>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSuspensionTarget(null)}
                  className="flex flex-1 items-center justify-center rounded-xl border border-divider bg-input px-3 py-2.5 text-base text-foreground active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmSuspension}
                  disabled={isUpdatingUserAccess === suspensionTarget.user_id}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2.5 text-base text-rose-400 active:scale-[0.98] disabled:opacity-40"
                >
                  {isUpdatingUserAccess === suspensionTarget.user_id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Ban className="size-4" />
                  )}
                  Suspender
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
