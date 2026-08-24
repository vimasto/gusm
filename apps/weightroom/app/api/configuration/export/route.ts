import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { CREATE_SUPABASE_SERVICE_ROLE_CLIENT } from "@gusm/database/service-role";
import { createResponse, getAuthenticatedUserId } from "../_shared";

export const runtime = "nodejs";

const DATE_SCHEMA = z.string().date();
const PERIOD_SCHEMA = z.enum(["week", "month"]);
const EXPORT_CATEGORY_SCHEMA = z.enum(["bookings", "attendance", "warnings", "discipline"]);
const EXPORT_ROW_SCHEMA = z.object({
  booking_date: z.string().date(),
  time_block_id: z.number().int().positive(),
  block_starts_at: z.string().datetime(),
  block_ends_at: z.string().datetime(),
  institutional_username: z.string().nullable(),
  user_name: z.string(),
  user_role: z.enum(["student", "u_staff", "gym_staff", "admin"]),
  booking_status: z.enum(["reserved", "confirmed", "present", "absent", "cancelled"]),
  admission_source: z.enum(["self_service", "staff_exception", "staff_overcapacity"]),
  is_overcapacity: z.boolean(),
  booked_at: z.string().datetime(),
  confirmed_at: z.string().datetime().nullable(),
  late_qr_authorized_at: z.string().datetime().nullable(),
  present_at: z.string().datetime().nullable(),
  absent_at: z.string().datetime().nullable(),
  cancelled_at: z.string().datetime().nullable(),
  qr_scanned_at: z.string().datetime().nullable(),
  warning_types: z.string().nullable(),
  date_of_birth: z.string().date().nullable(),
  reported_sex: z.string().nullable(),
  height_cm: z.number().int().nullable(),
  weight_kg: z.number().nullable(),
});
const STANDALONE_WARNING_SCHEMA = z.object({
  warning_created_at: z.string().datetime(),
  institutional_username: z.string().nullable(),
  user_name: z.string(),
  user_role: z.enum(["student", "u_staff", "gym_staff", "admin"]),
  warning_type: z.enum(["missed_confirmation", "missed_qr", "unbooked_attendance"]),
  date_of_birth: z.string().date().nullable(),
  reported_sex: z.string().nullable(),
  height_cm: z.number().int().nullable(),
  weight_kg: z.number().nullable(),
});
const DISCIPLINARY_ACTION_SCHEMA = z.object({
  applied_at: z.string().datetime(),
  institutional_username: z.string().nullable(),
  user_name: z.string(),
  user_role: z.enum(["student", "u_staff", "gym_staff", "admin"]),
  violation_type: z.enum(["absent", "missed_confirmation", "missed_qr", "unbooked_attendance"]),
  action_kind: z.enum(["notice", "disable"]),
  occurrence_count: z.number().int().positive(),
  date_of_birth: z.string().date().nullable(),
  reported_sex: z.string().nullable(),
  height_cm: z.number().int().nullable(),
  weight_kg: z.number().nullable(),
});

type ExportRow = z.infer<typeof EXPORT_ROW_SCHEMA>;
type StandaloneWarning = z.infer<typeof STANDALONE_WARNING_SCHEMA>;
type DisciplinaryAction = z.infer<typeof DISCIPLINARY_ACTION_SCHEMA>;
type CsvRow = {
  recordType: "reservation" | "warning" | "discipline";
  category: "bookings" | "attendance" | "warnings" | "discipline";
  occurredAt: string;
  bookingDate: string | null;
  timeBlockId: number | null;
  blockStartsAt: string | null;
  blockEndsAt: string | null;
  institutionalUsername: string | null;
  userName: string;
  userRole: string;
  bookingStatus: string | null;
  admissionSource: string | null;
  isOvercapacity: boolean | null;
  bookedAt: string | null;
  confirmedAt: string | null;
  lateQrAuthorizedAt: string | null;
  presentAt: string | null;
  absentAt: string | null;
  cancelledAt: string | null;
  qrScannedAt: string | null;
  warningTypes: string | null;
  disciplineViolation: string | null;
  disciplineAction: string | null;
  disciplineOccurrences: number | null;
  dateOfBirth: string | null;
  reportedSex: string | null;
  heightCm: number | null;
  weightKg: number | null;
};

