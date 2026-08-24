import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { createResponse, getAuthenticatedUserId, isSameOrigin } from "../_shared";

export const runtime = "nodejs";

const VIOLATION_TYPE_SCHEMA = z.enum([
  "absent",
  "missed_confirmation",
  "missed_qr",
  "unbooked_attendance",
]);
const ACTION_KIND_SCHEMA = z.enum(["notice", "disable"]);
const RULE_SCHEMA = z.object({
  discipline_rule_id: z.string().uuid(),
  violation_type: VIOLATION_TYPE_SCHEMA,
  occurrence_threshold: z.number().int().positive(),
  window_days: z.number().int().min(1).max(365),
  action_kind: ACTION_KIND_SCHEMA,
  enabled: z.boolean(),
});
const UPSERT_SCHEMA = z.object({
  violationType: VIOLATION_TYPE_SCHEMA,
  occurrenceThreshold: z.number().int().positive(),
  windowDays: z.number().int().min(1).max(365),
  actionKind: ACTION_KIND_SCHEMA,
});
const REMOVE_SCHEMA = z.object({ disciplineRuleId: z.string().uuid() });

export async function GET(request: NextRequest) {
  const response = new NextResponse();
  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { data, error } = await serviceRoleClient.rpc("get_admin_discipline_rules", {
    p_actor_user_id: userId,
  });
  const rules = z.array(RULE_SCHEMA).safeParse(data);

  if (error || !rules.success) {
    console.error("[CONFIGURATION_DISCIPLINE] could not load discipline rules.");
    return createResponse(response, 403, { code: "discipline_unavailable" });
  }

  return createResponse(response, 200, { rules: rules.data });
}

export async function POST(request: NextRequest) {
  const response = new NextResponse();
  if (!isSameOrigin(request)) return createResponse(response, 403, { code: "invalid_request" });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return createResponse(response, 400, { code: "invalid_request" });
  }

  const rule = UPSERT_SCHEMA.safeParse(payload);
  if (!rule.success) return createResponse(response, 400, { code: "invalid_request" });

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { error } = await serviceRoleClient.rpc("upsert_admin_discipline_rule", {
    p_actor_user_id: userId,
    p_violation_type: rule.data.violationType,
    p_occurrence_threshold: rule.data.occurrenceThreshold,
    p_window_days: rule.data.windowDays,
    p_action_kind: rule.data.actionKind,
  });

  if (error) {
    console.error("[CONFIGURATION_DISCIPLINE] could not save discipline rule.");
    return createResponse(response, 409, { code: "discipline_not_saved" });
  }

  return createResponse(response, 204, {});
}

export async function DELETE(request: NextRequest) {
  const response = new NextResponse();
  if (!isSameOrigin(request)) return createResponse(response, 403, { code: "invalid_request" });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return createResponse(response, 400, { code: "invalid_request" });
  }

  const rule = REMOVE_SCHEMA.safeParse(payload);
  if (!rule.success) return createResponse(response, 400, { code: "invalid_request" });

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { error } = await serviceRoleClient.rpc("remove_admin_discipline_rule", {
    p_actor_user_id: userId,
    p_discipline_rule_id: rule.data.disciplineRuleId,
  });

  if (error) {
    console.error("[CONFIGURATION_DISCIPLINE] could not disable discipline rule.");
    return createResponse(response, 409, { code: "discipline_not_removed" });
  }

  return createResponse(response, 204, {});
}
