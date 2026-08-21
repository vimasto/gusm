import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVER_CLIENT } from "@gusm/database/client";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";

export const runtime = "nodejs";

const PROFILE_MONTH_SCHEMA = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const INCLUDE_ATTENDANCE_SCHEMA = z.enum(["true", "false"]);
const DATE_OF_BIRTH_SCHEMA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDate);

function isCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const PROFILE_DATA_SCHEMA = z
  .object({
    dateOfBirth: DATE_OF_BIRTH_SCHEMA.nullable(),
    reportedSex: z.enum(["masculino", "femenino", "otro", "prefiero_no_decir"]).nullable(),
    heightCm: z.number().int().finite().nullable(),
    weightKg: z.number().finite().nullable(),
  })
  .strict()
  .superRefine((profileData, context) => {
    if ((profileData.dateOfBirth === null) !== (profileData.reportedSex === null)) {
      context.addIssue({
        code: "custom",
        message: "dateOfBirth and reportedSex must be supplied together.",
      });
    }

    if (
      profileData.dateOfBirth === null &&
      profileData.heightCm === null &&
      profileData.weightKg === null
    ) {
      context.addIssue({
        code: "custom",
        message: "At least one profile value is required.",
      });
    }
  });

const PROFILE_OVERVIEW_SCHEMA = z.object({
  user_name: z.string().min(1),
  role: z.enum(["student", "u_staff", "gym_staff", "admin"]),
  institutional_username: z.string().min(1).nullable(),
  date_of_birth: DATE_OF_BIRTH_SCHEMA.nullable(),
  reported_sex: z.enum(["masculino", "femenino", "otro", "prefiero_no_decir"]).nullable(),
  height_cm: z.number().int().nullable(),
  weight_kg: z.number().nullable(),
  streak_weeks: z.number().int().nonnegative(),
  theme_preference: z.enum(["dark", "light"]),
});

const MONTHLY_ATTENDANCE_SCHEMA = z.object({
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendance_status: z.enum(["present", "absent"]),
});

type ProfileErrorCode =
  | "invalid_request"
  | "profile_load_failed"
  | "profile_update_failed"
  | "unauthenticated";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function createResponse(response: NextResponse, status: number, body?: Record<string, unknown>) {
  const result = body
    ? NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
    : new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });

  for (const cookie of response.cookies.getAll()) {
    result.cookies.set(cookie.name, cookie.value, cookie);
  }

  return result;
}

function createErrorResponse(response: NextResponse, status: number, code: ProfileErrorCode) {
  return createResponse(response, status, { code });
}

async function getAuthenticatedUserId(request: NextRequest, response: NextResponse) {
  const sessionClient = CREATE_SUPABASE_SERVER_CLIENT({
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      for (const cookie of cookiesToSet) {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      }
    },
  });
  const { data, error } = await sessionClient.auth.getClaims();
  const userId = data?.claims.sub;

  if (error || typeof userId !== "string" || userId.length === 0) {
    return null;
  }

  return userId;
}

export async function GET(request: NextRequest) {
  const month = PROFILE_MONTH_SCHEMA.safeParse(request.nextUrl.searchParams.get("month"));
  const includeAttendance = INCLUDE_ATTENDANCE_SCHEMA.safeParse(
    request.nextUrl.searchParams.get("includeAttendance") ?? "true",
  );
  const response = new NextResponse();

  if (!month.success || !includeAttendance.success) {
    return createErrorResponse(response, 400, "invalid_request");
  }

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) {
    return createErrorResponse(response, 401, "unauthenticated");
  }

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const monthStart = `${month.data}-01`;
  const [overviewResult, attendanceResult] = await Promise.all([
    serviceRoleClient.rpc("get_profile_overview", {
      p_actor_user_id: userId,
      p_target_user_id: userId,
    }),
    includeAttendance.data === "true"
      ? serviceRoleClient.rpc("get_profile_monthly_attendance", {
          p_actor_user_id: userId,
          p_target_user_id: userId,
          p_month_start: monthStart,
        })
      : Promise.resolve(null),
  ]);

  if (overviewResult.error || attendanceResult?.error) {
    console.error("[PROFILE] could not read the current profile data.");
    return createErrorResponse(response, 403, "profile_load_failed");
  }

  const overview = PROFILE_OVERVIEW_SCHEMA.safeParse(overviewResult.data?.at(0));
  const attendance = attendanceResult
    ? z.array(MONTHLY_ATTENDANCE_SCHEMA).safeParse(attendanceResult.data)
    : null;

  if (!overview.success || (attendance !== null && !attendance.success)) {
    console.error("[PROFILE] profile RPC returned an invalid response.");
    return createErrorResponse(response, 503, "profile_load_failed");
  }

  return createResponse(response, 200, {
    profile: {
      userName: overview.data.user_name,
      role: overview.data.role,
      institutionalUsername: overview.data.institutional_username,
      dateOfBirth: overview.data.date_of_birth,
      reportedSex: overview.data.reported_sex,
      heightCm: overview.data.height_cm,
      weightKg: overview.data.weight_kg,
      streakWeeks: overview.data.streak_weeks,
      themePreference: overview.data.theme_preference,
    },
    ...(attendance?.success
      ? {
          attendance: attendance.data.map((entry) => ({
            bookingDate: entry.booking_date,
            status: entry.attendance_status,
          })),
        }
      : {}),
  });
}

export async function POST(request: NextRequest) {
  const response = new NextResponse();

  if (!isSameOrigin(request)) {
    return createErrorResponse(response, 403, "invalid_request");
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return createErrorResponse(response, 415, "invalid_request");
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return createErrorResponse(response, 400, "invalid_request");
  }

  const profileData = PROFILE_DATA_SCHEMA.safeParse(payload);
  if (!profileData.success) {
    return createErrorResponse(response, 400, "invalid_request");
  }

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) {
    return createErrorResponse(response, 401, "unauthenticated");
  }

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { error } = await serviceRoleClient.rpc("record_profile_data_from_payload", {
    p_actor_user_id: userId,
    p_target_user_id: userId,
    p_profile_data: profileData.data,
  });

  if (error) {
    console.error("[PROFILE] could not record profile data.");
    return createErrorResponse(response, 403, "profile_update_failed");
  }

  return createResponse(response, 204);
}
