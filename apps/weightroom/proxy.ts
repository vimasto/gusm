import { NextResponse, type NextRequest } from "next/server";
import { CREATE_SUPABASE_SERVER_CLIENT } from "@gusm/database/client";

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
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));

    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    }

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/reserva/:path*"],
};
