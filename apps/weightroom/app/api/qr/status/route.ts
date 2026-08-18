import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { createResponse, getAuthenticatedUserId, isSameOrigin } from "../_shared";

export const runtime = "nodejs";

const TIMESTAMP_SCHEMA = z.string().refine((value) => !Number.isNaN(Date.parse(value)));
const REQUEST_SCHEMA = z.object({ tokenId: z.string().uuid() }).strict();
const STATUS_RESULT_SCHEMA = z.object({
  state: z.enum([
    "pending",
    "expired",
    "not_found",
    "checked_in",
    "already_present",
    "no_current_booking",
  ]),
  scanned_at: TIMESTAMP_SCHEMA.nullable(),
});

export async function POST(request: NextRequest) {
  const response = new NextResponse();

  if (!isSameOrigin(request)) {
    return createResponse(response, 403, { code: "invalid_request" });
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return createResponse(response, 415, { code: "invalid_request" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createResponse(response, 400, { code: "invalid_request" });
  }

  const requestPayload = REQUEST_SCHEMA.safeParse(body);
  if (!requestPayload.success) {
    return createResponse(response, 400, { code: "invalid_request" });
  }

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) {
    return createResponse(response, 401, { code: "unauthenticated" });
  }

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { data, error } = await serviceRoleClient.rpc("get_check_in_qr_status", {
    p_user_id: userId,
    p_qr_token_id: requestPayload.data.tokenId,
  });
  const statusResult = STATUS_RESULT_SCHEMA.safeParse(data?.at(0));

  if (error || !statusResult.success) {
    console.error("[CHECK_IN_QR] could not read QR token status.");
    return createResponse(response, 403, { code: "qr_unavailable" });
  }

  return createResponse(response, 200, {
    state: statusResult.data.state,
    scannedAt: statusResult.data.scanned_at,
  });
}
