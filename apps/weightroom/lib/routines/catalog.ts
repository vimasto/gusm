import { exercises, type Exercise } from "@bryllim/workout-guide";
import type { RoutineCatalogExercise } from "@/lib/routines/types";
import {
  getRoutineEquipmentName,
  getRoutineExerciseName,
  getRoutineMuscleName,
} from "@/lib/routines/translations";

const MAX_ROUTINE_CATALOG_RESULTS = 24;

const ALLOWED_ROUTINE_EXERCISE_SLUGS = new Set([
  "bench-press",
  "incline-bench-press",
  "overhead-press",
  "upright-row",
  "deadlift",
  "romanian-deadlift",
  "barbell-row",
  "squat",
  "hip-thrust",
  "good-morning",
  "reverse-curl",
  "wrist-curl",
  "skull-crusher",
  "landmine-press",
  "ez-bar-curl",
  "push-up",
  "pull-up",
  "glute-bridge",
  "plank",
  "side-plank",
  "single-leg-glute-bridge",
  "wall-sit",
  "jump-squat",
  "reverse-crunch",
  "russian-twist",
  "bicycle-crunch",
  "mountain-climber",
  "dead-bug",
  "bird-dog",
  "knee-push-up",
  "wide-push-up",
  "diamond-push-up",
  "bodyweight-squat",
  "forward-lunge",
  "face-pull",
  "seated-row",
  "cable-fly",
  "straight-arm-pulldown",
  "cable-curl",
  "tricep-pushdown",
  "overhead-tricep-extension",
  "wide-grip-lat-pulldown",
  "rope-hammer-curl",
  "rope-tricep-pushdown",
  "cable-pallof-hold",
  "running",
  "walking",
  "cycling",
  "rowing",
  "elliptical",
  "treadmill-incline-walk",
  "dumbbell-bench-press",
  "seated-dumbbell-press",
  "lateral-raise",
  "bulgarian-split-squat",
  "bicep-curl",
  "hammer-curl",
  "goblet-squat",
  "dumbbell-hip-thrust",
  "spider-curl",
  "single-arm-dumbbell-tricep-extension",
  "hack-squat",
  "leg-press",
  "leg-extension",
  "preacher-curl",
  "leg-press-calf-raise",
]);

function toRoutineCatalogExercise(exercise: Exercise): RoutineCatalogExercise {
  return {
    equipment: getRoutineEquipmentName(exercise.equipment),
    exerciseType: exercise.exerciseType,
    // El paquete enumera sus imágenes desde la posición final hacia la inicial.
    frames: [...exercise.frames].reverse().map((frame) => ({ index: frame.index })),
    id: exercise.id,
    isStretch: exercise.isStretch,
    name: getRoutineExerciseName(exercise.slug, exercise.name),
    primaryMuscle: getRoutineMuscleName(exercise.primaryMuscle),
    secondaryMuscles: exercise.secondaryMuscles.map(getRoutineMuscleName),
    slug: exercise.slug,
  };
}

export const ROUTINE_CATALOG_EXERCISES = exercises
  .filter((exercise) => ALLOWED_ROUTINE_EXERCISE_SLUGS.has(exercise.slug))
  .map(toRoutineCatalogExercise);

export const ROUTINE_CATALOG_FILTERS = {
  equipment: [...new Set(ROUTINE_CATALOG_EXERCISES.map((exercise) => exercise.equipment))].sort(),
  primaryMuscles: [
    ...new Set(ROUTINE_CATALOG_EXERCISES.map((exercise) => exercise.primaryMuscle)),
  ].sort(),
} as const;

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase("es-CL")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesSearch(exercise: RoutineCatalogExercise, query: string): boolean {
  if (!query) return true;

  const searchableValue = normalizeSearchText(
    [exercise.name, exercise.equipment, exercise.primaryMuscle, ...exercise.secondaryMuscles].join(
      " ",
    ),
  );

  return query.split(" ").every((token) => searchableValue.includes(token));
}

export function searchRoutineCatalog(
  query: string,
  primaryMuscle: string | null,
  equipment: string | null,
): RoutineCatalogExercise[] {
  const normalizedQuery = normalizeSearchText(query);

  return ROUTINE_CATALOG_EXERCISES.filter((exercise) => {
    if (primaryMuscle && exercise.primaryMuscle !== primaryMuscle) return false;
    if (equipment && exercise.equipment !== equipment) return false;
    return matchesSearch(exercise, normalizedQuery);
  }).slice(0, MAX_ROUTINE_CATALOG_RESULTS);
}
