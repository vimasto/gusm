import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVER_CLIENT } from "@gusm/database/client";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";

export const runtime = "nodejs";

const THEME_PREFERENCE_SCHEMA = z.object({
  themePreference: z.enum(["dark", "light"]),
});

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

function createResponse(response: NextResponse, status: number) {
  const result = new NextResponse(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

  for (const cookie of response.cookies.getAll()) {
    result.cookies.set(cookie.name, cookie.value, cookie);
  }

  return result;
}

async function getAuthenticatedUserId(request: NextRequest, response: NextResponse) {
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
  const { data, error } = await sessionClient.auth.getClaims();
  const userId = data?.claims.sub;

  if (error || typeof userId !== "string" || userId.length === 0) return null;

  return userId;
}

export async function POST(request: NextRequest) {
  const response = new NextResponse();

  if (!isSameOrigin(request)) return createResponse(response, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return createResponse(response, 415);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return createResponse(response, 400);
  }

  const themePreference = THEME_PREFERENCE_SCHEMA.safeParse(payload);
  if (!themePreference.success) return createResponse(response, 400);

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) return createResponse(response, 401);

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { error } = await serviceRoleClient.rpc("update_current_user_theme_preference", {
    p_actor_user_id: userId,
    p_theme_preference: themePreference.data.themePreference,
  });

  if (error) {
    console.error("[THEME_PREFERENCE] could not update the user preference.");
    return createResponse(response, 403);
  }

  return createResponse(response, 204);
}
