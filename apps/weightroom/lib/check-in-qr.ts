import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const CHECK_IN_QR_PREFIX = "GYMU:CHECKIN:v1:";

const OPAQUE_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function createCheckInQrToken() {
  const token = randomBytes(32).toString("hex");

  return {
    payload: `${CHECK_IN_QR_PREFIX}${token}`,
    tokenHash: toByteaHash(token),
  };
}

export function parseCheckInQrPayload(payload: string) {
  if (!payload.startsWith(CHECK_IN_QR_PREFIX)) return null;

  const token = payload.slice(CHECK_IN_QR_PREFIX.length);
  if (!OPAQUE_TOKEN_PATTERN.test(token)) return null;

  return toByteaHash(token);
}

function toByteaHash(token: string) {
  return `\\x${createHash("sha256").update(token).digest("hex")}`;
}
