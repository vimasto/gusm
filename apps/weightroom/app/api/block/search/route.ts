import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { createResponse, getAuthenticatedUserId, isSameOrigin } from "../_shared";

export const runtime = "nodejs";

const REQUEST_SCHEMA = z.object({ query: z.string().trim().min(2).max(80) }).strict();
const RESULT_SCHEMA = z.object({
  user_id: z.string().uuid(),
  user_name: z.string().min(1),
  institutional_username: z.string().min(1),
  booking_status: z.enum(["reserved", "confirmed", "present", "absent", "cancelled"]).nullable(),
});

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

  const searchRequest = REQUEST_SCHEMA.safeParse(payload);
  if (!searchRequest.success) return createResponse(response, 400, { code: "invalid_request" });

  const actorUserId = await getAuthenticatedUserId(request, response);
  if (!actorUserId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { data, error } = await serviceRoleClient.rpc("search_current_staff_block_users", {
    p_actor_user_id: actorUserId,
    p_institutional_username_prefix: searchRequest.data.query,
  });
  const results = z.array(RESULT_SCHEMA).safeParse(data);

  if (error || !results.success) {
    console.error("[BLOCK] staff search was rejected.");
    return createResponse(response, 403, { code: "search_unavailable" });
  }

  return createResponse(response, 200, {
    results: results.data.map((result) => ({
      userId: result.user_id,
      userName: result.user_name,
      institutionalUsername: result.institutional_username,
      bookingStatus: result.booking_status,
    })),
  });
}
