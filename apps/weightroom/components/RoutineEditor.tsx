"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, Search, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import { RoutineExerciseGuideDialog } from "@/components/RoutineExerciseGuideDialog";
import { RoutineExerciseItem } from "@/components/RoutineExerciseItem";
import {
  ROUTINE_CATALOG_EXERCISES,
  ROUTINE_CATALOG_FILTERS,
  searchRoutineCatalog,
} from "@/lib/routines/catalog";
import { type RoutineDraftField } from "@/lib/routines/validation";
import type { RoutineCatalogExercise, RoutineDraftItem } from "@/lib/routines/types";

type RoutineTemplateKey = "arms" | "back" | "core" | "front_torso" | "lower_body" | "upper_body";

type RoutineTemplate = {
  label: string;
  exerciseSlugs: string[];
};

const ROUTINE_TEMPLATES: Record<RoutineTemplateKey, RoutineTemplate> = {
  arms: {
    label: "Brazos",
    exerciseSlugs: ["bicep-curl", "hammer-curl", "skull-crusher", "rope-tricep-pushdown"],
  },
  back: {
    label: "Espalda",
    exerciseSlugs: ["barbell-row", "wide-grip-lat-pulldown", "face-pull", "straight-arm-pulldown"],
  },
  core: {
    label: "Core",
    exerciseSlugs: ["plank", "cable-pallof-hold", "reverse-crunch", "dead-bug"],
  },
  front_torso: {
    label: "Torso frontal",
    exerciseSlugs: ["incline-bench-press", "cable-fly", "overhead-press", "lateral-raise"],
  },
  lower_body: {
    label: "Tren inferior",
    exerciseSlugs: ["squat", "romanian-deadlift", "leg-press", "leg-extension"],
  },
  upper_body: {
    label: "Tren superior",
    exerciseSlugs: ["bench-press", "seated-dumbbell-press", "seated-row", "wide-grip-lat-pulldown"],
  },
};
const ROUTINE_TEMPLATE_KEYS: RoutineTemplateKey[] = [
  "lower_body",
  "upper_body",
  "front_torso",
  "back",
  "core",
  "arms",
];
const PROFILE_SECTION_CLASS = "rounded-2xl border border-accent/15 bg-input/30 px-4 py-4";

function isRoutineCatalogExercise(
  exercise: RoutineCatalogExercise | undefined,
): exercise is RoutineCatalogExercise {
  return exercise !== undefined;
}

function isRoutineTemplateKey(value: string): value is RoutineTemplateKey {
  return ROUTINE_TEMPLATE_KEYS.some((templateKey) => templateKey === value);
}

function createDraftItem(exercise: RoutineCatalogExercise, position: number): RoutineDraftItem {
  return {
    effectiveSets: "",
    exercise,
    id: `${exercise.slug}-${position}`,
    loadKg: "",
    notes: "",
    repetitions: "",
    restMinutes: "",
    rir: "",
    totalSets: "",
  };
}

function createTemplateDraft(templateKey: RoutineTemplateKey): RoutineDraftItem[] {
  const template = ROUTINE_TEMPLATES[templateKey];
  if (!template) return [];

  return template.exerciseSlugs
    .map((exerciseSlug) =>
      ROUTINE_CATALOG_EXERCISES.find((exercise) => exercise.slug === exerciseSlug),
    )
    .filter(isRoutineCatalogExercise)
    .map(createDraftItem);
}

function getRoutineTitle(templateKey: RoutineTemplateKey | null): string {
  if (templateKey === null) return "Rutina nueva";
  return `Rutina ${ROUTINE_TEMPLATES[templateKey].label.toLocaleLowerCase("es-CL")}`;
}

