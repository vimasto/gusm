import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr";
import type { Database } from "./database.types.js";

export function CREATE_SUPABASE_BROWSER_CLIENT() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const publishableKey = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

  if (!url || !publishableKey) {
    console.error(
      "[CREATE_SUPABASE_BROWSER_CLIENT] missing envs. resolved url is %s and publishable key is %s",
      url,
      publishableKey,
    );

    throw new Error("[CREATE_SUPABASE_BROWSER_CLIENT] missing envs.");
  }

  return createBrowserClient<Database>(url, publishableKey);
}

export function CREATE_SUPABASE_SERVER_CLIENT(cookies: CookieMethodsServer) {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const publishableKey = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

  if (!url || !publishableKey) {
    console.error(
      "[CREATE_SUPABASE_SERVER_CLIENT] missing envs. resolved url is %s and publishable key is %s",
      url,
      publishableKey,
    );

    throw new Error("[CREATE_SUPABASE_SERVER_CLIENT] missing envs.");
  }

  return createServerClient<Database>(url, publishableKey, { cookies });
}
