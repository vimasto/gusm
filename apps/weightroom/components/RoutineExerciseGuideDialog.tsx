"use client";

import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import type { RoutineCatalogExercise } from "@/lib/routines/types";

type RoutineExerciseGuideDialogProps = {
  exercise: RoutineCatalogExercise | null;
  onClose: () => void;
};

const SWIPE_DISTANCE_PIXELS = 48;
const SWIPE_VELOCITY_PIXELS_PER_SECOND = 420;

function getExerciseFramePath(exercise: RoutineCatalogExercise, frameIndex: 1 | 2 | 3): string {
  return `/routine-exercises/${exercise.slug}/frame-${frameIndex}.png`;
}

export function RoutineExerciseGuideDialog({ exercise, onClose }: RoutineExerciseGuideDialogProps) {
  const shouldReduceMotion = useReducedMotion();
  const [visibleFramePosition, setVisibleFramePosition] = useState(0);
  const [transitionDirection, setTransitionDirection] = useState<-1 | 1>(1);

  useEffect(() => {
    setVisibleFramePosition(0);
    setTransitionDirection(1);
  }, [exercise]);

  useEffect(() => {
    if (exercise === null) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [exercise, onClose]);

  if (exercise === null) return null;

  const frameCount = exercise.frames.length;
  const visibleFrame = exercise.frames[visibleFramePosition] ?? exercise.frames[0];
  if (!visibleFrame) return null;

  function moveFrame(offset: -1 | 1, frameCount: number) {
    const nextFramePosition = visibleFramePosition + offset;
    if (nextFramePosition < 0 || nextFramePosition >= frameCount) return;

    setTransitionDirection(offset);
    setVisibleFramePosition(nextFramePosition);
  }

  function handleFrameDragEnd(
    _: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number }; velocity: { x: number } },
  ) {
    const shouldMoveLeft =
      info.offset.x <= -SWIPE_DISTANCE_PIXELS ||
      info.velocity.x <= -SWIPE_VELOCITY_PIXELS_PER_SECOND;
    const shouldMoveRight =
      info.offset.x >= SWIPE_DISTANCE_PIXELS || info.velocity.x >= SWIPE_VELOCITY_PIXELS_PER_SECOND;

    if (shouldMoveLeft) moveFrame(1, frameCount);
    else if (shouldMoveRight) moveFrame(-1, frameCount);
  }

  function handleBackdropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return createPortal(
    <AnimatePresence initial={false}>
      <motion.div
        className="fixed inset-0 gusm-app-overlay z-[60] flex items-center justify-center bg-overlay px-4 py-6 backdrop-blur-sm"
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
        onPointerDown={handleBackdropPointerDown}
      >
        <motion.section
          role="dialog"
          aria-modal="true"
          aria-label={`Guía visual para ${exercise.name}`}
          className="relative flex w-full max-w-96 flex-col overflow-hidden rounded-2xl border border-divider bg-surface shadow-2xl"
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.97, y: 8 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 340, damping: 28, mass: 0.72 }
          }
        >
          <div className="flex items-start justify-between gap-4 px-4 pt-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-[-0.02em] text-foreground">
                {exercise.name}
              </h2>
              <p className="mt-0.5 text-sm text-muted">{exercise.primaryMuscle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar guía del ejercicio"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-input hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-95"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="routine-exercise-guide-frame relative mx-4 mt-3 aspect-square overflow-hidden rounded-xl border border-divider bg-input">
            <AnimatePresence initial={false} mode="wait" custom={transitionDirection}>
              <motion.div
                key={visibleFrame.index}
                drag={shouldReduceMotion ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={handleFrameDragEnd}
                className="absolute inset-0 touch-pan-y"
                initial={shouldReduceMotion ? false : { opacity: 0, x: transitionDirection * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, x: transitionDirection * -24 }}
                transition={
                  shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
                }
              >
                <Image
                  alt={`Paso ${visibleFrame.index} de ${exercise.name}`}
                  className="routine-exercise-guide-image pointer-events-none size-full object-contain select-none [-webkit-user-drag:none]"
                  draggable={false}
                  height={512}
                  src={getExerciseFramePath(exercise, visibleFrame.index)}
                  unoptimized
                  width={512}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex justify-center gap-2 py-4" aria-label="Pasos del ejercicio">
            {exercise.frames.map((frame, framePosition) => {
              const isVisible = framePosition === visibleFramePosition;

              return (
                <button
                  key={frame.index}
                  type="button"
                  onClick={() => {
                    setTransitionDirection(framePosition > visibleFramePosition ? 1 : -1);
                    setVisibleFramePosition(framePosition);
                  }}
                  aria-label={`Ver paso ${frame.index}`}
                  aria-current={isVisible ? "step" : undefined}
                  className={clsx(
                    "size-2.5 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none",
                    isVisible ? "bg-accent" : "bg-dim hover:bg-muted",
                  )}
                />
              );
            })}
          </div>

          <p className="border-t border-divider px-4 py-3 text-center text-xxs leading-4 text-muted">
            Ilustraciones de Bryl Lim, licenciadas bajo CC BY-SA 4.0.
          </p>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
