"use client";

import { ChevronDown, Eye, Trash2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import { getRoutineDraftValidationErrors, type RoutineDraftField } from "@/lib/routines/validation";
import type { RoutineDraftItem } from "@/lib/routines/types";

type RoutineExerciseItemProps = {
  isExpanded: boolean;
  item: RoutineDraftItem;
  onChange: (itemId: string, field: RoutineDraftField, value: string) => void;
  onRemove: (itemId: string) => void;
  onShowGuide: (itemId: string) => void;
  onToggle: (itemId: string) => void;
};

type CompactFieldProps = {
  field: Exclude<RoutineDraftField, "effectiveSets" | "notes" | "totalSets">;
  inputMode?: "decimal" | "numeric" | "text";
  item: RoutineDraftItem;
  label: string;
  max?: number;
  maxLength?: number;
  min?: number;
  onChange: RoutineExerciseItemProps["onChange"];
  pattern?: string;
  placeholder: string;
  step?: number;
  type?: "number" | "text";
  validationError?: string;
};

const COMPACT_INPUT_CLASS = "gusm-input-primary h-10 min-h-10 w-full min-w-0 px-1 text-center";
const ITEM_ACTION_BUTTON_CLASS =
  "flex size-10 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-input hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-95";
const GUIDE_ACTION_BUTTON_CLASS =
  "flex size-10 shrink-0 items-center justify-center rounded-lg text-dim transition-colors hover:bg-input hover:text-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-95";

function CompactField({
  field,
  inputMode = "text",
  item,
  label,
  max,
  maxLength,
  min,
  onChange,
  pattern,
  placeholder,
  step,
  type = "text",
  validationError,
}: CompactFieldProps) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block truncate text-xxs font-medium tracking-wide text-muted">
        {label}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        max={max}
        maxLength={maxLength}
        min={min}
        pattern={pattern}
        step={step}
        value={item[field]}
        onChange={(event) => onChange(item.id, field, event.target.value)}
        placeholder={placeholder}
        aria-label={`${label} para ${item.exercise.name}`}
        aria-invalid={validationError ? true : undefined}
        className={clsx(
          COMPACT_INPUT_CLASS,
          validationError && "border-red-500/70 focus-visible:border-red-500/70",
        )}
      />
    </label>
  );
}

export function RoutineExerciseItem({
  isExpanded,
  item,
  onChange,
  onRemove,
  onShowGuide,
  onToggle,
}: RoutineExerciseItemProps) {
  const shouldReduceMotion = useReducedMotion();
  const validationErrors = getRoutineDraftValidationErrors(item);
  const validationError = Object.values(validationErrors).find((error) => error !== undefined);

  return (
    <motion.li
      layout="position"
      className="overflow-hidden rounded-xl border border-accent/15 bg-surface"
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 360, damping: 32, mass: 0.7 }
      }
    >
      <div className="flex min-h-14 items-center gap-2 px-3">
        <div className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-foreground">
            {item.exercise.name}
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted">
            {item.exercise.primaryMuscle} · {item.exercise.equipment}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onShowGuide(item.id)}
          aria-label={`Ver guía visual de ${item.exercise.name}`}
          className={GUIDE_ACTION_BUTTON_CLASS}
        >
          <Eye className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Ocultar" : "Editar"} parámetros de ${item.exercise.name}`}
          className={ITEM_ACTION_BUTTON_CLASS}
        >
          <ChevronDown
            className={clsx("size-4 transition-transform duration-200", isExpanded && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={
              shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
            }
          >
            <div className="border-t border-accent/15 px-3 pt-3 pb-2">
              <div className="grid grid-cols-5 gap-1.5">
                <div className="min-w-0">
                  <span className="mb-1 block truncate text-xxs font-medium tracking-wide text-muted">
                    Series T/E
                  </span>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={5}
                      step={1}
                      value={item.totalSets}
                      onChange={(event) => onChange(item.id, "totalSets", event.target.value)}
                      placeholder="4"
                      aria-label={`Series totales de ${item.exercise.name}`}
                      aria-invalid={validationErrors.totalSets ? true : undefined}
                      className={clsx(
                        COMPACT_INPUT_CLASS,
                        "flex-1",
                        validationErrors.totalSets &&
                          "border-red-500/70 focus-visible:border-red-500/70",
                      )}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={5}
                      step={1}
                      value={item.effectiveSets}
                      onChange={(event) => onChange(item.id, "effectiveSets", event.target.value)}
                      placeholder="2"
                      aria-label={`Series efectivas de ${item.exercise.name}`}
                      aria-invalid={validationErrors.effectiveSets ? true : undefined}
                      className={clsx(
                        COMPACT_INPUT_CLASS,
                        "flex-1",
                        validationErrors.effectiveSets &&
                          "border-red-500/70 focus-visible:border-red-500/70",
                      )}
                    />
                  </div>
                </div>
                <CompactField
                  field="repetitions"
                  item={item}
                  label="Reps"
                  maxLength={5}
                  onChange={onChange}
                  pattern="[0-9]{1,2}(-[0-9]{1,2})?"
                  placeholder="8-12"
                  validationError={validationErrors.repetitions}
                />
                <CompactField
                  field="loadKg"
                  inputMode="decimal"
                  item={item}
                  label="Carga"
                  max={150}
                  min={0.5}
                  onChange={onChange}
                  placeholder="20"
                  step={0.5}
                  type="number"
                  validationError={validationErrors.loadKg}
                />
                <CompactField
                  field="rir"
                  inputMode="numeric"
                  item={item}
                  label="RIR"
                  max={5}
                  min={0}
                  onChange={onChange}
                  placeholder="2"
                  step={1}
                  type="number"
                  validationError={validationErrors.rir}
                />
                <CompactField
                  field="restMinutes"
                  item={item}
                  label="Descanso"
                  maxLength={4}
                  onChange={onChange}
                  pattern="[0-9]{1,2}(:[0-5][0-9])?"
                  placeholder="1:30"
                  validationError={validationErrors.restMinutes}
                />
              </div>

              {validationError && (
                <p role="alert" className="mt-2 text-sm leading-5 text-red-500">
                  {validationError}
                </p>
              )}

              <label className="mt-3 block">
                <span className="mb-1 block text-xxs font-medium tracking-wide text-muted">
                  Observaciones
                </span>
                <input
                  type="text"
                  value={item.notes}
                  onChange={(event) => onChange(item.id, "notes", event.target.value)}
                  placeholder="Opcional"
                  aria-label={`Observaciones para ${item.exercise.name}`}
                  className={clsx(COMPACT_INPUT_CLASS, "px-2 text-left")}
                />
              </label>

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-base text-red-500 transition-colors hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none active:scale-[0.98]"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Quitar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
