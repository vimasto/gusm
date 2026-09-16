import { NextResponse, type NextRequest } from "next/server";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { createResponse, getAuthenticatedUserId } from "@/app/api/block/_shared";

export const runtime = "nodejs";

const MONTH_COUNT = 6;
const BOOKING_PAGE_SIZE = 1_000;

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

function getSantiagoMonthKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "America/Santiago",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) throw new Error("Santiago month could not be formatted.");

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

async function getBookingRows(startDate: string, endDate: string) {
  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const rows = [];

  for (let from = 0; ; from += BOOKING_PAGE_SIZE) {
    const { data, error } = await serviceRoleClient
      .from("booking")
      .select("booking_date, status, user_id")
      .gte("booking_date", startDate)
      .lte("booking_date", endDate)
      .order("booking_date", { ascending: true })
      .order("booking_id", { ascending: true })
      .range(from, from + BOOKING_PAGE_SIZE - 1);

    if (error || !data) throw new Error("Statistics booking query was rejected.");

    rows.push(...data);
    if (data.length < BOOKING_PAGE_SIZE) return rows;
  }
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

    const startDate = `${firstMonth}-01`;
    const endDate = getMonthEndDate(lastMonth);
    const [{ count: registeredParticipants, error: participantError }, bookingRows] =
      await Promise.all([
        serviceRoleClient
          .from("app_user")
          .select("user_id", { count: "exact", head: true })
          .is("disabled_at", null),
        getBookingRows(startDate, endDate),
      ]);

    if (participantError) throw new Error("Statistics participant query was rejected.");

    const monthlyBuckets = new Map<string, MonthlyBucket>();
    for (const month of monthKeys) {
      monthlyBuckets.set(month, { absences: 0, attendees: 0, bookings: 0, month });
    }

    const dailyBuckets = new Map<string, DailyBucket>();
    for (const date of getDayKeys(startDate, endDate)) {
      dailyBuckets.set(date, { absences: 0, attendees: 0, bookings: 0, date });
    }

    const activeParticipantIds = new Set<string>();
    let attendances = 0;
    let absences = 0;

    for (const booking of bookingRows) {
      const month = booking.booking_date.slice(0, 7);
      const monthlyBucket = monthlyBuckets.get(month);
      const dailyBucket = dailyBuckets.get(booking.booking_date);
      if (!monthlyBucket || !dailyBucket) continue;

      monthlyBucket.bookings += 1;
      dailyBucket.bookings += 1;
      activeParticipantIds.add(booking.user_id);

      if (booking.status === "present") {
        monthlyBucket.attendees += 1;
        dailyBucket.attendees += 1;
        attendances += 1;
      } else if (booking.status === "absent") {
        monthlyBucket.absences += 1;
        dailyBucket.absences += 1;
        absences += 1;
      }
    }

    const completedAttendance = attendances + absences;
    const attendanceRate =
      completedAttendance === 0 ? 0 : Math.round((attendances / completedAttendance) * 100);

    return createResponse(response, 200, {
      activeParticipants: activeParticipantIds.size,
      attendanceRate,
      attendances,
      bookings: bookingRows.length,
      monthly: monthKeys
        .map((month) => monthlyBuckets.get(month))
        .filter((bucket) => bucket !== undefined),
      daily: [...dailyBuckets.values()],
      registeredParticipants: registeredParticipants ?? 0,
    });
  } catch (error) {
    console.error("[STATISTICS] could not aggregate operational statistics.", error);
    return createResponse(response, 500, { code: "statistics_unavailable" });
  }
}
