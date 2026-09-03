"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type ReservationSuccessOverlayProps = {
  isOpen: boolean;
  onDismiss: () => void;
  title: string;
};

const DISPLAY_DURATION_MILLISECONDS = 1650;

export function ReservationSuccessOverlay({
  isOpen,
  onDismiss,
  title,
}: ReservationSuccessOverlayProps) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;

    const timeout = window.setTimeout(onDismiss, DISPLAY_DURATION_MILLISECONDS);
    return () => window.clearTimeout(timeout);
  }, [isOpen, onDismiss]);

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          className="absolute inset-0 z-30 flex items-center justify-center bg-overlay px-5 backdrop-blur-sm"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className="flex w-full max-w-76 flex-col items-center rounded-2xl border border-accent/55 bg-surface px-6 py-8 text-center"
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.92, y: 8 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 360, damping: 26, mass: 0.55 }
            }
          >
            <div className="relative flex size-20 items-center justify-center" aria-hidden="true">
              <motion.span
                className="absolute inset-0 rounded-full border border-accent/30"
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.65 }}
                animate={{ opacity: [0, 0.8, 0], scale: [0.65, 1.16, 1.3] }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }
                }
              />
              <motion.span
                className="absolute inset-2 rounded-full border border-accent/45"
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.75 }}
                animate={{ opacity: [0, 0.65, 0], scale: [0.75, 1.1, 1.18] }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.62, delay: 0.2, ease: [0.16, 1, 0.3, 1] }
                }
              />
              <motion.span
                className="relative flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground"
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.72 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 380, damping: 24, mass: 0.55 }
                }
              >
                <Check className="size-7" strokeWidth={2.6} />
              </motion.span>
            </div>
            <p className="mt-5 text-lg font-semibold text-foreground">{title}</p>
            <motion.span
              className="mt-1.5 text-sm text-muted"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.2, delay: 0.14, ease: [0.16, 1, 0.3, 1] }
              }
            >
              Tu cupo quedó registrado.
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
