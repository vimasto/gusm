import { NextResponse, type NextRequest } from "next/server";
import { CREATE_SUPABASE_SERVER_CLIENT } from "@gusm/database/client";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";

export const runtime = "nodejs";

function createErrorResponse(status: number) {
  return NextResponse.json(
    { code: "terms_acceptance_failed" },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function getForwardedOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

  if (!forwardedHost || (forwardedProtocol !== "http" && forwardedProtocol !== "https")) {
    return null;
  }

  try {
    return new URL(`${forwardedProtocol}://${forwardedHost}`).origin;
  } catch {
    return null;
  }
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const requestOrigin = getForwardedOrigin(request) ?? request.nextUrl.origin;

  return !origin || origin === requestOrigin;
}

function isTermsAcceptanceRequest(payload: unknown) {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "acceptCurrentTerms" in payload &&
    payload.acceptCurrentTerms === true
  );
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return createErrorResponse(403);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return createErrorResponse(400);
  }

  if (!isTermsAcceptanceRequest(payload)) {
    return createErrorResponse(400);
  }

  const response = new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
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

  if (claimsError || !userId) {
    return createErrorResponse(401);
  }

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { data: systemSettings, error: settingsError } = await serviceRoleClient
    .from("system_settings")
    .select("current_terms_version")
    .eq("singleton", true)
    .single();

  if (settingsError || !systemSettings) {
    console.error("[TERMS] could not read the current terms version.");
    return createErrorResponse(503);
  }

  const { data: appUser, error: appUserError } = await serviceRoleClient
    .from("app_user")
    .update({
      accepted_terms_version: systemSettings.current_terms_version,
      terms_accepted_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .is("disabled_at", null)
    .select("user_id")
    .maybeSingle();

  if (appUserError || !appUser) {
    console.error("[TERMS] could not record terms acceptance.");
    return createErrorResponse(403);
  }

  return response;
}
