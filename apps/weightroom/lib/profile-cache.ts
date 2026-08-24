import * as z from "zod/v4";
import { CREATE_SUPABASE_BROWSER_CLIENT } from "@gusm/database/client";
import type { AppRole } from "@/components/UserTopBar";
import type { ThemePreference } from "@/lib/theme";

const ATTENDANCE_CACHE_PREFIX = "gymu.profile-attendance.v2";
const ATTENDANCE_CACHE_TTL_MS = 30 * 60 * 1000;

const ATTENDANCE_CACHE_SCHEMA = z.object({
  attendance: z.array(
    z.object({
      bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status: z.enum(["present", "absent"]),
    }),
  ),
  expiresAt: z.number().int().positive(),
  streakWeeks: z.number().int().nonnegative(),
});

export type CachedProfile = {
  userName: string;
  role: AppRole;
  institutionalUsername: string | null;
  dateOfBirth: string | null;
  reportedSex: "masculino" | "femenino" | "otro" | "prefiero_no_decir" | null;
  heightCm: number | null;
  weightKg: number | null;
  streakWeeks: number;
  themePreference: ThemePreference;
};

export type CachedAttendance = z.infer<typeof ATTENDANCE_CACHE_SCHEMA>["attendance"];

type CachedAttendanceEntry = {
  attendance: CachedAttendance;
  expiresAt: number;
  streakWeeks: number;
};

const profileMemoryCache = new Map<string, CachedProfile>();

function getAttendanceCacheKey(userId: string, monthQuery: string) {
  return `${ATTENDANCE_CACHE_PREFIX}:${userId}:${monthQuery}`;
}

export async function getProfileCacheUserId() {
  const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
  const { data } = await supabase.auth.getSession();

  return data.session?.user.id ?? null;
}

export function getCachedProfile(userId: string): CachedProfile | null {
  return profileMemoryCache.get(userId) ?? null;
}

export function setCachedProfile(userId: string, profile: CachedProfile) {
  profileMemoryCache.set(userId, profile);
}

export function getCachedMonthlyAttendance(
  userId: string,
  monthQuery: string,
): CachedAttendanceEntry | null {
  try {
    const storedValue = window.localStorage.getItem(getAttendanceCacheKey(userId, monthQuery));
    if (!storedValue) return null;

    const parsedValue: unknown = JSON.parse(storedValue);
    const cachedEntry = ATTENDANCE_CACHE_SCHEMA.safeParse(parsedValue);

    if (!cachedEntry.success || cachedEntry.data.expiresAt <= Date.now()) {
      window.localStorage.removeItem(getAttendanceCacheKey(userId, monthQuery));
      return null;
    }

    return cachedEntry.data;
  } catch {
    return null;
  }
}

export function setCachedMonthlyAttendance(
  userId: string,
  monthQuery: string,
  attendance: CachedAttendance,
  streakWeeks: number,
) {
  const cacheEntry: CachedAttendanceEntry = {
    attendance,
    expiresAt: Date.now() + ATTENDANCE_CACHE_TTL_MS,
    streakWeeks,
  };

  try {
    window.localStorage.setItem(
      getAttendanceCacheKey(userId, monthQuery),
      JSON.stringify(cacheEntry),
    );
  } catch {
    // El calendario sigue funcionando cuando el navegador rechaza almacenamiento local.
  }
}

export function clearProfileCache() {
  profileMemoryCache.clear();

  try {
    const keysToRemove: string[] = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(`${ATTENDANCE_CACHE_PREFIX}:`)) keysToRemove.push(key);
    }

    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // No hay caché persistente que limpiar si el almacenamiento no está disponible.
  }
}
