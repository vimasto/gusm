import { NextResponse, type NextRequest } from "next/server";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { createResponse, getAuthenticatedUserId, isSameOrigin } from "../_shared";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const response = new NextResponse();

  if (!isSameOrigin(request)) return createResponse(response, 403, { code: "invalid_request" });

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { error } = await serviceRoleClient.rpc("request_current_block_admission", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[BLOCK_REQUEST] current-block admission request was rejected.");
    return createResponse(response, 409, { code: "request_unavailable" });
  }

  return createResponse(response, 200, { state: "requested" });
}
