import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";

export function CREATE_SUPABASE_SERVICE_ROLE_CLIENT() {
  if (typeof window !== "undefined") {
    throw new Error(
      "[CREATE_SUPABASE_SERVICE_ROLE_CLIENT] do not ever use the secret key on the browser.",
    );
  }
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const secretKey = process.env["SUPABASE_SECRET_KEY"];

  if (!url || !secretKey) {
    console.error(
      "[CREATE_SUPABASE_SERVICE_ROLE_CLIENT] missing required server environment variables.",
    );

    throw new Error("[CREATE_SUPABASE_SERVICE_ROLE_CLIENT] missing envs.");
  }

  return createClient<Database>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
