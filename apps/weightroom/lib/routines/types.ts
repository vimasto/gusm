export type RoutineCatalogFrame = {
  index: 1 | 2 | 3;
};

export type RoutineCatalogExercise = {
  equipment: string;
  exerciseType:
    | "assisted_bodyweight"
    | "bodyweight_reps"
    | "distance_duration"
    | "duration"
    | "weight_reps";
  frames: RoutineCatalogFrame[];
  id: string;
  isStretch: boolean;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  slug: string;
};

export type RoutineDraftItem = {
  effectiveSets: string;
  exercise: RoutineCatalogExercise;
  id: string;
  loadKg: string;
  notes: string;
  repetitions: string;
  restMinutes: string;
  rir: string;
  totalSets: string;
};
