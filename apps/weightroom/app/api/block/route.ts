import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { createResponse, getAuthenticatedUserId, isSameOrigin } from "./_shared";

export const runtime = "nodejs";

const CONTEXT_SCHEMA = z.object({
  booking_date: z.string().date(),
  time_block_id: z.number().int().positive(),
  block_starts_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  standard_capacity: z.number().int().positive(),
  standard_count: z.number().int().nonnegative(),
  overcapacity_max_above: z.number().int().nonnegative(),
  overcapacity_count: z.number().int().nonnegative(),
});

const CANDIDATE_SCHEMA = z.object({
  user_id: z.string().uuid(),
  user_name: z.string().min(1),
  booking_status: z.enum(["reserved", "confirmed", "present", "absent", "cancelled"]).nullable(),
  is_overcapacity: z.boolean().nullable(),
  admission_source: z.enum(["self_service", "staff_exception", "staff_overcapacity"]).nullable(),
  staff_block_admission_request_id: z.string().uuid().nullable(),
  requested_at: z.string().datetime().nullable(),
});

const CURRENT_BLOCK_ACTION_SCHEMA = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("admit"),
      userId: z.string().uuid(),
      admissionSource: z.enum(["staff_exception", "staff_overcapacity"]),
    })
    .strict(),
  z.object({ action: z.literal("reauthorize_qr"), userId: z.string().uuid() }).strict(),
]);

export async function GET(request: NextRequest) {
  const response = new NextResponse();
  const actorUserId = await getAuthenticatedUserId(request, response);

  if (!actorUserId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const [contextResult, candidatesResult] = await Promise.all([
    serviceRoleClient.rpc("get_current_staff_block_context", { p_actor_user_id: actorUserId }),
    serviceRoleClient.rpc("get_current_staff_block_candidates", { p_actor_user_id: actorUserId }),
  ]);
  const context = CONTEXT_SCHEMA.safeParse(contextResult.data?.at(0));
  const candidates = z.array(CANDIDATE_SCHEMA).safeParse(candidatesResult.data);

  if (contextResult.error || candidatesResult.error) {
    console.error("[BLOCK] could not load the current staff block.");
    return createResponse(response, 403, { code: "block_unavailable" });
  }

  if (!context.success || !candidates.success) {
    console.error("[BLOCK] current staff block RPC returned an invalid response.");
    return createResponse(response, 503, { code: "block_unavailable" });
  }

  return createResponse(response, 200, {
    context: {
      bookingDate: context.data.booking_date,
      timeBlockId: context.data.time_block_id,
      blockStartsAt: context.data.block_starts_at,
      expiresAt: context.data.expires_at,
      standardCapacity: context.data.standard_capacity,
      standardCount: context.data.standard_count,
      overcapacityMaxAbove: context.data.overcapacity_max_above,
      overcapacityCount: context.data.overcapacity_count,
    },
    candidates: candidates.data.map((candidate) => ({
      userId: candidate.user_id,
      userName: candidate.user_name,
      bookingStatus: candidate.booking_status,
      isOvercapacity: candidate.is_overcapacity,
      admissionSource: candidate.admission_source,
      requestId: candidate.staff_block_admission_request_id,
      requestedAt: candidate.requested_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const response = new NextResponse();

  if (!isSameOrigin(request)) return createResponse(response, 403, { code: "invalid_request" });
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return createResponse(response, 415, { code: "invalid_request" });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return createResponse(response, 400, { code: "invalid_request" });
  }

  const currentBlockAction = CURRENT_BLOCK_ACTION_SCHEMA.safeParse(payload);
  if (!currentBlockAction.success)
    return createResponse(response, 400, { code: "invalid_request" });

  const actorUserId = await getAuthenticatedUserId(request, response);
  if (!actorUserId) return createResponse(response, 401, { code: "unauthenticated" });

  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const actionResult =
    currentBlockAction.data.action === "admit"
      ? await serviceRoleClient.rpc("admit_current_staff_block_user", {
          p_actor_user_id: actorUserId,
          p_target_user_id: currentBlockAction.data.userId,
          p_admission_source: currentBlockAction.data.admissionSource,
        })
      : await serviceRoleClient.rpc("reauthorize_current_staff_block_qr", {
          p_actor_user_id: actorUserId,
          p_target_user_id: currentBlockAction.data.userId,
        });

  if (actionResult.error) {
    console.error("[BLOCK] staff action was rejected.");
    return createResponse(response, 409, { code: "action_rejected" });
  }

  return createResponse(response, 200, {
    state: currentBlockAction.data.action === "admit" ? "admitted" : "qr_reauthorized",
  });
}