const CSV_COLUMNS = [
  "tipo_registro",
  "categoria",
  "ocurrido_en",
  "fecha_reserva",
  "bloque",
  "inicio_bloque",
  "fin_bloque",
  "usuario_institucional",
  "nombre",
  "rol",
  "estado",
  "procedencia_admision",
  "es_sobrecupo",
  "reservado_en",
  "confirmado_en",
  "qr_autorizado_tarde_en",
  "presente_en",
  "ausente_en",
  "cancelado_en",
  "qr_escaneado_en",
  "warnings",
  "falta_disciplina",
  "sancion_disciplina",
  "repeticiones_disciplina",
  "fecha_nacimiento",
  "sexo_declarado",
  "altura_cm",
  "peso_kg",
] as const;

function getDateParts(date: string) {
  const [yearText, monthText, dayText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  return { day, month, year };
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPeriodRange(period: z.infer<typeof PERIOD_SCHEMA>, anchor: string) {
  const { day, month, year } = getDateParts(anchor);
  const anchorDate = new Date(Date.UTC(year, month - 1, day));

  if (period === "month") {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));
    return { endDate: formatDate(endDate), startDate: formatDate(startDate) };
  }

  const daysSinceMonday = (anchorDate.getUTCDay() + 6) % 7;
  const startDate = new Date(anchorDate);
  startDate.setUTCDate(startDate.getUTCDate() - daysSinceMonday);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 6);

  return { endDate: formatDate(endDate), startDate: formatDate(startDate) };
}

