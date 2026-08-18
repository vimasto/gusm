import { NextResponse, type NextRequest } from "next/server";
import { CREATE_SUPABASE_SERVER_CLIENT } from "@gusm/database/client";

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
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
