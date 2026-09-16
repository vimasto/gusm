import type { RoutineDraftItem } from "@/lib/routines/types";

export type RoutineDraftField = Exclude<keyof RoutineDraftItem, "exercise" | "id">;
export type RoutineDraftValidationErrors = Partial<Record<RoutineDraftField, string>>;

function parseInteger(value: string): number | null {
  const normalizedValue = value.trim();
  if (!/^\d+$/.test(normalizedValue)) return null;

  return Number(normalizedValue);
}

function parseDecimal(value: string): number | null {
  const normalizedValue = value.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(normalizedValue)) return null;

  return Number(normalizedValue.replace(",", "."));
}

function isWithinRange(value: number, minimum: number, maximum: number): boolean {
  return value >= minimum && value <= maximum;
}

function isValidRepetitionRange(value: string): boolean {
  const match = /^(\d+)(?:-(\d+))?$/.exec(value.trim());
  if (!match) return false;

  const firstValue = Number(match[1]);
  const secondValue = match[2] === undefined ? firstValue : Number(match[2]);

  return (
    isWithinRange(firstValue, 1, 20) &&
    isWithinRange(secondValue, 1, 20) &&
    firstValue <= secondValue
  );
}

function isValidRest(value: string): boolean {
  const match = /^(\d{1,2})(?::([0-5]\d))?$/.exec(value.trim());
  if (!match) return false;

  const minutes = Number(match[1]);
  const seconds = match[2] === undefined ? 0 : Number(match[2]);
  const totalSeconds = minutes * 60 + seconds;

  return totalSeconds > 0 && totalSeconds <= 6 * 60;
}

function addRangeError(
  errors: RoutineDraftValidationErrors,
  field: RoutineDraftField,
  value: string,
  minimum: number,
  maximum: number,
  message: string,
) {
  if (value.trim().length === 0) return;

  const parsedValue = parseInteger(value);
  if (parsedValue === null || !isWithinRange(parsedValue, minimum, maximum))
    errors[field] = message;
}

export function getRoutineDraftValidationErrors(
  item: RoutineDraftItem,
): RoutineDraftValidationErrors {
  const errors: RoutineDraftValidationErrors = {};

  addRangeError(
    errors,
    "totalSets",
    item.totalSets,
    1,
    5,
    "Las series deben ser un entero entre 1 y 5.",
  );
  addRangeError(
    errors,
    "effectiveSets",
    item.effectiveSets,
    1,
    5,
    "Las series deben ser un entero entre 1 y 5.",
  );
  addRangeError(errors, "rir", item.rir, 0, 5, "El RIR debe ser un entero entre 0 y 5.");

  if (item.repetitions.trim().length > 0 && !isValidRepetitionRange(item.repetitions)) {
    errors.repetitions = "Usa de 1 a 20 repeticiones o un rango válido, por ejemplo 8-12.";
  }

  if (item.loadKg.trim().length > 0) {
    const load = parseDecimal(item.loadKg);
    if (load === null || !isWithinRange(load, 0.5, 150)) {
      errors.loadKg = "La carga debe estar entre 0,5 y 150 kg.";
    }
  }

  if (item.restMinutes.trim().length > 0 && !isValidRest(item.restMinutes)) {
    errors.restMinutes = "El descanso debe estar entre 0:01 y 6:00.";
  }

  const totalSets = parseInteger(item.totalSets);
  const effectiveSets = parseInteger(item.effectiveSets);
  if (totalSets !== null && effectiveSets !== null && totalSets <= effectiveSets) {
    const relationshipError = "Las series totales deben superar a las efectivas.";
    errors.totalSets = relationshipError;
    errors.effectiveSets = relationshipError;
  }

  return errors;
}
