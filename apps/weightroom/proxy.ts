import { NextResponse, type NextRequest } from "next/server";
import { CREATE_SUPABASE_SERVER_CLIENT } from "@gusm/database/client";

function createRedirectResponse(response: NextResponse, request: NextRequest, pathname: string) {
  const redirectResponse = NextResponse.redirect(new URL(pathname, request.url));

  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie.name, cookie.value);
  }

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = CREATE_SUPABASE_SERVER_CLIENT({
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      for (const cookie of cookiesToSet) {
        request.cookies.set(cookie.name, cookie.value);
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      }
    },
  });
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return createRedirectResponse(response, request, "/login");
  }

  const { data: accessState, error: accessError } = await supabase.rpc("get_current_access_state");

  if (accessError || accessState === "unauthenticated" || accessState === "disabled") {
    return createRedirectResponse(response, request, "/login");
  }

  if (accessState !== "active") {
    return createRedirectResponse(response, request, "/terminos");
  }

  return response;
}

export const config = {
  matcher: [
    "/reserva/:path*",
    "/perfil/:path*",
    "/qr/:path*",
    "/bloque/:path*",
    "/configuracion/:path*",
  ],
};
