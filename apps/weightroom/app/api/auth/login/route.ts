import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVER_CLIENT } from "@gusm/database/client";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { LOGIN_REQUEST_SCHEMA, type LoginRequest } from "@/lib/auth/login";

export const runtime = "nodejs";

const SANSANO_PROFILE_SCHEMA = z.object({
  nombre: z.string().trim().min(1),
  rut: z.string().trim().min(1),
});

type SansanoAuthSettings = {
  apiKey: string;
  baseUrl: URL;
  identityHmacKey: string;
};

function createErrorResponse(
  status: number,
  code:
    | "account_disabled"
    | "auth_upstream_unavailable"
    | "invalid_credentials"
    | "invalid_request"
    | "rate_limited",
  retryAfterSeconds?: number,
) {
  const response = NextResponse.json(
    {
      code,
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );

  if (retryAfterSeconds) {
    response.headers.set("Retry-After", retryAfterSeconds.toString());
  }

  return response;
}

function createSuccessResponse(termsAcceptanceRequired: boolean) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "X-GUSM-Terms-Acceptance-Required": termsAcceptanceRequired.toString(),
    },
  });
}

function getSansanoAuthSettings() {
  const apiKey = process.env["SANSANO_AUTH_API_KEY"];
  const baseUrl = process.env["SANSANO_AUTH_BASE_URL"];
  const identityHmacKey = process.env["GUSM_IDENTITY_HMAC_KEY"];

  if (!apiKey || !baseUrl || !identityHmacKey) {
    throw new Error("[LOGIN] required authentication environment variables are missing.");
  }

  const parsedBaseUrl = new URL(baseUrl);

  if (process.env["NODE_ENV"] === "production" && parsedBaseUrl.protocol !== "https:") {
    throw new Error("[LOGIN] SANSANO_AUTH_BASE_URL must use HTTPS in production.");
  }

  return { apiKey, baseUrl: parsedBaseUrl, identityHmacKey } satisfies SansanoAuthSettings;
}

function normalizeRut(rut: string) {
  const normalizedRut = rut
    .toUpperCase()
    .replaceAll(".", "")
    .replaceAll("-", "")
    .replaceAll(" ", "");

  if (!/^\d{7,8}[\dK]$/.test(normalizedRut)) {
    throw new Error("[LOGIN] Sansano Auth returned an invalid RUT.");
  }

  return normalizedRut;
}

function normalizeInstitutionalUsername(username: string) {
  const normalizedUsername = username.normalize("NFKC").trim().toLocaleLowerCase("es-CL");

  if (
    normalizedUsername.length < 1 ||
    normalizedUsername.length > 120 ||
    /[@\s]/.test(normalizedUsername)
  ) {
    throw new Error("[LOGIN] institutional username is invalid.");
  }

  return normalizedUsername;
}

function formatNameToken(nameToken: string) {
  return `${nameToken.charAt(0).toLocaleUpperCase("es-CL")}${nameToken
    .slice(1)
    .toLocaleLowerCase("es-CL")}`;
}

function formatBroadcastName(institutionalName: string) {
  const nameParts = institutionalName.trim().split(/\s+/);
  const firstSurname = nameParts.at(0);
  const firstGivenName = nameParts.at(2);

  if (!firstSurname || !firstGivenName) {
    return nameParts.map(formatNameToken).join(" ");
  }

  return `${formatNameToken(firstGivenName)} ${formatNameToken(firstSurname)}`;
}

function createIdentityValues(rut: string, identityHmacKey: string) {
  const identityHmacHex = createHmac("sha256", identityHmacKey)
    .update(normalizeRut(rut))
    .digest("hex");

  return {
    databaseValue: `\\x${identityHmacHex}`,
    internalEmail: `${identityHmacHex}@auth.gusm.invalid`,
  };
}

function getRetryAfterSeconds(response: Response) {
  const retryAfter = response.headers.get("Retry-After");

  if (!retryAfter || !/^\d+$/.test(retryAfter)) {
    return undefined;
  }

  const retryAfterSeconds = Number(retryAfter);

  if (!Number.isSafeInteger(retryAfterSeconds) || retryAfterSeconds < 1) {
    return undefined;
  }

  return retryAfterSeconds;
}

