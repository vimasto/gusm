import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { createResponse, getAuthenticatedUserId } from "../configuration/_shared";

export const runtime = "nodejs";

const DATE_SCHEMA = z.string().date();
const CLOSURE_SCHEMA = z.object({
  closure_date: z.string().date(),
  time_block_id: z.number().int().positive(),
  reason: z.string().min(3).max(240),
});

export async function GET(request: NextRequest) {
  const response = new NextResponse();
  const startDate = DATE_SCHEMA.safeParse(request.nextUrl.searchParams.get("start"));
  const endDate = DATE_SCHEMA.safeParse(request.nextUrl.searchParams.get("end"));

  if (!startDate.success || !endDate.success) {
    return createResponse(response, 400, { code: "invalid_request" });
  }

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { data, error } = await serviceRoleClient.rpc("get_booking_closure_reasons", {
    p_actor_user_id: userId,
    p_start_date: startDate.data,
    p_end_date: endDate.data,
  });
  const closures = z.array(CLOSURE_SCHEMA).safeParse(data);

  if (error) {
    console.error("[BOOKING_CLOSURES] closure read was rejected.");
    return createResponse(response, 403, { code: "closures_unavailable" });
  }

  if (!closures.success) {
    console.error("[BOOKING_CLOSURES] closure RPC returned an invalid payload.");
    return createResponse(response, 503, { code: "closures_unavailable" });
  }

  return createResponse(response, 200, {
    closures: closures.data.map((closure) => ({
      date: closure.closure_date,
      timeBlockId: closure.time_block_id,
      reason: closure.reason,
    })),
  });
}
