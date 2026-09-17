import { NextResponse, type NextRequest } from "next/server";
import { type Database } from "@gusm/database/database.types";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { createResponse, getAuthenticatedUserId } from "@/app/api/block/_shared";

export const runtime = "nodejs";

const MONTH_COUNT = 6;
const BOOKING_PAGE_SIZE = 1_000;

type BookingRow = Pick<
  Database["public"]["Tables"]["booking"]["Row"],
  "booking_date" | "status" | "user_id"
>;
type MonthlyBucket = {
  absences: number;
  attendees: number;
  bookings: number;
  month: string;
};
type DailyBucket = {
  absences: number;
  attendees: number;
  bookings: number;
  date: string;
};
type ClosureData = {
  blockIds: number[];
  dateClosures: Database["public"]["Tables"]["time_block_closure"]["Row"][];
  fullDayClosures: Database["public"]["Tables"]["full_day_closure_period"]["Row"][];
  weeklyClosures: Database["public"]["Tables"]["weekly_time_block_closure"]["Row"][];
};
type WeekdayAttendance = {
  average: number;
  weekday: number;
};
type WeeklyOccupancy = {
  capacity: number;
  date: string;
  occupied: number;
  state: "closed" | "current" | "future" | "past";
  weekday: number;
};
type TopStreakUser = {
  streakWeeks: number;
  totalAttendances: number;
  userName: string;
};
type ActiveUser = Pick<Database["public"]["Tables"]["app_user"]["Row"], "user_id" | "user_name">;

function getSantiagoDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Santiago",
    year: "numeric",
  }).formatToParts(new Date());
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;

  if (!day || !month || !year) throw new Error("Santiago date could not be formatted.");

  return { day, month, year };
}

function getSantiagoDateKey() {
  const { day, month, year } = getSantiagoDateParts();
  return `${year}-${month}-${day}`;
}

function getSantiagoMonthKey() {
  const { month, year } = getSantiagoDateParts();
  return `${year}-${month}`;
}

function getMonthKeys() {
  const [yearText, monthText] = getSantiagoMonthKey().split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const monthKeys: string[] = [];

  for (let offset = MONTH_COUNT - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    const keyYear = date.getUTCFullYear();
    const keyMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
    monthKeys.push(`${keyYear}-${keyMonth}`);
  }

  return monthKeys;
}

