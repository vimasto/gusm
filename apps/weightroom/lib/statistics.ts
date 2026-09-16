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

const APP_STATISTICS_SCHEMA = z.object({
  activeParticipants: z.number().int().nonnegative(),
  attendanceRate: z.number().int().min(0).max(100),
  attendances: z.number().int().nonnegative(),
  bookings: z.number().int().nonnegative(),
  daily: z.array(DAILY_STATISTICS_SCHEMA),
  monthly: z.array(MONTHLY_STATISTICS_SCHEMA).length(6),
  registeredParticipants: z.number().int().nonnegative(),
});

export type AppStatistics = z.infer<typeof APP_STATISTICS_SCHEMA>;

export async function getAppStatistics(): Promise<AppStatistics> {
  const response = await fetch("/api/statistics", { cache: "no-store" });
  if (!response.ok) throw new Error("Statistics request was rejected.");

  const payload: unknown = await response.json();
  const statistics = APP_STATISTICS_SCHEMA.safeParse(payload);
  if (!statistics.success) throw new Error("Statistics response is invalid.");

  return statistics.data;
}
