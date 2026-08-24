import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { createResponse, getAuthenticatedUserId, isSameOrigin } from "../_shared";

export const runtime = "nodejs";

const TIME_BLOCK_ID_SCHEMA = z.number().int().min(1).max(9);
const REASON_SCHEMA = z.string().trim().min(3).max(240);
const DATE_CLOSURE_SCHEMA = z.object({
  scope: z.literal("date"),
  timeBlockId: TIME_BLOCK_ID_SCHEMA,
  date: z.string().date(),
});
const PERIOD_CLOSURE_SCHEMA = z.object({
  scope: z.literal("period"),
  startDate: z.string().date(),
  endDate: z.string().date(),
});
const WEEKLY_CLOSURE_SCHEMA = z.object({
  scope: z.literal("weekly"),
  timeBlockId: TIME_BLOCK_ID_SCHEMA,
  isoWeekday: z.number().int().min(1).max(7),
});
const CREATE_CLOSURE_SCHEMA = z.discriminatedUnion("scope", [
  DATE_CLOSURE_SCHEMA.extend({ action: z.literal("create"), reason: REASON_SCHEMA }),
  PERIOD_CLOSURE_SCHEMA.extend({ action: z.literal("create"), reason: REASON_SCHEMA }),
  WEEKLY_CLOSURE_SCHEMA.extend({ action: z.literal("create"), reason: REASON_SCHEMA }),
]);
const REMOVE_CLOSURE_SCHEMA = z.discriminatedUnion("scope", [
  DATE_CLOSURE_SCHEMA.extend({ action: z.literal("remove") }),
  z.object({
    action: z.literal("remove"),
    scope: z.literal("period"),
    closurePeriodId: z.string().uuid(),
  }),
  WEEKLY_CLOSURE_SCHEMA.extend({ action: z.literal("remove") }),
]);

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

  const closure = CREATE_CLOSURE_SCHEMA.safeParse(payload);
  if (!closure.success) return createResponse(response, 400, { code: "invalid_request" });

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  let result;
  if (closure.data.scope === "date") {
    result = await serviceRoleClient.rpc("upsert_admin_date_time_block_closure", {
      p_actor_user_id: userId,
      p_time_block_id: closure.data.timeBlockId,
      p_closure_date: closure.data.date,
      p_reason: closure.data.reason,
    });
  } else if (closure.data.scope === "period") {
    result = await serviceRoleClient.rpc("upsert_admin_full_day_closure_period", {
      p_actor_user_id: userId,
      p_closure_start_date: closure.data.startDate,
      p_closure_end_date: closure.data.endDate,
      p_reason: closure.data.reason,
    });
  } else {
    result = await serviceRoleClient.rpc("upsert_admin_weekly_time_block_closure", {
      p_actor_user_id: userId,
      p_time_block_id: closure.data.timeBlockId,
      p_iso_weekday: closure.data.isoWeekday,
      p_reason: closure.data.reason,
    });
  }

  if (result.error) {
    console.error("[CONFIGURATION] closure creation was rejected.");
    return createResponse(response, 409, { code: "closure_not_created" });
  }

  return createResponse(response, 204, {});
}

export async function DELETE(request: NextRequest) {
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

  const closure = REMOVE_CLOSURE_SCHEMA.safeParse(payload);
  if (!closure.success) return createResponse(response, 400, { code: "invalid_request" });

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  let result;
  if (closure.data.scope === "date") {
    result = await serviceRoleClient.rpc("remove_admin_date_time_block_closure", {
      p_actor_user_id: userId,
      p_time_block_id: closure.data.timeBlockId,
      p_closure_date: closure.data.date,
    });
  } else if (closure.data.scope === "period") {
    result = await serviceRoleClient.rpc("remove_admin_full_day_closure_period", {
      p_actor_user_id: userId,
      p_full_day_closure_period_id: closure.data.closurePeriodId,
    });
  } else {
    result = await serviceRoleClient.rpc("remove_admin_weekly_time_block_closure", {
      p_actor_user_id: userId,
      p_time_block_id: closure.data.timeBlockId,
      p_iso_weekday: closure.data.isoWeekday,
    });
  }

  if (result.error) {
    console.error("[CONFIGURATION] closure removal was rejected.");
    return createResponse(response, 409, { code: "closure_not_removed" });
  }

  return createResponse(response, 204, {});
}