export function RoutineEditor() {
  const shouldReduceMotion = useReducedMotion();
  const [routineTitle, setRoutineTitle] = useState(() => getRoutineTitle(null));
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<RoutineTemplateKey | null>(null);
  const [draftItems, setDraftItems] = useState<RoutineDraftItem[]>([]);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [guideItemId, setGuideItemId] = useState<string | null>(null);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);

  const catalogResults = useMemo(
    () => searchRoutineCatalog(catalogQuery, selectedMuscle, selectedEquipment),
    [catalogQuery, selectedEquipment, selectedMuscle],
  );
  const guideExercise = draftItems.find((item) => item.id === guideItemId)?.exercise ?? null;

  function handleTemplateChange(value: string) {
    if (value === "empty") {
      setSelectedTemplateKey(null);
      setRoutineTitle(getRoutineTitle(null));
      setDraftItems([]);
      setExpandedItemIds(new Set());
      return;
    }

    if (!isRoutineTemplateKey(value)) return;
    const templateKey = value;

    setSelectedTemplateKey(templateKey);
    setRoutineTitle(getRoutineTitle(templateKey));
    setDraftItems(createTemplateDraft(templateKey));
    setExpandedItemIds(new Set());
  }

  function addExercise(exercise: RoutineCatalogExercise) {
    const alreadyAdded = draftItems.some((item) => item.exercise.slug === exercise.slug);
    if (alreadyAdded) {
      setCatalogNotice(`${exercise.name} ya está en esta rutina.`);
      return;
    }

    const item = createDraftItem(exercise, draftItems.length);
    setDraftItems((items) => [...items, item]);
    setExpandedItemIds((itemIds) => new Set([...itemIds, item.id]));
    setCatalogNotice(null);
  }

  function changeDraftItem(itemId: string, field: RoutineDraftField, value: string) {
    const currentItem = draftItems.find((item) => item.id === itemId);
    if (!currentItem) return;

    const nextItem: RoutineDraftItem = { ...currentItem, [field]: value };

    setDraftItems((items) => items.map((item) => (item.id === itemId ? nextItem : item)));
  }

  function removeDraftItem(itemId: string) {
    setDraftItems((items) => items.filter((item) => item.id !== itemId));
    setExpandedItemIds((itemIds) => {
      const nextItemIds = new Set(itemIds);
      nextItemIds.delete(itemId);
      return nextItemIds;
    });
    if (guideItemId === itemId) setGuideItemId(null);
  }

  function toggleDraftItem(itemId: string) {
    setExpandedItemIds((itemIds) => {
      const nextItemIds = new Set(itemIds);
      if (nextItemIds.has(itemId)) nextItemIds.delete(itemId);
      else nextItemIds.add(itemId);
      return nextItemIds;
    });
  }

  return (
    <div className="flex gusm-page-scroll flex-col gap-4 px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <section className={PROFILE_SECTION_CLASS} aria-labelledby="routine-editor-title">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 id="routine-editor-title" className="text-lg font-semibold text-foreground">
              Crear rutina
            </h1>
          </div>
          <span className="shrink-0 text-sm text-muted tabular-nums">
            {draftItems.length} ejercicios
          </span>
        </div>

        <label className="mt-4 flex flex-col gap-2 text-sm text-foreground-muted">
          Nombre de la rutina
          <input
            type="text"
            value={routineTitle}
            onChange={(event) => setRoutineTitle(event.target.value)}
            className="gusm-input-primary w-full"
          />
        </label>

        <label className="mt-4 flex flex-col gap-2 border-t border-accent/15 pt-4 text-sm text-foreground-muted">
          Partir desde
          <select
            value={selectedTemplateKey ?? "empty"}
            onChange={(event) => handleTemplateChange(event.target.value)}
            className="gusm-input-primary w-full"
          >
            <option value="empty">Rutina vacía</option>
            {ROUTINE_TEMPLATE_KEYS.map((templateKey) => {
              const template = ROUTINE_TEMPLATES[templateKey];

              return (
                <option key={templateKey} value={templateKey}>
                  {template.label}
                </option>
              );
            })}
          </select>
        </label>
      </section>

      <section className={PROFILE_SECTION_CLASS} aria-labelledby="routine-corpus-heading">
        <div className="flex items-center justify-between gap-3 border-b border-accent/15 pb-3">
          <h2 id="routine-corpus-heading" className="text-base font-semibold text-foreground">
            Ejercicios
          </h2>
          <button
            type="button"
            onClick={() => setIsCatalogOpen((isOpen) => !isOpen)}
            aria-expanded={isCatalogOpen}
            className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-base font-semibold text-accent transition-colors hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-[0.98]"
          >
            <Plus className="size-4" aria-hidden="true" />
            Añadir
            <ChevronDown
              className={clsx(
                "size-4 transition-transform duration-200",
                isCatalogOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {isCatalogOpen && (
            <motion.div
              initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
              transition={
                shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
              }
              className="overflow-hidden"
            >
              <div className="border-b border-accent/15 py-3">
                <label className="relative block">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={catalogQuery}
                    onChange={(event) => setCatalogQuery(event.target.value)}
                    placeholder="Buscar ejercicio"
                    className="gusm-input-primary w-full pl-10"
                  />
                </label>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="min-w-0">
                    <span className="sr-only">Filtrar por grupo muscular</span>
                    <select
                      value={selectedMuscle ?? ""}
                      onChange={(event) => setSelectedMuscle(event.target.value || null)}
                      className="gusm-input-primary w-full px-3"
                    >
                      <option value="">Todo músculo</option>
                      {ROUTINE_CATALOG_FILTERS.primaryMuscles.map((muscle) => (
                        <option key={muscle} value={muscle}>
                          {muscle}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="sr-only">Filtrar por equipamiento</span>
                    <select
                      value={selectedEquipment ?? ""}
                      onChange={(event) => setSelectedEquipment(event.target.value || null)}
                      className="gusm-input-primary w-full px-3"
                    >
                      <option value="">Todo equipo</option>
                      {ROUTINE_CATALOG_FILTERS.equipment.map((equipment) => (
                        <option key={equipment} value={equipment}>
                          {equipment}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {catalogNotice && <p className="mt-2 text-sm text-muted">{catalogNotice}</p>}

                <div className="mt-3 max-h-48 overflow-y-auto border-t border-accent/15">
                  {catalogResults.length === 0 ? (
                    <p className="px-1 py-5 text-center text-sm text-muted">
                      No hay ejercicios que coincidan con esos filtros.
                    </p>
                  ) : (
                    catalogResults.map((exercise) => (
                      <button
                        key={exercise.id}
                        type="button"
                        onClick={() => addExercise(exercise)}
                        className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-divider px-1 text-left transition-colors hover:bg-input focus-visible:bg-input focus-visible:outline-none"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-base font-medium text-foreground">
                            {exercise.name}
                          </span>
                        </span>
                        <Plus className="size-4 shrink-0 text-accent" aria-hidden="true" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4">
          {draftItems.length === 0 ? (
            <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
              <SlidersHorizontal className="size-5 text-accent" aria-hidden="true" />
              <p className="mt-3 text-base font-medium text-foreground">Tu rutina está vacía</p>
              <p className="mt-1 text-sm leading-5 text-muted">
                Añade ejercicios desde el catálogo de la Sala de Musculación.
              </p>
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {draftItems.map((item) => (
                <RoutineExerciseItem
                  key={item.id}
                  isExpanded={expandedItemIds.has(item.id)}
                  item={item}
                  onChange={changeDraftItem}
                  onRemove={removeDraftItem}
                  onShowGuide={setGuideItemId}
                  onToggle={toggleDraftItem}
                />
              ))}
            </ol>
          )}
        </div>
      </section>

      <RoutineExerciseGuideDialog exercise={guideExercise} onClose={() => setGuideItemId(null)} />
    </div>
  );
}
