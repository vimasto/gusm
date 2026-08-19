import { NextResponse, type NextRequest } from "next/server";
import { CREATE_SUPABASE_SERVER_CLIENT } from "@gusm/database/client";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";

export const runtime = "nodejs";

function createResponse(response: NextResponse, status: number, body: Record<string, unknown>) {
  const result = NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

  for (const cookie of response.cookies.getAll()) {
    result.cookies.set(cookie.name, cookie.value, cookie);
  }

  return result;
}

export async function GET(request: NextRequest) {
  const response = new NextResponse();
  const sessionClient = CREATE_SUPABASE_SERVER_CLIENT({
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      for (const cookie of cookiesToSet) {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      }
    },
  });
  const { data: claimsData, error: claimsError } = await sessionClient.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (claimsError || typeof userId !== "string") {
    return createResponse(response, 401, { code: "unauthenticated" });
  }

  const { data: hasAcceptedTerms, error: termsError } = await sessionClient.rpc(
    "has_accepted_current_terms",
  );
  if (termsError || !hasAcceptedTerms) {
    return createResponse(response, 403, { code: "terms_acceptance_required" });
  }

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { data: bookings, error: bookingsError } = await serviceRoleClient
    .from("booking")
    .select(
      "booking_id, booking_date, status, time_block:time_block_id(time_block_t0, time_block_t1)",
    )
    .eq("user_id", userId)
    .eq("is_overcapacity", false)
    .in("status", ["reserved", "confirmed"])
    .order("booking_date")
    .limit(7);

  if (bookingsError) {
    console.error("[ACTIVE_BOOKINGS] could not load active bookings.");
    return createResponse(response, 503, { code: "active_bookings_unavailable" });
  }

  return createResponse(response, 200, {
    bookings: bookings.map((booking) => ({
      bookingId: booking.booking_id,
      bookingDate: booking.booking_date,
      status: booking.status,
      timeRange: `${booking.time_block.time_block_t0.slice(0, 5)} · ${booking.time_block.time_block_t1.slice(0, 5)}`,
      startTime: booking.time_block.time_block_t0.slice(0, 5),
    })),
  });
}
