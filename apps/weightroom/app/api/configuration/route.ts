import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { createResponse, getAuthenticatedUserId, isSameOrigin } from "./_shared";

export const runtime = "nodejs";

const SETTINGS_SCHEMA = z.object({
  nSessionsPerDay: z.number().int().min(1).max(32767),
  overcapacityMaxAbove: z.number().int().min(0).max(32767),
});

const CONFIGURATION_SCHEMA = z.object({
  settings: SETTINGS_SCHEMA.extend({ standardCapacity: z.number().int().positive() }),
  timeBlocks: z.array(
    z.object({
      timeBlockId: z.number().int().positive(),
      startTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
    }),
  ),
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

export async function GET(request: NextRequest) {
  const response = new NextResponse();
  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { data, error } = await serviceRoleClient.rpc("get_admin_configuration", {
    p_actor_user_id: userId,
  });
  const configuration = CONFIGURATION_SCHEMA.safeParse(data);

  if (error) {
    console.error("[CONFIGURATION] configuration read was rejected.");
    return createResponse(response, 403, { code: "configuration_unavailable" });
  }

  if (!configuration.success) {
    console.error("[CONFIGURATION] configuration RPC returned an invalid payload.");
    return createResponse(response, 503, { code: "configuration_unavailable" });
  }

  return createResponse(response, 200, configuration.data);
}

export async function POST(request: NextRequest) {
  const response = new NextResponse();

  if (!isSameOrigin(request)) return createResponse(response, 403, { code: "invalid_request" });
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return createResponse(response, 415, { code: "invalid_request" });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return createResponse(response, 400, { code: "invalid_request" });
  }

  const settings = SETTINGS_SCHEMA.safeParse(payload);
  if (!settings.success) return createResponse(response, 400, { code: "invalid_request" });

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { error } = await serviceRoleClient.rpc("update_admin_operational_settings", {
    p_actor_user_id: userId,
    p_n_sessions_per_day: settings.data.nSessionsPerDay,
    p_overcapacity_max_above: settings.data.overcapacityMaxAbove,
  });

  if (error) {
    console.error("[CONFIGURATION] operational settings update was rejected.");
    return createResponse(response, 409, { code: "settings_not_updated" });
  }

  return createResponse(response, 204, {});
}
