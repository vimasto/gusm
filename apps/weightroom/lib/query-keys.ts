export const CURRENT_USER_QUERY_KEY = ["current-user"] as const;
export const PROFILE_QUERY_KEY = ["profile"] as const;
export const ADMIN_CONFIGURATION_QUERY_KEY = ["admin-configuration"] as const;
export const DISCIPLINE_RULES_QUERY_KEY = ["discipline-rules"] as const;
export const BOOKING_CLOSURES_QUERY_KEY = ["booking-closures"] as const;

export function profileMonthQueryKey(month: string) {
  return [...PROFILE_QUERY_KEY, "month", month] as const;
}

export function bookingClosuresQueryKey(startDate: string, endDate: string) {
  return [...BOOKING_CLOSURES_QUERY_KEY, startDate, endDate] as const;
}
