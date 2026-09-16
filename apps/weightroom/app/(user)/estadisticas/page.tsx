"use client";

import { useReducedMotion, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { CREATE_SUPABASE_BROWSER_CLIENT } from "@gusm/database/client";
import clsx from "clsx";
import { UserTopBar } from "@/components/UserTopBar";
import { getCurrentUser } from "@/lib/current-user";
import { clearProfileCache } from "@/lib/profile-cache";
import { APP_STATISTICS_QUERY_KEY, CURRENT_USER_QUERY_KEY } from "@/lib/query-keys";
import { getAppStatistics, type AppStatistics } from "@/lib/statistics";

const PLURAL_RULES = new Intl.PluralRules("es-CL");
const MONTH_FORMATTER = new Intl.DateTimeFormat("es-CL", { month: "short" });
const MONTH_WITH_YEAR_FORMATTER = new Intl.DateTimeFormat("es-CL", {
  month: "long",
  year: "numeric",
});
const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

function getPlural(count: number, singular: string, plural: string) {
  return PLURAL_RULES.select(count) === "one" ? singular : plural;
}

function getMonthLabel(month: string) {
  return MONTH_FORMATTER.format(new Date(`${month}-01T12:00:00.000Z`)).replace(".", "");
}

function getMonthWithYearLabel(month: string) {
  return MONTH_WITH_YEAR_FORMATTER.format(new Date(`${month}-01T12:00:00.000Z`)).replace(
    /^./,
    (letter) => letter.toUpperCase(),
  );
}

function getMetricValueLabel(value: number, singular: string, plural: string) {
  return `${value} ${getPlural(value, singular, plural)}`;
}

function MetricGrid({ statistics }: { statistics: AppStatistics }) {
  const metrics = [
    {
      detail: `de ${getMetricValueLabel(statistics.registeredParticipants, "registro", "registros")}`,
      label: "Participantes activos",
      value: statistics.activeParticipants,
    },
    {
      detail: "en los últimos seis meses",
      label: "Reservas",
      value: statistics.bookings,
    },
    {
      detail: "check-ins registrados",
      label: "Asistencias",
      value: statistics.attendances,
    },
    {
      detail: "sobre asistencias finalizadas",
      label: "Tasa de asistencia",
      value: `${statistics.attendanceRate}%`,
    },
  ];

  return (
    <section
      aria-label="Resumen de actividad"
      className="grid grid-cols-2 overflow-hidden rounded-2xl border border-divider bg-input/30"
    >
      {metrics.map((metric, index) => (
        <div
          key={metric.label}
          className={clsx(
            "min-h-28 px-4 py-4",
            index % 2 === 0 && "border-r border-divider",
            index < 2 && "border-b border-divider",
          )}
        >
          <p className="text-sm font-medium text-foreground">{metric.label}</p>
          <p className="mt-2 text-2xl font-semibold text-accent tabular-nums">{metric.value}</p>
          <p className="mt-1 text-xs leading-4 text-muted">{metric.detail}</p>
        </div>
      ))}
    </section>
  );
}

function MonthlyHistogram({
  statistics,
  scrollRef,
}: {
  statistics: AppStatistics;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const shouldReduceMotion = useReducedMotion();
  const maximumValue = Math.max(
    0,
    ...statistics.monthly.flatMap((month) => [month.absences, month.attendees, month.bookings]),
  );
  const hasActivity = maximumValue > 0;

  return (
    <section className="rounded-2xl border border-divider bg-input/30 px-4 py-4">
      <div className="flex flex-col gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Actividad mensual</h2>
          <p className="mt-1 text-sm text-muted">
            Reservas, asistencias e inasistencias de los últimos seis meses.
          </p>
        </div>
        <div
          aria-label="Leyenda"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"
        >
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-capacity-segment-blue" aria-hidden="true" />
            Reservas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-capacity-segment-yellow" aria-hidden="true" />
            Asistencias
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-capacity-segment-red" aria-hidden="true" />
            Inasistencias
          </span>
        </div>
      </div>

      {hasActivity ? (
        <div
          ref={scrollRef}
          className="mt-5 snap-x snap-mandatory [scrollbar-width:thin] overflow-x-auto overscroll-x-contain pb-3"
          role="img"
          aria-label="Histograma de actividad mensual. Desliza para revisar los seis meses."
        >
          <div className="flex w-max gap-3">
            {statistics.monthly.map((month, index) => {
              const bookingHeight = Math.max((month.bookings / maximumValue) * 100, 3);
              const attendanceHeight = Math.max((month.attendees / maximumValue) * 100, 3);
              const absenceHeight = Math.max((month.absences / maximumValue) * 100, 3);
              const monthLabel = getMonthLabel(month.month);

              return (
                <div
                  key={month.month}
                  className="flex w-[clamp(4.5rem,calc((100vw-7.5rem)/4),6.25rem)] shrink-0 snap-start flex-col justify-end gap-2"
                >
                  <div className="relative flex h-36 items-end justify-center gap-1.5 border-b border-divider/80 px-1">
                    <motion.div
                      aria-label={`${monthLabel}: ${getMetricValueLabel(month.bookings, "reserva", "reservas")}`}
                      className="w-[29%] rounded-t-md bg-capacity-segment-blue"
                      initial={shouldReduceMotion ? false : { scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: index * 0.045, duration: 0.42, ease: "easeOut" }}
                      style={{ height: `${bookingHeight}%`, transformOrigin: "bottom" }}
                    />
                    <motion.div
                      aria-label={`${monthLabel}: ${getMetricValueLabel(month.attendees, "asistencia", "asistencias")}`}
                      className="w-[29%] rounded-t-md bg-capacity-segment-yellow"
                      initial={shouldReduceMotion ? false : { scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: index * 0.045 + 0.07, duration: 0.42, ease: "easeOut" }}
                      style={{ height: `${attendanceHeight}%`, transformOrigin: "bottom" }}
                    />
                    <motion.div
                      aria-label={`${monthLabel}: ${getMetricValueLabel(month.absences, "inasistencia", "inasistencias")}`}
                      className="w-[29%] rounded-t-md bg-capacity-segment-red"
                      initial={shouldReduceMotion ? false : { scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: index * 0.045 + 0.14, duration: 0.42, ease: "easeOut" }}
                      style={{ height: `${absenceHeight}%`, transformOrigin: "bottom" }}
                    />
                  </div>
                  <span className="text-center text-sm text-muted capitalize">{monthLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-6 flex h-44 items-center justify-center border-y border-divider/80 px-6 text-center text-sm leading-6 text-muted">
          Aún no hay reservas ni asistencias en este período.
        </div>
      )}
    </section>
  );
}

function getMonthHeatmapDays(
  statistics: AppStatistics,
  month: string,
): Array<AppStatistics["daily"][number] | null> {
  const monthStart = new Date(`${month}-01T12:00:00.000Z`);
  const firstWeekday = (monthStart.getUTCDay() + 6) % 7;
  const days = statistics.daily.filter((day) => day.date.startsWith(month));
  const emptyDays = Array.from({ length: firstWeekday }, () => null);

  return [...emptyDays, ...days];
}

function getHeatmapCellClass(day: AppStatistics["daily"][number]) {
  const peak = Math.max(day.absences, day.attendees, day.bookings);

  if (day.absences > 0) {
    return peak >= 3
      ? "bg-capacity-segment-red text-white"
      : "bg-capacity-segment-red/65 text-white";
  }

  if (day.attendees > 0) {
    return peak >= 3 ? "bg-accent text-accent-foreground" : "bg-accent/65 text-accent-foreground";
  }

  if (day.bookings > 0) {
    return peak >= 3
      ? "bg-capacity-segment-blue text-white"
      : "bg-capacity-segment-blue/65 text-white";
  }

  return "border border-divider bg-input text-dim";
}

function getHeatmapCellLabel(day: AppStatistics["daily"][number]) {
  const values = [
    getMetricValueLabel(day.bookings, "reserva", "reservas"),
    getMetricValueLabel(day.attendees, "asistencia", "asistencias"),
    getMetricValueLabel(day.absences, "inasistencia", "inasistencias"),
  ];

  return `${day.date}: ${values.join(", ")}`;
}

function ActivityHeatmap({
  statistics,
  scrollRef,
}: {
  statistics: AppStatistics;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <section className="rounded-2xl border border-divider bg-input/30 px-4 py-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Mapa de actividad</h2>
        <p className="mt-1 text-sm text-muted">
          Cada celda representa un día. Desliza para revisar meses anteriores.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="mt-5 snap-x snap-mandatory [scrollbar-width:thin] overflow-x-auto overscroll-x-contain pb-3"
        role="region"
        aria-label="Mapa mensual de actividad"
      >
        <div className="flex w-max gap-3">
          {statistics.monthly.map((month) => (
            <article
              key={month.month}
              className="w-[calc(100vw-4rem)] max-w-[28.5rem] shrink-0 snap-end"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {getMonthWithYearLabel(month.month)}
                </h3>
                <span className="text-xs text-muted">día a día</span>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1.5" aria-hidden="true">
                {WEEKDAY_LABELS.map((weekday) => (
                  <span key={weekday} className="text-center text-xs text-muted">
                    {weekday}
                  </span>
                ))}
              </div>
              <div className="mt-1.5 grid grid-cols-7 gap-1.5">
                {getMonthHeatmapDays(statistics, month.month).map((day, index) =>
                  day ? (
                    <span
                      key={day.date}
                      aria-label={getHeatmapCellLabel(day)}
                      className={clsx(
                        "flex aspect-square min-h-10 items-center justify-center rounded-md text-xs font-medium tabular-nums",
                        getHeatmapCellClass(day),
                      )}
                    >
                      {Number(day.date.slice(-2))}
                    </span>
                  ) : (
                    <span
                      key={`empty-${month.month}-${index}`}
                      className="aspect-square"
                      aria-hidden="true"
                    />
                  ),
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div
        aria-label="Leyenda del mapa"
        className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted"
      >
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-accent" aria-hidden="true" />
          Asistencia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-capacity-segment-blue" aria-hidden="true" />
          Reserva
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-capacity-segment-red" aria-hidden="true" />
          Inasistencia
        </span>
      </div>
    </section>
  );
}

function StatisticsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-label="Cargando estadísticas" aria-busy="true">
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-divider bg-input/30">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={clsx(
              "min-h-28 animate-pulse bg-ghost/60",
              index % 2 === 0 && "border-r border-divider",
              index < 2 && "border-b border-divider",
            )}
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-divider bg-input/30" />
    </div>
  );
}

export default function StatisticsPage() {
  const router = useRouter();
  const histogramScrollRef = useRef<HTMLDivElement>(null);
  const heatmapScrollRef = useRef<HTMLDivElement>(null);
  const hasPositionedCharts = useRef(false);
  const currentUserQuery = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getCurrentUser,
  });
  const statisticsQuery = useQuery({
    queryKey: APP_STATISTICS_QUERY_KEY,
    queryFn: getAppStatistics,
    staleTime: 5 * 60 * 1_000,
  });
  const currentUser = currentUserQuery.data;

  useLayoutEffect(() => {
    if (!statisticsQuery.data || hasPositionedCharts.current) return;

    for (const element of [histogramScrollRef.current, heatmapScrollRef.current]) {
      if (element) element.scrollLeft = element.scrollWidth;
    }

    hasPositionedCharts.current = true;
  }, [statisticsQuery.data]);

  async function signOut() {
    const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[STATISTICS] could not sign out.", error);
      return;
    }

    clearProfileCache();
    router.replace("/login");
  }

  return (
    <main className="flex min-h-svh w-full justify-center bg-bg">
      <div className="flex h-svh gusm-app-shell flex-col overflow-hidden">
        <header className="z-20 shrink-0 border-b border-divider bg-surface">
          <UserTopBar
            pageTitle="Estadísticas"
            showActiveBookings={false}
            role={currentUser?.role}
            onGoBookings={() => router.push("/reserva")}
            onGoOvercapacity={() => router.push("/bloque")}
            onGoRoutines={() => router.push("/rutinas")}
            onGoSettings={() => router.push("/configuracion")}
            onSignOut={signOut}
          />
        </header>

        <section className="gusm-page-scroll px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
          <h1 className="text-xl font-semibold text-foreground">La sala en cifras</h1>
          <p className="mt-1 text-sm leading-6 text-muted">
            Actividad agregada de quienes reservan y entrenan en la sala.
          </p>

          <div className="mt-6">
            {statisticsQuery.isPending ? (
              <StatisticsSkeleton />
            ) : statisticsQuery.isError || !statisticsQuery.data ? (
              <div className="rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-5">
                <p className="text-base font-medium text-foreground">
                  No fue posible cargar las estadísticas.
                </p>
                <button
                  type="button"
                  onClick={() => void statisticsQuery.refetch()}
                  className="mt-3 min-h-11 rounded-xl bg-accent-fill px-4 text-base font-semibold text-accent-foreground transition-colors hover:bg-accent-fill/85 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-[0.98]"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <MetricGrid statistics={statisticsQuery.data} />
                <MonthlyHistogram
                  statistics={statisticsQuery.data}
                  scrollRef={histogramScrollRef}
                />
                <ActivityHeatmap statistics={statisticsQuery.data} scrollRef={heatmapScrollRef} />
                <p className="px-1 text-xs leading-5 text-muted">
                  Los datos son agregados y se actualizan al volver a esta vista. No se muestran
                  identidades ni información personal.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
