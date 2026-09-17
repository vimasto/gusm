import * as z from "zod/v4";

const MONTHLY_STATISTICS_SCHEMA = z.object({
  absences: z.number().int().nonnegative(),
  attendees: z.number().int().nonnegative(),
  bookings: z.number().int().nonnegative(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

const DAILY_STATISTICS_SCHEMA = z.object({
  absences: z.number().int().nonnegative(),
  attendees: z.number().int().nonnegative(),
  bookings: z.number().int().nonnegative(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const WEEKDAY_ATTENDANCE_SCHEMA = z.object({
  average: z.number().nonnegative(),
  weekday: z.number().int().min(1).max(5),
});

const WEEKLY_OCCUPANCY_SCHEMA = z.object({
  capacity: z.number().int().nonnegative(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  occupied: z.number().int().nonnegative(),
  state: z.enum(["closed", "current", "future", "past"]),
  weekday: z.number().int().min(1).max(5),
});

const TOP_STREAK_USER_SCHEMA = z.object({
  streakWeeks: z.number().int().nonnegative(),
  totalAttendances: z.number().int().positive(),
  userName: z.string().min(1),
});

const APP_STATISTICS_SCHEMA = z.object({
  activeParticipants: z.number().int().nonnegative(),
  attendanceRate: z.number().int().min(0).max(100),
  attendances: z.number().int().nonnegative(),
  bookings: z.number().int().nonnegative(),
  daily: z.array(DAILY_STATISTICS_SCHEMA),
  historyStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monthly: z.array(MONTHLY_STATISTICS_SCHEMA).length(6),
  registeredParticipants: z.number().int().nonnegative(),
  topStreakUsers: z.array(TOP_STREAK_USER_SCHEMA).max(10),
  weekdayAttendance: z.array(WEEKDAY_ATTENDANCE_SCHEMA).length(5),
  weeklyOccupancy: z.array(WEEKLY_OCCUPANCY_SCHEMA).length(5),
});

export type AppStatistics = z.infer<typeof APP_STATISTICS_SCHEMA>;
export type DailyAttendance = Pick<AppStatistics["daily"][number], "attendees" | "date">;
export type WeekdayAttendance = AppStatistics["weekdayAttendance"][number];
export type WeeklyOccupancy = AppStatistics["weeklyOccupancy"][number];
export type TopStreakUser = AppStatistics["topStreakUsers"][number];

export async function getAppStatistics(): Promise<AppStatistics> {
  const response = await fetch("/api/statistics", { cache: "no-store" });
  if (!response.ok) throw new Error("Statistics request was rejected.");

  const payload: unknown = await response.json();
  const statistics = APP_STATISTICS_SCHEMA.safeParse(payload);
  if (!statistics.success) throw new Error("Statistics response is invalid.");

  return statistics.data;
}