function getMonthEndDate(month: string) {
  const [yearText, monthText] = month.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText), 0));
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${month}-${day}`;
}

function getDateParts(dateKey: string) {
  const parts = dateKey.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error("Statistics date is invalid.");
  }

  return { day, month, year };
}

function getDayKeys(startDate: string, endDate: string) {
  const start = getDateParts(startDate);
  const end = getDateParts(endDate);
  const dayKeys: string[] = [];

  for (
    let timestamp = Date.UTC(start.year, start.month - 1, start.day);
    timestamp <= Date.UTC(end.year, end.month - 1, end.day);
    timestamp += 86_400_000
  ) {
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    dayKeys.push(`${year}-${month}-${day}`);
  }

  return dayKeys;
}

function getIsoWeekday(dateKey: string) {
  const { day, month, year } = getDateParts(dateKey);
  const sundayFirstWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return sundayFirstWeekday === 0 ? 7 : sundayFirstWeekday;
}

function addDays(dateKey: string, dayCount: number) {
  const { day, month, year } = getDateParts(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day + dayCount));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function getWeekStartDate(dateKey: string) {
  return addDays(dateKey, 1 - getIsoWeekday(dateKey));
}

async function getBookingRows(startDate: string, endDate: string, status?: "present") {
  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const rows: BookingRow[] = [];

  for (let from = 0; ; from += BOOKING_PAGE_SIZE) {
    let query = serviceRoleClient
      .from("booking")
      .select("booking_date, status, user_id")
      .gte("booking_date", startDate)
      .lte("booking_date", endDate);

    if (status) query = query.eq("status", status);

    const { data, error } = await query
      .order("booking_date", { ascending: true })
      .order("booking_id", { ascending: true })
      .range(from, from + BOOKING_PAGE_SIZE - 1);

    if (error || !data) throw new Error("Statistics booking query was rejected.");

    rows.push(...data);
    if (data.length < BOOKING_PAGE_SIZE) return rows;
  }
}

async function getFirstPresentDate() {
  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { data, error } = await serviceRoleClient
    .from("booking")
    .select("booking_date")
    .eq("status", "present")
    .order("booking_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Statistics history start query was rejected.");

  return data?.booking_date ?? null;
}

async function getClosureData(startDate: string, endDate: string): Promise<ClosureData> {
  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const [timeBlockResult, dateClosureResult, fullDayClosureResult, weeklyClosureResult] =
    await Promise.all([
      serviceRoleClient.from("time_block").select("time_block_id"),
      serviceRoleClient
        .from("time_block_closure")
        .select()
        .gte("closure_date", startDate)
        .lte("closure_date", endDate),
      serviceRoleClient
        .from("full_day_closure_period")
        .select()
        .lte("closure_start_date", endDate)
        .gte("closure_end_date", startDate),
      serviceRoleClient.from("weekly_time_block_closure").select(),
    ]);

  if (
    timeBlockResult.error ||
    dateClosureResult.error ||
    fullDayClosureResult.error ||
    weeklyClosureResult.error ||
    !timeBlockResult.data ||
    !dateClosureResult.data ||
    !fullDayClosureResult.data ||
    !weeklyClosureResult.data
  ) {
    throw new Error("Statistics closure query was rejected.");
  }

  return {
    blockIds: timeBlockResult.data.map((timeBlock) => timeBlock.time_block_id),
    dateClosures: dateClosureResult.data,
    fullDayClosures: fullDayClosureResult.data,
    weeklyClosures: weeklyClosureResult.data,
  };
}

function isOperatingDay(dateKey: string, closures: ClosureData) {
  const isoWeekday = getIsoWeekday(dateKey);
  if (isoWeekday > 5) return false;

  if (
    closures.fullDayClosures.some(
      (closure) => closure.closure_start_date <= dateKey && closure.closure_end_date >= dateKey,
    )
  ) {
    return false;
  }

  const closedBlockIds = new Set<number>();

  for (const closure of closures.dateClosures) {
    if (closure.closure_date === dateKey) closedBlockIds.add(closure.time_block_id);
  }

  for (const closure of closures.weeklyClosures) {
    if (closure.iso_weekday === isoWeekday) closedBlockIds.add(closure.time_block_id);
  }

  return closures.blockIds.some((timeBlockId) => !closedBlockIds.has(timeBlockId));
}

function getOpenBlockCount(dateKey: string, closures: ClosureData) {
  const isoWeekday = getIsoWeekday(dateKey);
  if (isoWeekday > 5) return 0;

  if (
    closures.fullDayClosures.some(
      (closure) => closure.closure_start_date <= dateKey && closure.closure_end_date >= dateKey,
    )
  ) {
    return 0;
  }

  const closedBlockIds = new Set<number>();

  for (const closure of closures.dateClosures) {
    if (closure.closure_date === dateKey) closedBlockIds.add(closure.time_block_id);
  }

  for (const closure of closures.weeklyClosures) {
    if (closure.iso_weekday === isoWeekday) closedBlockIds.add(closure.time_block_id);
  }

  return closures.blockIds.filter((timeBlockId) => !closedBlockIds.has(timeBlockId)).length;
}

function isClosureExemptWeek(weekStartDate: string, closures: ClosureData) {
  return getDayKeys(weekStartDate, addDays(weekStartDate, 4)).every((dateKey) =>
    closures.fullDayClosures.some(
      (closure) => closure.closure_start_date <= dateKey && closure.closure_end_date >= dateKey,
    ),
  );
}

function createAttendanceByDate(bookings: BookingRow[]) {
  const attendanceByDate = new Map<string, number>();

  for (const booking of bookings) {
    attendanceByDate.set(
      booking.booking_date,
      (attendanceByDate.get(booking.booking_date) ?? 0) + 1,
    );
  }

  return attendanceByDate;
}

function getWeekdayAverages(
  attendanceByDate: Map<string, number>,
  startDate: string,
  endDate: string,
  closures: ClosureData,
) {
  const attendees = new Map<number, number>();
  const operatingDays = new Map<number, number>();

  for (let weekday = 1; weekday <= 5; weekday += 1) {
    attendees.set(weekday, 0);
    operatingDays.set(weekday, 0);
  }

  for (const dateKey of getDayKeys(startDate, endDate)) {
    const weekday = getIsoWeekday(dateKey);
    if (!isOperatingDay(dateKey, closures)) continue;

    operatingDays.set(weekday, (operatingDays.get(weekday) ?? 0) + 1);
    attendees.set(weekday, (attendees.get(weekday) ?? 0) + (attendanceByDate.get(dateKey) ?? 0));
  }

  return Array.from({ length: 5 }, (_, index) => {
    const weekday = index + 1;
    const attendance = attendees.get(weekday) ?? 0;
    const days = operatingDays.get(weekday) ?? 0;

    return days === 0 ? 0 : Math.round((attendance / days) * 100) / 100;
  });
}

function getEligibleWeekStarts(firstDate: string, today: string, closures: ClosureData) {
  const eligibleWeekStarts: string[] = [];
  const firstWeekStart = getWeekStartDate(firstDate);
  const currentWeekStart = getWeekStartDate(today);

  for (
    let weekStart = firstWeekStart;
    weekStart <= currentWeekStart;
    weekStart = addDays(weekStart, 7)
  ) {
    if (!isClosureExemptWeek(weekStart, closures)) eligibleWeekStarts.push(weekStart);
  }

  return eligibleWeekStarts;
}

function getTopStreakUsers(
  attendanceRows: BookingRow[],
  activeUsers: ActiveUser[],
  eligibleWeekStarts: string[],
) {
  const attendanceCountByUserId = new Map<string, number>();
  const attendedWeekStartsByUserId = new Map<string, Set<string>>();

  for (const attendance of attendanceRows) {
    attendanceCountByUserId.set(
      attendance.user_id,
      (attendanceCountByUserId.get(attendance.user_id) ?? 0) + 1,
    );

    const attendedWeeks = attendedWeekStartsByUserId.get(attendance.user_id) ?? new Set<string>();
    attendedWeeks.add(getWeekStartDate(attendance.booking_date));
    attendedWeekStartsByUserId.set(attendance.user_id, attendedWeeks);
  }

  const recentEligibleWeekStarts = eligibleWeekStarts.slice(-2);
  const topUsers: TopStreakUser[] = [];

  for (const activeUser of activeUsers) {
    const totalAttendances = attendanceCountByUserId.get(activeUser.user_id) ?? 0;
    if (totalAttendances === 0) continue;

    const attendedWeekStarts = attendedWeekStartsByUserId.get(activeUser.user_id);
    if (!attendedWeekStarts) continue;

    let anchorIndex = -1;
    for (let index = recentEligibleWeekStarts.length - 1; index >= 0; index -= 1) {
      const weekStart = recentEligibleWeekStarts[index];
      if (weekStart && attendedWeekStarts.has(weekStart)) {
        anchorIndex = eligibleWeekStarts.lastIndexOf(weekStart);
        break;
      }
    }

    let streakWeeks = 0;
    for (let index = anchorIndex; index >= 0; index -= 1) {
      const weekStart = eligibleWeekStarts[index];
      if (!weekStart || !attendedWeekStarts.has(weekStart)) break;
      streakWeeks += 1;
    }

    topUsers.push({ streakWeeks, totalAttendances, userName: activeUser.user_name });
  }

  return topUsers
    .sort((first, second) => {
      if (second.streakWeeks !== first.streakWeeks) return second.streakWeeks - first.streakWeeks;
      if (second.totalAttendances !== first.totalAttendances) {
        return second.totalAttendances - first.totalAttendances;
      }
      return first.userName.localeCompare(second.userName, "es-CL");
    })
    .slice(0, 10);
}

function getWeeklyOccupancy(
  bookingRows: BookingRow[],
  weekStartDate: string,
  today: string,
  standardCapacity: number,
  closures: ClosureData,
) {
  const occupancyByDate = new Map<string, number>();

  for (const booking of bookingRows) {
    if (booking.booking_date < weekStartDate || booking.booking_date > addDays(weekStartDate, 4)) {
      continue;
    }

    const countsTowardOccupancy =
      booking.status === "present" ||
      (booking.booking_date >= today &&
        (booking.status === "reserved" || booking.status === "confirmed"));

    if (!countsTowardOccupancy) continue;

    occupancyByDate.set(booking.booking_date, (occupancyByDate.get(booking.booking_date) ?? 0) + 1);
  }

  const days: WeeklyOccupancy[] = [];
  for (let offset = 0; offset < 5; offset += 1) {
    const date = addDays(weekStartDate, offset);
    const capacity = getOpenBlockCount(date, closures) * standardCapacity;
    const state =
      capacity === 0 ? "closed" : date < today ? "past" : date === today ? "current" : "future";

    days.push({
      capacity,
      date,
      occupied: occupancyByDate.get(date) ?? 0,
      state,
      weekday: offset + 1,
    });
  }

  return days;
}

export async function GET(request: NextRequest) {
  const response = new NextResponse();
  const userId = await getAuthenticatedUserId(request, response);

  if (!userId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { data: currentUser, error: currentUserError } = await serviceRoleClient.rpc(
    "get_profile_overview",
    {
      p_actor_user_id: userId,
      p_target_user_id: userId,
    },
  );

  if (currentUserError || !currentUser?.at(0)) {
    return createResponse(response, 403, { code: "statistics_unavailable" });
  }

  try {
    const monthKeys = getMonthKeys();
    const firstMonth = monthKeys.at(0);
    const lastMonth = monthKeys.at(-1);

    if (!firstMonth || !lastMonth) throw new Error("Statistics months could not be generated.");

    const today = getSantiagoDateKey();
    const startDate = `${firstMonth}-01`;
    const endDate = getMonthEndDate(lastMonth);
    const [firstPresentDate, recentBookingRows, activeUsersResult, settingsResult] =
      await Promise.all([
        getFirstPresentDate(),
        getBookingRows(startDate, endDate),
        serviceRoleClient.from("app_user").select("user_id, user_name").is("disabled_at", null),
        serviceRoleClient
          .from("system_settings")
          .select("standard_capacity")
          .eq("singleton", true)
          .maybeSingle(),
      ]);

    if (activeUsersResult.error || settingsResult.error || !settingsResult.data) {
      throw new Error("Statistics participant or settings query was rejected.");
    }

    const historyStartDate = firstPresentDate ?? startDate;
    const currentWeekStartDate = getWeekStartDate(today);
    const closureEndDate = addDays(currentWeekStartDate, 4);
    const [historicalAttendanceRows, closureData, currentWeekBookingRows] = await Promise.all([
      getBookingRows(historyStartDate, today, "present"),
      getClosureData(historyStartDate, closureEndDate),
      getBookingRows(currentWeekStartDate, closureEndDate),
    ]);

    const monthlyBuckets = new Map<string, MonthlyBucket>();
    for (const month of monthKeys) {
      monthlyBuckets.set(month, { absences: 0, attendees: 0, bookings: 0, month });
    }

    const dailyBuckets = new Map<string, DailyBucket>();
    for (const date of getDayKeys(startDate, today)) {
      dailyBuckets.set(date, { absences: 0, attendees: 0, bookings: 0, date });
    }

    const activeParticipantIds = new Set<string>();
    let attendances = 0;
    let absences = 0;

    for (const booking of recentBookingRows) {
      const month = booking.booking_date.slice(0, 7);
      const monthlyBucket = monthlyBuckets.get(month);
      const dailyBucket = dailyBuckets.get(booking.booking_date);
      if (!monthlyBucket) continue;

      monthlyBucket.bookings += 1;
      activeParticipantIds.add(booking.user_id);

      if (booking.status === "present") {
        monthlyBucket.attendees += 1;
        attendances += 1;
        if (dailyBucket) dailyBucket.attendees += 1;
      } else if (booking.status === "absent") {
        monthlyBucket.absences += 1;
        absences += 1;
        if (dailyBucket) dailyBucket.absences += 1;
      }

      if (dailyBucket) dailyBucket.bookings += 1;
    }

    const attendanceByDate = createAttendanceByDate(historicalAttendanceRows);
    const historicalAverages = getWeekdayAverages(
      attendanceByDate,
      historyStartDate,
      today,
      closureData,
    );
    const weekdayAttendance: WeekdayAttendance[] = Array.from({ length: 5 }, (_, index) => ({
      average: historicalAverages[index] ?? 0,
      weekday: index + 1,
    }));
    const weeklyOccupancy = getWeeklyOccupancy(
      currentWeekBookingRows,
      currentWeekStartDate,
      today,
      settingsResult.data.standard_capacity,
      closureData,
    );
    const eligibleWeekStarts = getEligibleWeekStarts(historyStartDate, today, closureData);
    const topStreakUsers = getTopStreakUsers(
      historicalAttendanceRows,
      activeUsersResult.data,
      eligibleWeekStarts,
    );
    const completedAttendance = attendances + absences;
    const attendanceRate =
      completedAttendance === 0 ? 0 : Math.round((attendances / completedAttendance) * 100);

    return createResponse(response, 200, {
      activeParticipants: activeParticipantIds.size,
      attendanceRate,
      attendances,
      bookings: recentBookingRows.length,
      daily: [...dailyBuckets.values()],
      historyStartDate,
      monthly: monthKeys
        .map((month) => monthlyBuckets.get(month))
        .filter((bucket) => bucket !== undefined),
      registeredParticipants: activeUsersResult.data.length,
      topStreakUsers,
      weekdayAttendance,
      weeklyOccupancy,
    });
  } catch (error) {
    console.error("[STATISTICS] could not aggregate operational statistics.", error);
    return createResponse(response, 500, { code: "statistics_unavailable" });
  }
}
