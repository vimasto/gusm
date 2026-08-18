import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { createCheckInQrToken } from "@/lib/check-in-qr";
import { createResponse, getAuthenticatedUserId, isSameOrigin } from "../_shared";

export const runtime = "nodejs";

const TIMESTAMP_SCHEMA = z.string().refine((value) => !Number.isNaN(Date.parse(value)));
const ISSUE_RESULT_SCHEMA = z.object({
  state: z.enum(["ready", "arrived_too_late", "outside_window"]),
  qr_token_id: z.string().uuid().nullable(),
  booking_date: z.string().date().nullable(),
  time_block_id: z.number().int().positive().nullable(),
  expires_at: TIMESTAMP_SCHEMA.nullable(),
});

export async function POST(request: NextRequest) {
  const response = new NextResponse();

  if (!isSameOrigin(request)) {
    return createResponse(response, 403, { code: "invalid_request" });
  }

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) {
    return createResponse(response, 401, { code: "unauthenticated" });
  }

  const checkInQrToken = createCheckInQrToken();
  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { data, error } = await serviceRoleClient.rpc("issue_check_in_qr", {
    p_user_id: userId,
    p_token_hash: checkInQrToken.tokenHash,
  });
  const issueResult = ISSUE_RESULT_SCHEMA.safeParse(data?.at(0));

  if (error || !issueResult.success) {
    console.error("[CHECK_IN_QR] could not issue a QR token.");
    return createResponse(response, 403, { code: "qr_unavailable" });
  }

  if (issueResult.data.state !== "ready") {
    return createResponse(response, 200, { state: issueResult.data.state });
  }

  if (
    !issueResult.data.qr_token_id ||
    !issueResult.data.booking_date ||
    !issueResult.data.time_block_id ||
    !issueResult.data.expires_at
  ) {
    console.error("[CHECK_IN_QR] ready issuance did not include token metadata.");
    return createResponse(response, 503, { code: "qr_unavailable" });
  }

  return createResponse(response, 200, {
    state: "ready",
    tokenId: issueResult.data.qr_token_id,
    payload: checkInQrToken.payload,
    bookingDate: issueResult.data.booking_date,
    timeBlockId: issueResult.data.time_block_id,
    expiresAt: issueResult.data.expires_at,
  });
}
