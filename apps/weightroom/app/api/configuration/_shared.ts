import { NextResponse, type NextRequest } from "next/server";
import { CREATE_SUPABASE_SERVER_CLIENT } from "@gusm/database/client";

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

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const requestOrigin = getForwardedOrigin(request) ?? request.nextUrl.origin;

  return !origin || origin === requestOrigin;
}

export function createResponse(
  response: NextResponse,
  status: number,
  body: Record<string, unknown>,
) {
  const result = NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

  for (const cookie of response.cookies.getAll()) {
    result.cookies.set(cookie.name, cookie.value, cookie);
  }

  return result;
}

export async function getAuthenticatedUserId(request: NextRequest, response: NextResponse) {
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
