import { Flame } from "lucide-react";
import type { TopStreakUser } from "@/lib/statistics";

type Props = {
  users: TopStreakUser[];
};

const PLURAL_RULES = new Intl.PluralRules("es-CL");

function getPlural(count: number, singular: string, plural: string) {
  return PLURAL_RULES.select(count) === "one" ? singular : plural;
}

export function TopStreakUsers({ users }: Props) {
  return (
    <section className="rounded-2xl border border-divider bg-input/30 px-4 py-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Top 10 de rachas</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Ordenado por racha vigente y, ante empate, asistencias acumuladas.
        </p>
      </div>

      {users.length > 0 ? (
        <ol className="mt-4 divide-y divide-divider">
          {users.map((user, index) => (
            <li
              key={`${user.userName}-${index}`}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-foreground">{user.userName}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {user.totalAttendances}{" "}
                  {getPlural(user.totalAttendances, "asistencia", "asistencias")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-accent">
                <Flame className="size-4" aria-hidden="true" />
                <span className="text-sm font-semibold tabular-nums">{user.streakWeeks}</span>
                <span className="sr-only"> semanas de racha</span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 text-sm leading-6 text-muted">
          El ranking aparecerá cuando se registren las primeras asistencias.
        </p>
      )}
    </section>
  );
}
