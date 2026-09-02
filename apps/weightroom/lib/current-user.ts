import * as z from "zod/v4";
import type { AppRole } from "@/components/UserTopBar";

const CURRENT_USER_SCHEMA = z.object({
  userName: z.string().min(1),
  role: z.enum(["student", "u_staff", "gym_staff", "admin"]),
  streakWeeks: z.number().int().nonnegative(),
  themePreference: z.enum(["dark", "light"]),
});

export type CurrentUser = z.infer<typeof CURRENT_USER_SCHEMA> & { role: AppRole };

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await fetch("/api/current-user", { cache: "no-store" });
  if (!response.ok) throw new Error("Current user request was rejected.");

  const payload: unknown = await response.json();
  const currentUser = CURRENT_USER_SCHEMA.safeParse(payload);
  if (!currentUser.success) throw new Error("Current user response is invalid.");

  return currentUser.data;
}
