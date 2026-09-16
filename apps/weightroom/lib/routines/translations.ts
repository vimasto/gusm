const EQUIPMENT_TRANSLATIONS: Record<string, string> = {
  Barbell: "Barra",
  Bodyweight: "Peso corporal",
  Cable: "Polea",
  Cardio: "Cardio",
  Dumbbell: "Mancuernas",
  Machine: "Máquina",
};

const MUSCLE_TRANSLATIONS: Record<string, string> = {
  Back: "Espalda",
  Biceps: "Bíceps",
  Calves: "Pantorrillas",
  Chest: "Pecho",
  Core: "Core",
  Forearms: "Antebrazos",
  Glutes: "Glúteos",
  Hamstrings: "Isquiotibiales",
  Lats: "Dorsales",
  Legs: "Piernas",
  "Posterior Chain": "Cadena posterior",
  Quads: "Cuádriceps",
  Shoulders: "Hombros",
  Triceps: "Tríceps",
  "Upper Back": "Espalda alta",
};

const EXERCISE_NAME_TRANSLATIONS: Record<string, string> = {
  "barbell-row": "Remo con barra",
  "bench-press": "Press de banca",
  "bicep-curl": "Curl de bíceps",
  "bicycle-crunch": "Crunch bicicleta",
  "bird-dog": "Bird dog",
  "bodyweight-squat": "Sentadilla sin carga",
  "bulgarian-split-squat": "Sentadilla búlgara",
  "cable-curl": "Curl en polea",
  "cable-fly": "Aperturas en polea",
  "cable-pallof-hold": "Pallof isométrico en polea",
  cycling: "Ciclismo",
  "dead-bug": "Dead bug",
  deadlift: "Peso muerto",
  "diamond-push-up": "Flexiones diamante",
  "dumbbell-bench-press": "Press de banca con mancuernas",
  "dumbbell-hip-thrust": "Hip thrust con mancuerna",
  elliptical: "Elíptica",
  "ez-bar-curl": "Curl con barra EZ",
  "face-pull": "Face pull",
  "forward-lunge": "Zancada frontal",
  "glute-bridge": "Puente de glúteos",
  "goblet-squat": "Sentadilla goblet",
  "good-morning": "Buenos días",
  "hack-squat": "Sentadilla hack",
  "hammer-curl": "Curl martillo",
  "hip-thrust": "Hip thrust",
  "incline-bench-press": "Press de banca inclinado",
  "jump-squat": "Sentadilla con salto",
  "knee-push-up": "Flexiones de rodillas",
  "landmine-press": "Press landmine",
  "lat-pulldown": "Jalón al pecho",
  "lateral-raise": "Elevación lateral",
  "leg-extension": "Extensión de piernas",
  "leg-press": "Prensa de piernas",
  "leg-press-calf-raise": "Elevación de pantorrillas en prensa",
  "mountain-climber": "Escalador",
  "overhead-press": "Press militar",
  "overhead-tricep-extension": "Extensión de tríceps sobre la cabeza",
  plank: "Plancha",
  "preacher-curl": "Curl predicador",
  "pull-up": "Dominadas",
  "push-up": "Flexiones",
  "reverse-crunch": "Crunch inverso",
  "reverse-curl": "Curl inverso",
  "romanian-deadlift": "Peso muerto rumano",
  "rope-hammer-curl": "Curl martillo con cuerda",
  "rope-tricep-pushdown": "Extensión de tríceps con cuerda",
  rowing: "Remo",
  "russian-twist": "Giro ruso",
  running: "Carrera",
  "seated-dumbbell-press": "Press militar sentado con mancuernas",
  "seated-row": "Remo sentado en polea",
  "side-plank": "Plancha lateral",
  "single-arm-dumbbell-tricep-extension": "Extensión de tríceps unilateral con mancuerna",
  "single-leg-glute-bridge": "Puente de glúteos unilateral",
  "skull-crusher": "Rompecráneos",
  "spider-curl": "Curl araña",
  squat: "Sentadilla con barra",
  "straight-arm-pulldown": "Jalón con brazos rectos",
  "treadmill-incline-walk": "Caminata inclinada en cinta",
  "tricep-pushdown": "Extensión de tríceps en polea",
  "upright-row": "Remo al mentón",
  "wall-sit": "Sentadilla isométrica en pared",
  walking: "Caminata",
  "wide-grip-lat-pulldown": "Jalón al pecho con agarre ancho",
  "wide-push-up": "Flexiones abiertas",
  "wrist-curl": "Curl de muñeca",
};

function getTranslatedValue(translations: Record<string, string>, value: string): string {
  return translations[value] ?? value;
}

export function getRoutineExerciseName(slug: string, sourceName: string): string {
  return EXERCISE_NAME_TRANSLATIONS[slug] ?? sourceName;
}

export function getRoutineEquipmentName(sourceEquipment: string): string {
  return getTranslatedValue(EQUIPMENT_TRANSLATIONS, sourceEquipment);
}

export function getRoutineMuscleName(sourceMuscle: string): string {
  return getTranslatedValue(MUSCLE_TRANSLATIONS, sourceMuscle);
}
