import { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Flame, Dumbbell } from 'lucide-react';
import clsx from 'clsx';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (exported so UserView can reuse them)
// ─────────────────────────────────────────────────────────────────────────────

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V'];
const SWIPE_THRESHOLD = 42;

export const MIN_WEEK_OFFSET = -1;
export const MAX_WEEK_OFFSET = 1;

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

/** Returns the 5 weekdays (Mon–Fri) for the week at `weekOffset` from today's week. */
export function getWeekDates(weekOffset: number): Date[] {
  const today = new Date();
  const dow = today.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMon + weekOffset * 7);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface UserCalendarBannerProps {
  userName: string;
  initials: string;
  streakWeeks: number;
  onBack: () => void;
  selectedDay: number;
  weekOffset: number;
  onSelectDay: (i: number) => void;
  onWeekChange: (offset: number) => void;
  onGoToday: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Banner
// ─────────────────────────────────────────────────────────────────────────────

export function UserCalendarBanner({
  userName,
  initials,
  streakWeeks,
  onBack,
  selectedDay,
  weekOffset,
  onSelectDay,
  onWeekChange,
  onGoToday,
}: UserCalendarBannerProps) {
  const today = new Date();
  const week  = getWeekDates(weekOffset);
  const todayInWeek = week.some((d) => sameDay(d, today));

  const start = week[0]!;
  const end   = week[4]!;

  const monthLabel =
    start.getMonth() === end.getMonth()
      ? start.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
      : `${start.toLocaleDateString('es-CL', { month: 'short' })} — ${end.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' })}`;

  // ── Streak popup ─────────────────────────────────────────────────────────
  const [showStreak, setShowStreak] = useState(false);
  const streakRef = useRef<HTMLButtonElement>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openStreak = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowStreak(true);
    timerRef.current = setTimeout(() => setShowStreak(false), 5000);
  }, []);

  const closeStreak = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowStreak(false);
  }, []);

  useEffect(() => {
    if (!showStreak) return;
    const handler = () => closeStreak();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showStreak, closeStreak]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // ── Swipe gesture ────────────────────────────────────────────────────────
  const bannerRef = useRef<HTMLDivElement>(null);
  const startX    = useRef<number | null>(null);

  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent | MouseEvent) => {
      const clientX = 'touches' in e
        ? (e as TouchEvent).touches[0]?.clientX
        : (e as MouseEvent).clientX;
      if (clientX === undefined) return;
      startX.current = clientX;
    };

    const onEnd = (e: TouchEvent | MouseEvent) => {
      if (startX.current === null) return;
      const clientX = 'changedTouches' in e
        ? (e as TouchEvent).changedTouches[0]?.clientX
        : (e as MouseEvent).clientX;
      if (clientX === undefined) return;
      const dx = clientX - startX.current;
      startX.current = null;
      if (Math.abs(dx) <= SWIPE_THRESHOLD) return;
      const next = dx < 0
        ? Math.min(weekOffset + 1, MAX_WEEK_OFFSET)
        : Math.max(weekOffset - 1, MIN_WEEK_OFFSET);
      if (next !== weekOffset) onWeekChange(next);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('mousedown', onStart);
    document.addEventListener('mouseup', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('mousedown', onStart);
      document.removeEventListener('mouseup', onEnd);
    };
  }, [weekOffset, onWeekChange]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={bannerRef}
      className="sticky top-0 z-20 bg-black border-b border-[#111] select-none"
    >
      {/* ── Fila 1 ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        {/* Izquierda: back · dumbbell · mes */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-zinc-800 text-zinc-600 shrink-0 transition-transform active:scale-95"
          >
            <ArrowLeft size={11} />
            <span className="text-[9px] leading-none tracking-wide">atrás</span>
          </button>

          <Dumbbell size={13} className="text-[#f5b400] shrink-0" />

          <span className="text-xs capitalize text-[#52525b] tracking-[0.08em] truncate">
            {monthLabel}
          </span>
        </div>

        {/* Derecha: Hoy · streak · nombre · avatar */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onGoToday}
            className={clsx(
              'text-xs px-3 py-1 rounded-full transition-all',
              todayInWeek
                ? 'bg-[#f5b400]/[.12] text-[#f5b400]'
                : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
            )}
          >
            Hoy
          </button>

          {/* Streak con popup */}
          <div className="relative">
            <button
              ref={streakRef}
              onClick={openStreak}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#f5b400]/[.08] border border-[#f5b400]/20 transition-all active:scale-95"
            >
              <Flame size={10} className="text-[#f5b400]" />
              <span className="text-[10px] text-[#f5b400] tabular-nums">{streakWeeks}</span>
            </button>

            {showStreak && (
              <button
                onClick={(e) => { e.stopPropagation(); closeStreak(); }}
                className={clsx(
                  'absolute top-full right-0 mt-2 z-50',
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl',
                  'bg-zinc-900 border border-[#f5b400]/20 shadow-xl',
                  'whitespace-nowrap text-left min-w-[180px]',
                  'animate-in fade-in slide-in-from-top-1 duration-200'
                )}
              >
                <Flame size={11} className="text-[#f5b400] shrink-0" />
                <span className="text-[11px] text-zinc-300">
                  Llevas{' '}
                  <span className="text-[#f5b400] font-semibold tabular-nums">
                    {streakWeeks}
                  </span>{' '}
                  semana{streakWeeks !== 1 ? 's' : ''} entrenando
                </span>
              </button>
            )}
          </div>

          <span className="text-[11px] text-zinc-500 hidden sm:block">{userName}</span>

          <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[#f5b400]/10 border border-[#f5b400]/30 shrink-0">
            <span className="text-[10px] text-[#f5b400] font-semibold">{initials}</span>
          </div>
        </div>
      </div>

      {/* ── Fila 2: días ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 px-2 pb-4 gap-1">
        {week.map((date, i) => {
          const isSel = i === selectedDay;
          const isT   = sameDay(date, today);

          return (
            <button
              key={i}
              onClick={() => onSelectDay(i)}
              className="flex flex-col items-center gap-1.5 py-1 rounded-2xl transition-all"
            >
              <span
                className={clsx(
                  'text-xs font-medium tracking-[0.12em]',
                  isSel ? 'text-white' : 'text-[#3f3f46]'
                )}
              >
                {DAY_LETTERS[i]}
              </span>

              <div
                className={clsx(
                  'w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200',
                  isSel && 'bg-white'
                )}
              >
                <span
                  className={clsx(
                    'text-sm font-bold',
                    isSel ? 'text-black' : isT ? 'text-[#f5b400]' : 'text-[#71717a]'
                  )}
                >
                  {date.getDate()}
                </span>
              </div>

              <div
                className="rounded-full transition-all duration-300"
                style={{
                  width: isSel ? 20 : 6,
                  height: 5,
                  backgroundColor: isSel ? '#f5b400' : '#27272a',
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WeekIndicator
// ─────────────────────────────────────────────────────────────────────────────

interface WeekIndicatorProps {
  weekOffset: number;
  onWeekChange: (offset: number) => void;
}

const WEEK_LABELS = ['Sem. anterior', 'Esta semana', 'Próx. semana'] as const;

export function WeekIndicator({ weekOffset, onWeekChange }: WeekIndicatorProps) {
  const activeDot = weekOffset + 1;

  return (
    <div className="flex items-center justify-center gap-3 py-2 border-b border-[#111] bg-black shrink-0">
      {[0, 1, 2].map((dot) => {
        const offset   = dot - 1;
        const isActive = dot === activeDot;

        return (
          <button
            key={dot}
            onClick={() => onWeekChange(offset)}
            className="flex flex-col items-center gap-0.5 group"
          >
            <div
              className={clsx(
                'rounded-full transition-all duration-300',
                isActive ? 'bg-[#f5b400]' : 'bg-zinc-800 group-hover:bg-zinc-600'
              )}
              style={{ width: isActive ? 20 : 6, height: 5 }}
            />
            <span
              className={clsx(
                'text-[8px] tracking-widest transition-all duration-200',
                isActive ? 'text-[#f5b400]/60' : 'text-zinc-800'
              )}
            >
              {WEEK_LABELS[dot]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