async function getSansanoProfile(loginRequest: LoginRequest, settings: SansanoAuthSettings) {
  try {
    const response = await fetch(new URL("/auth/profile", settings.baseUrl), {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": settings.apiKey,
      },
      body: JSON.stringify({
        fields: ["nombre", "rut"],
        login: loginRequest.username,
        passwd: loginRequest.password,
        server: loginRequest.domain,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return {
        kind: "upstream_error" as const,
        retryAfterSeconds: getRetryAfterSeconds(response),
        status: response.status,
      };
    }

    const payload: unknown = await response.json();
    const parsedProfile = SANSANO_PROFILE_SCHEMA.safeParse(payload);

    if (!parsedProfile.success) {
      console.error("[LOGIN] Sansano Auth returned an invalid profile response.");
      return { kind: "invalid_response" as const };
    }

    return { kind: "success" as const, profile: parsedProfile.data };
  } catch {
    return { kind: "network_error" as const };
  }
}

async function findAppUser(identityHmac: string) {
  const supabase = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { data, error } = await supabase
    .from("app_user")
    .select("disabled_at, user_id")
    .eq("identity_hmac", identityHmac)
    .maybeSingle();

  if (error) {
    throw new Error(`[LOGIN] could not find application user: ${error.code}`);
  }

  return data;
}

async function provisionAppUser(
  identityHmac: string,
  userId: string,
  userName: string,
  existingAppUser: { disabled_at: string | null; user_id: string } | null,
) {
  const supabase = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();

  if (existingAppUser) {
    if (existingAppUser.user_id !== userId) {
      throw new Error("[LOGIN] Auth user does not match the stored application user.");
    }

    if (existingAppUser.disabled_at) {
      return "disabled" as const;
    }

    const { error } = await supabase
      .from("app_user")
      .update({ user_name: userName })
      .eq("user_id", userId);

    if (error) {
      throw new Error(`[LOGIN] could not update application user: ${error.code}`);
    }

    return "active" as const;
  }

  const { error } = await supabase.from("app_user").insert({
    identity_hmac: identityHmac,
    user_id: userId,
    user_name: userName,
  });

  if (error) {
    throw new Error(`[LOGIN] could not create application user: ${error.code}`);
  }

  return "active" as const;
}

async function upsertInstitutionalIdentity(userId: string, institutionalUsername: string) {
  const supabase = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const { error } = await supabase.rpc("upsert_institutional_identity", {
    p_institutional_username: institutionalUsername,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`[LOGIN] could not upsert institutional identity: ${error.code}`);
  }
}

async function requiresTermsAcceptance(userId: string) {
  const supabase = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const [{ data: appUser, error: appUserError }, { data: systemSettings, error: settingsError }] =
    await Promise.all([
      supabase.from("app_user").select("accepted_terms_version").eq("user_id", userId).single(),
      supabase
        .from("system_settings")
        .select("current_terms_version")
        .eq("singleton", true)
        .single(),
    ]);

  if (appUserError || settingsError || !appUser || !systemSettings) {
    throw new Error("[LOGIN] could not determine terms acceptance.");
  }

  return appUser.accepted_terms_version !== systemSettings.current_terms_version;
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return createErrorResponse(400, "invalid_request");
  }

  const parsedLoginRequest = LOGIN_REQUEST_SCHEMA.safeParse(payload);

  if (!parsedLoginRequest.success) {
    return createErrorResponse(400, "invalid_request");
  }

  let settings: SansanoAuthSettings;

  try {
    settings = getSansanoAuthSettings();
  } catch {
    console.error("[LOGIN] authentication service configuration is invalid.");
    return createErrorResponse(503, "auth_upstream_unavailable");
  }

  const sansanoResult = await getSansanoProfile(parsedLoginRequest.data, settings);

  if (sansanoResult.kind === "upstream_error") {
    if (sansanoResult.status === 401) {
      return createErrorResponse(401, "invalid_credentials");
    } else if (sansanoResult.status === 429) {
      return createErrorResponse(429, "rate_limited", sansanoResult.retryAfterSeconds);
    }

    return createErrorResponse(503, "auth_upstream_unavailable");
  } else if (sansanoResult.kind === "invalid_response" || sansanoResult.kind === "network_error") {
    return createErrorResponse(503, "auth_upstream_unavailable");
  }

  try {
    const identityValues = createIdentityValues(
      sansanoResult.profile.rut,
      settings.identityHmacKey,
    );
    const existingAppUser = await findAppUser(identityValues.databaseValue);

    if (existingAppUser?.disabled_at) {
      return createErrorResponse(403, "account_disabled");
    }

    const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
    const { data: generatedLink, error: generatedLinkError } =
      await serviceRoleClient.auth.admin.generateLink({
        type: "magiclink",
        email: identityValues.internalEmail,
      });

    if (generatedLinkError || !generatedLink.properties || !generatedLink.user) {
      console.error("[LOGIN] could not generate the internal Supabase session link.");
      return createErrorResponse(503, "auth_upstream_unavailable");
    }

    const appUserState = await provisionAppUser(
      identityValues.databaseValue,
      generatedLink.user.id,
      formatBroadcastName(sansanoResult.profile.nombre),
      existingAppUser,
    );

    if (appUserState === "disabled") {
      return createErrorResponse(403, "account_disabled");
    }

    await upsertInstitutionalIdentity(
      generatedLink.user.id,
      normalizeInstitutionalUsername(parsedLoginRequest.data.username),
    );

    const termsAcceptanceRequired = await requiresTermsAcceptance(generatedLink.user.id);
    const response = createSuccessResponse(termsAcceptanceRequired);
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
    const { data: sessionData, error: sessionError } = await sessionClient.auth.verifyOtp({
      token_hash: generatedLink.properties.hashed_token,
      type: "email",
    });

    if (sessionError || !sessionData.user || sessionData.user.id !== generatedLink.user.id) {
      console.error("[LOGIN] could not establish the Supabase session.");
      return createErrorResponse(503, "auth_upstream_unavailable");
    }

    return response;
  } catch (error) {
    console.error("[LOGIN] could not provision an authenticated application user.", error);
    return createErrorResponse(503, "auth_upstream_unavailable");
  }
}
