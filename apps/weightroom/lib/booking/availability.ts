import * as z from "zod/v4";
import { CREATE_SUPABASE_BROWSER_CLIENT } from "@gusm/database/client";

const BOOKING_WEEK_AVAILABILITY_SCHEMA = z.array(
  z.object({
    booking_date: z.string().date(),
    time_block_id: z.number().int().positive(),
    time_block_t0: z.string().time(),
    time_block_t1: z.string().time(),
    standard_capacity: z.number().int().positive(),
    standard_count: z.number().int().nonnegative(),
    current_booking_id: z.string().uuid().nullable(),
    current_booking_status: z
      .enum(["reserved", "confirmed", "present", "absent", "cancelled"])
      .nullable(),
    current_booking_is_overcapacity: z.boolean().nullable(),
  }),
);

export type BookingWeekAvailability = z.infer<typeof BOOKING_WEEK_AVAILABILITY_SCHEMA>;

export function bookingWeekAvailabilityQueryKey(weekStart: string) {
  return ["booking-week-availability", weekStart] as const;
}

export async function getBookingWeekAvailability(
  weekStart: string,
): Promise<BookingWeekAvailability> {
  const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
  const { data, error } = await supabase.rpc("get_booking_week_availability", {
    p_week_start: weekStart,
  });

  if (error) throw new Error("Booking week availability request was rejected.");

  const availability = BOOKING_WEEK_AVAILABILITY_SCHEMA.safeParse(data);
  if (!availability.success) throw new Error("Booking week availability response is invalid.");

  return availability.data;
}

export function bookingAvailabilityTopic(bookingDate: string, timeBlockId: number): string {
  return `booking-availability:${bookingDate}:${timeBlockId}`;
}
