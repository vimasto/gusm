import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { createResponse, getAuthenticatedUserId, isSameOrigin } from "../_shared";

export const runtime = "nodejs";

const USER_SCHEMA = z.object({
  user_id: z.string().uuid(),
  institutional_username: z.string().min(1),
  user_name: z.string().min(1),
  user_role: z.enum(["student", "u_staff", "gym_staff", "admin"]),
  disabled_at: z.string().datetime().nullable(),
  disabled_reason: z.string().nullable(),
});
const USER_ACTION_SCHEMA = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("disable"),
    userId: z.string().uuid(),
    reason: z.string().trim().min(3).max(240),
  }),
  z.object({ action: z.literal("restore"), userId: z.string().uuid() }),
]);

export async function GET(request: NextRequest) {
  const response = new NextResponse();
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  if (query.length < 2 || query.length > 120) {
    return createResponse(response, 400, { code: "invalid_request" });
  }

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { data, error } = await serviceRoleClient.rpc("search_admin_users", {
    p_actor_user_id: userId,
    p_query: query,
  });
  const users = z.array(USER_SCHEMA).safeParse(data);

  if (error || !users.success) {
    console.error("[CONFIGURATION_USERS] user search was rejected.");
    return createResponse(response, 403, { code: "users_unavailable" });
  }

  return createResponse(response, 200, { users: users.data });
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

  const action = USER_ACTION_SCHEMA.safeParse(payload);
  if (!action.success) return createResponse(response, 400, { code: "invalid_request" });

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const result =
    action.data.action === "disable"
      ? await serviceRoleClient.rpc("disable_admin_user", {
          p_actor_user_id: userId,
          p_target_user_id: action.data.userId,
          p_reason: action.data.reason,
        })
      : await serviceRoleClient.rpc("restore_admin_user", {
          p_actor_user_id: userId,
          p_target_user_id: action.data.userId,
        });

  if (result.error) {
    console.error("[CONFIGURATION_USERS] user access update was rejected.");
    return createResponse(response, 409, { code: "user_not_updated" });
  }

  return createResponse(response, 204, {});
}
