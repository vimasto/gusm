"use client";

import { Share2 } from "lucide-react";

const SPANISH_PLURAL_RULES = new Intl.PluralRules("es-CL");
const STREAK_MILESTONES = [1, 4, 8, 16, 24] as const;

type StreakMilestoneProgressProps = {
  streakWeeks: number;
};

function getWeekLabel(streakWeeks: number) {
  return SPANISH_PLURAL_RULES.select(streakWeeks) === "one" ? "semana" : "semanas";
}

function getLatestMilestoneIndex(streakWeeks: number) {
  let latestMilestoneIndex = -1;

  for (const [index, milestone] of STREAK_MILESTONES.entries()) {
    if (streakWeeks < milestone) break;

    latestMilestoneIndex = index;
  }

  return latestMilestoneIndex;
}

export function StreakMilestoneProgress({ streakWeeks }: StreakMilestoneProgressProps) {
  const latestMilestoneIndex = getLatestMilestoneIndex(streakWeeks);
  const latestMilestone =
    latestMilestoneIndex >= 0 ? STREAK_MILESTONES[latestMilestoneIndex] : null;
  const progress =
    latestMilestoneIndex < 0 ? 0 : (latestMilestoneIndex / (STREAK_MILESTONES.length - 1)) * 100;
  const progressWidth = progress === 0 ? "0%" : `calc(${progress}% - 0.25rem)`;
  const milestoneLabel = latestMilestone
    ? `Meta actual: ${latestMilestone} ${getWeekLabel(latestMilestone)}.`
    : "Primera meta: registra una asistencia durante una semana.";

  return (
    <section aria-labelledby="streak-title" className="px-1 pt-1 pb-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="streak-title" className="text-xs font-medium tracking-[0.12em] text-dim uppercase">
            Racha
          </p>
          <p className="mt-1 text-2xl font-semibold text-accent tabular-nums">
            {streakWeeks}{" "}
            <span className="text-base font-medium text-muted">{getWeekLabel(streakWeeks)}</span>
          </p>
        </div>
        <button
          type="button"
          title="Próximamente: compartir racha"
          aria-label="Próximamente: compartir racha"
          className="flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent/10 hover:text-accent active:scale-95"
        >
          <Share2 className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div
        aria-label={`Progreso de racha: ${streakWeeks} ${getWeekLabel(streakWeeks)}`}
        className="mt-5"
      >
        <div className="relative flex items-center justify-between">
          <span aria-hidden="true" className="absolute right-1 left-1 h-px bg-divider" />
          <span
            aria-hidden="true"
            className="absolute left-1 h-px overflow-hidden"
            style={{ width: progressWidth }}
          >
            <span className="gymu-streak-timeline-fill block h-full w-full origin-left bg-accent" />
          </span>
          {STREAK_MILESTONES.map((milestone, index) => (
            <span
              key={milestone}
              aria-hidden="true"
              className={`relative z-10 size-3 rounded-full border ${index <= latestMilestoneIndex ? "border-accent bg-accent" : "border-divider bg-surface"}`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between px-px text-xxs font-medium text-dim tabular-nums">
          {STREAK_MILESTONES.map((milestone) => (
            <span key={milestone}>{milestone}</span>
          ))}
        </div>
      </div>

      <p className="mt-3 text-sm text-muted" aria-live="polite">
        {milestoneLabel}
      </p>
    </section>
  );
}
