import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { parseCheckInQrPayload } from "@/lib/check-in-qr";
import { createResponse, getAuthenticatedUserId, isSameOrigin } from "../_shared";

export const runtime = "nodejs";

const TIMESTAMP_SCHEMA = z.string().refine((value) => !Number.isNaN(Date.parse(value)));
const REQUEST_SCHEMA = z.object({ payload: z.string().min(1).max(160) }).strict();
const SCAN_RESULT_SCHEMA = z.object({
  state: z.enum([
    "checked_in",
    "already_present",
    "no_current_booking",
    "invalid_token",
    "token_used",
    "token_expired",
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

  const tokenHash = parseCheckInQrPayload(requestPayload.data.payload);
  if (!tokenHash) {
    return createResponse(response, 200, { state: "invalid_token" });
  }

  const scannerUserId = await getAuthenticatedUserId(request, response);
  if (!scannerUserId) {
    return createResponse(response, 401, { code: "unauthenticated" });
  }

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { data, error } = await serviceRoleClient.rpc("consume_check_in_qr", {
    p_scanner_user_id: scannerUserId,
    p_token_hash: tokenHash,
  });
  const scanResult = SCAN_RESULT_SCHEMA.safeParse(data?.at(0));

  if (error || !scanResult.success) {
    console.error("[CHECK_IN_QR] scanner could not consume the QR token.");
    return createResponse(response, 403, { code: "scanner_unavailable" });
  }

  return createResponse(response, 200, {
    state: scanResult.data.state,
    scannedAt: scanResult.data.scanned_at,
  });
}
