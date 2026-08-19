import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVER_CLIENT } from "@gusm/database/client";

export const runtime = "nodejs";

const BOOKING_ACTION_SCHEMA = z.object({
  bookingId: z.string().uuid(),
  action: z.enum(["confirm", "cancel"]),
});

function createResponse(response: NextResponse, status: number, body?: Record<string, unknown>) {
  const result = body
    ? NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
    : new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });

  for (const cookie of response.cookies.getAll()) {
    result.cookies.set(cookie.name, cookie.value, cookie);
  }

  return result;
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  let forwardedOrigin: string | null = null;

  if (forwardedHost && (forwardedProtocol === "http" || forwardedProtocol === "https")) {
    try {
      forwardedOrigin = new URL(`${forwardedProtocol}://${forwardedHost}`).origin;
    } catch {
      forwardedOrigin = null;
    }
  }

  return !origin || origin === (forwardedOrigin ?? request.nextUrl.origin);
}

export async function POST(request: NextRequest) {
  const response = new NextResponse();

  if (!isSameOrigin(request)) {
    return createResponse(response, 403, { code: "invalid_request" });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return createResponse(response, 400, { code: "invalid_request" });
  }

  const action = BOOKING_ACTION_SCHEMA.safeParse(payload);
  if (!action.success) {
    return createResponse(response, 400, { code: "invalid_request" });
  }

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
  if (claimsError || typeof claimsData?.claims.sub !== "string") {
    return createResponse(response, 401, { code: "unauthenticated" });
  }

  const functionName = action.data.action === "confirm" ? "confirm_booking" : "cancel_booking";
  const { error } = await sessionClient.rpc(functionName, { p_booking_id: action.data.bookingId });

  if (error) {
    return createResponse(response, 409, { code: "booking_action_rejected" });
  }

  return createResponse(response, 204);
}
