"use client";

import {
  HeatmapCells,
  HeatmapChart,
  HeatmapInteractionBoundary,
  HeatmapInteractionProvider,
  HeatmapLegend,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
  type HeatmapColumn,
} from "@/components/charts/heatmap";
import type { DailyAttendance } from "@/lib/statistics";

type Props = {
  attendance: DailyAttendance[];
};

const WEEKEND_ROW_OPACITY = [1, 1, 1, 1, 1, 0, 0] as const;

function createDate(dateKey: string) {
  const [yearText, monthText, dayText] = dateKey.split("-");
  return new Date(Number(yearText), Number(monthText) - 1, Number(dayText), 12);
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function getSunday(date: Date) {
  const sunday = new Date(date);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  return sunday;
}

function createHeatmapColumns(attendance: DailyAttendance[]): HeatmapColumn[] {
  const firstDay = attendance.at(0);
  const lastDay = attendance.at(-1);

  if (!firstDay || !lastDay) return [];

  const attendanceByDate = new Map(attendance.map((day) => [day.date, day.attendees] as const));
  const start = getSunday(createDate(firstDay.date));
  const end = getSunday(createDate(lastDay.date));
  const columns: HeatmapColumn[] = [];

  for (
    let weekStart = new Date(start), columnIndex = 0;
    weekStart <= end;
    weekStart.setDate(weekStart.getDate() + 7), columnIndex += 1
  ) {
    const bins = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + dayIndex);

      return {
        bin: dayIndex,
        count: attendanceByDate.get(getDateKey(date)) ?? 0,
        date,
      };
    });

    columns.push({ bin: columnIndex, bins });
  }

  return columns;
}

function getAttendanceLabel(count: number) {
  return count === 1 ? "1 asistencia" : `${count} asistencias`;
}

export function AttendanceHeatmap({ attendance }: Props) {
  const columns = createHeatmapColumns(attendance);

  return (
    <section className="rounded-2xl border border-divider bg-input/30 px-4 py-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Asistencia diaria</h2>
        <p className="mt-1 text-sm text-muted">
          Cada celda representa asistentes registrados en una fecha.
        </p>
      </div>

      {columns.length > 0 ? (
        <HeatmapInteractionProvider>
          <HeatmapInteractionBoundary className="mt-5 overflow-x-auto overscroll-x-contain pb-1">
            <div className="min-w-[35rem] pr-2">
              <HeatmapChart
                animate
                animationDuration={640}
                data={columns}
                gap={3}
                margin={{ bottom: 0, left: 28, right: 4, top: 24 }}
                weekStartDay={1}
              >
                <HeatmapCells cornerRadius={4} rowOpacity={WEEKEND_ROW_OPACITY} />
                <HeatmapXAxis />
                <HeatmapYAxis
                  labelFormat="full"
                  rowOpacity={WEEKEND_ROW_OPACITY}
                  tickFilter="all"
                />
                <HeatmapTooltip formatLabel={(count) => getAttendanceLabel(count)} />
              </HeatmapChart>
              <HeatmapLegend
                align="end"
                labelClassName="text-muted"
                lessLabel="Menos"
                moreLabel="Más"
              />
            </div>
          </HeatmapInteractionBoundary>
        </HeatmapInteractionProvider>
      ) : (
        <div className="mt-5 flex h-36 items-center justify-center border-y border-divider/80 px-6 text-center text-sm leading-6 text-muted">
          Aún no hay asistencias para mostrar.
        </div>
      )}
    </section>
  );
}