function csvCell(value: string | number | boolean | null) {
  if (value === null) return "";

  const text = String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function toReservationCsvRow(row: ExportRow): CsvRow {
  return {
    recordType: "reservation",
    category:
      row.booking_status === "present" || row.booking_status === "absent"
        ? "attendance"
        : "bookings",
    occurredAt: row.booked_at,
    bookingDate: row.booking_date,
    timeBlockId: row.time_block_id,
    blockStartsAt: row.block_starts_at,
    blockEndsAt: row.block_ends_at,
    institutionalUsername: row.institutional_username,
    userName: row.user_name,
    userRole: row.user_role,
    bookingStatus: row.booking_status,
    admissionSource: row.admission_source,
    isOvercapacity: row.is_overcapacity,
    bookedAt: row.booked_at,
    confirmedAt: row.confirmed_at,
    lateQrAuthorizedAt: row.late_qr_authorized_at,
    presentAt: row.present_at,
    absentAt: row.absent_at,
    cancelledAt: row.cancelled_at,
    qrScannedAt: row.qr_scanned_at,
    warningTypes: row.warning_types,
    disciplineViolation: null,
    disciplineAction: null,
    disciplineOccurrences: null,
    dateOfBirth: row.date_of_birth,
    reportedSex: row.reported_sex,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
  };
}

function toWarningCsvRow(warning: StandaloneWarning): CsvRow {
  return {
    recordType: "warning",
    category: "warnings",
    occurredAt: warning.warning_created_at,
    bookingDate: null,
    timeBlockId: null,
    blockStartsAt: null,
    blockEndsAt: null,
    institutionalUsername: warning.institutional_username,
    userName: warning.user_name,
    userRole: warning.user_role,
    bookingStatus: null,
    admissionSource: null,
    isOvercapacity: null,
    bookedAt: null,
    confirmedAt: null,
    lateQrAuthorizedAt: null,
    presentAt: null,
    absentAt: null,
    cancelledAt: null,
    qrScannedAt: null,
    warningTypes: warning.warning_type,
    disciplineViolation: null,
    disciplineAction: null,
    disciplineOccurrences: null,
    dateOfBirth: warning.date_of_birth,
    reportedSex: warning.reported_sex,
    heightCm: warning.height_cm,
    weightKg: warning.weight_kg,
  };
}

function toDisciplineCsvRow(action: DisciplinaryAction): CsvRow {
  return {
    recordType: "discipline",
    category: "discipline",
    occurredAt: action.applied_at,
    bookingDate: null,
    timeBlockId: null,
    blockStartsAt: null,
    blockEndsAt: null,
    institutionalUsername: action.institutional_username,
    userName: action.user_name,
    userRole: action.user_role,
    bookingStatus: null,
    admissionSource: null,
    isOvercapacity: null,
    bookedAt: null,
    confirmedAt: null,
    lateQrAuthorizedAt: null,
    presentAt: null,
    absentAt: null,
    cancelledAt: null,
    qrScannedAt: null,
    warningTypes: null,
    disciplineViolation: action.violation_type,
    disciplineAction: action.action_kind,
    disciplineOccurrences: action.occurrence_count,
    dateOfBirth: action.date_of_birth,
    reportedSex: action.reported_sex,
    heightCm: action.height_cm,
    weightKg: action.weight_kg,
  };
}

function createCsv(rows: CsvRow[]) {
  const lines = [CSV_COLUMNS.join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.recordType,
        row.category,
        row.occurredAt,
        row.bookingDate,
        row.timeBlockId,
        row.blockStartsAt,
        row.blockEndsAt,
        row.institutionalUsername,
        row.userName,
        row.userRole,
        row.bookingStatus,
        row.admissionSource,
        row.isOvercapacity,
        row.bookedAt,
        row.confirmedAt,
        row.lateQrAuthorizedAt,
        row.presentAt,
        row.absentAt,
        row.cancelledAt,
        row.qrScannedAt,
        row.warningTypes,
        row.disciplineViolation,
        row.disciplineAction,
        row.disciplineOccurrences,
        row.dateOfBirth,
        row.reportedSex,
        row.heightCm,
        row.weightKg,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return `\uFEFF${lines.join("\r\n")}`;
}

export async function GET(request: NextRequest) {
  const response = new NextResponse();
  const customStartDate = DATE_SCHEMA.safeParse(request.nextUrl.searchParams.get("start"));
  const customEndDate = DATE_SCHEMA.safeParse(request.nextUrl.searchParams.get("end"));
  const period = PERIOD_SCHEMA.safeParse(request.nextUrl.searchParams.get("period"));
  const anchor = DATE_SCHEMA.safeParse(request.nextUrl.searchParams.get("anchor"));
  const requestedCategory = request.nextUrl.searchParams.get("category") ?? "all";
  const category =
    requestedCategory === "all"
      ? { success: true as const, data: null }
      : EXPORT_CATEGORY_SCHEMA.safeParse(requestedCategory);

  if (
    (!(customStartDate.success && customEndDate.success) && !(period.success && anchor.success)) ||
    !category.success
  ) {
    return createResponse(response, 400, { code: "invalid_request" });
  }

  const userId = await getAuthenticatedUserId(request, response);
  if (!userId) return createResponse(response, 401, { code: "unauthenticated" });

  const range =
    customStartDate.success && customEndDate.success
      ? { endDate: customEndDate.data, startDate: customStartDate.data }
      : period.success && anchor.success
        ? getPeriodRange(period.data, anchor.data)
        : null;
  if (!range) return createResponse(response, 400, { code: "invalid_request" });

  const { startDate, endDate } = range;
  const rangeStart = new Date(`${startDate}T00:00:00.000Z`);
  const rangeEnd = new Date(`${endDate}T00:00:00.000Z`);
  if (rangeEnd < rangeStart || rangeEnd.getTime() - rangeStart.getTime() > 31 * 86_400_000) {
    return createResponse(response, 400, { code: "invalid_request" });
  }
  const serviceRoleClient = CREATE_SUPABASE_SERVICE_ROLE_CLIENT();
  const [bookingResult, warningResult, disciplineResult] = await Promise.all([
    serviceRoleClient.rpc("get_admin_booking_export", {
      p_actor_user_id: userId,
      p_start_date: startDate,
      p_end_date: endDate,
    }),
    serviceRoleClient.rpc("get_admin_standalone_warning_export", {
      p_actor_user_id: userId,
      p_start_date: startDate,
      p_end_date: endDate,
    }),
    serviceRoleClient.rpc("get_admin_disciplinary_action_export", {
      p_actor_user_id: userId,
      p_start_date: startDate,
      p_end_date: endDate,
    }),
  ]);
  const bookings = z.array(EXPORT_ROW_SCHEMA).safeParse(bookingResult.data);
  const warnings = z.array(STANDALONE_WARNING_SCHEMA).safeParse(warningResult.data);
  const disciplineActions = z.array(DISCIPLINARY_ACTION_SCHEMA).safeParse(disciplineResult.data);

  if (
    bookingResult.error ||
    warningResult.error ||
    disciplineResult.error ||
    !bookings.success ||
    !warnings.success ||
    !disciplineActions.success
  ) {
    console.error("[CONFIGURATION_EXPORT] export was rejected.");
    return createResponse(response, 403, { code: "export_unavailable" });
  }

  const rows = [
    ...bookings.data.map(toReservationCsvRow),
    ...warnings.data.map(toWarningCsvRow),
    ...disciplineActions.data.map(toDisciplineCsvRow),
  ]
    .filter((row) => category.data === null || row.category === category.data)
    .sort((first, second) => first.occurredAt.localeCompare(second.occurredAt));

  const exportResponse = new NextResponse(createCsv(rows), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="gymu-${startDate}-${endDate}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });

  for (const cookie of response.cookies.getAll()) {
    exportResponse.cookies.set(cookie.name, cookie.value, cookie);
  }

  return exportResponse;
}
