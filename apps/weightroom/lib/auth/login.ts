import * as z from "zod/v4";
import { EMAIL_DOMAIN_VALUES } from "@/constants";

export const LOGIN_REQUEST_SCHEMA = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Ingresa tu usuario institucional.")
    .regex(/^[^@\s]+$/, "Ingresa solo la parte anterior a @."),
  domain: z.enum(EMAIL_DOMAIN_VALUES),
  password: z.string().min(1, "Ingresa tu contraseña."),
  themePreference: z.enum(["dark", "light"]).optional(),
});

export type LoginRequest = z.infer<typeof LOGIN_REQUEST_SCHEMA>;

export const LOGIN_ERROR_RESPONSE_SCHEMA = z.object({
  code: z.enum([
    "account_disabled",
    "auth_upstream_unavailable",
    "institutional_profile_invalid",
    "institutional_response_invalid",
    "institutional_session_rejected",
    "institutional_service_unavailable",
    "invalid_credentials",
    "invalid_request",
    "rate_limited",
  ]),
  retryAfterSeconds: z.number().int().positive().optional(),
});

export type LoginErrorCode = z.infer<typeof LOGIN_ERROR_RESPONSE_SCHEMA>["code"];
