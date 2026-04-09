"use client";
import { CalendarBanner } from "@/components/CalendarBanner";
import { TimeBlockNav } from "@/components/TimeBlockNav";
import { ParticipantList } from "@/components/ParticipantList";
import { ACCENT } from "@/lib/occupancy";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA - hardcodeado para validar front
// ─────────────────────────────────────────────────────────────────────────────

/**
 * todo: reemplazar con useBlocks(dayOfWeek)
 * Query:  select times from blocks donde dia = n
 */
interface Block {
  id: number;
  timeRange: string; // "HH:MM · HH:MM" formateado para display
}

const MOCK_BLOCKS: Block[] = [
  { id: 1, timeRange: "07:00 · 07:45" },
  { id: 2, timeRange: "08:00 · 08:45" },
  { id: 3, timeRange: "09:15 · 10:00" },
  { id: 4, timeRange: "10:15 · 11:00" },
  { id: 5, timeRange: "12:00 · 12:45" },
  { id: 6, timeRange: "13:45 · 14:25" },
  { id: 7, timeRange: "17:30 · 18:15" },
  { id: 8, timeRange: "18:30 · 19:15" },
  { id: 9, timeRange: "19:30 · 20:15" },
] as const satisfies Block[];

/**
 * todo: reemplazar con useGymRules()
 * Query:  SELECT capacity FROM gym_rules LIMIT 1
 */
const MOCK_TOTAL_SPOTS = 15;

/** generador determinista — solo para mockeo */
function seededRand(seed: number): number {
  const x = Math.sin(seed + 1.618) * 10000;
  return x - Math.floor(x);
}

const FULL_NAMES = [
  "Carlos González",
  "María Muñoz",
  "Juan Rojas",
  "Ana Díaz",
  "Pedro Pérez",
  "Valentina Soto",
  "Diego Contreras",
  "Camila Silva",
  "Andrés Martínez",
  "Sofía Sepúlveda",
  "Felipe Morales",
  "Isabella Torres",
  "Matías Flores",
  "Catalina Rivera",
  "Sebastián Cisternas",
  "Fernanda Figueroa",
  "Rodrigo Herrera",
  "Javiera Medina",
  "Nicolás Fuentes",
  "Constanza Reyes",
  "Ignacio Vega",
  "Martina Castro",
  "Benjamín Ortiz",
  "Daniela Núñez",
  "Tomás Vargas",
];

/**
 * TODO: reemplazar con useBookings(blockId, day)
 *
 * participantCount -> SELECT COUNT(*) FROM bookings WHERE block_id = ? AND day = ?
 */
function getMockData(
  dayIdx: number,
  blockIdx: number,
): {
  participants: string[];
  participantCount: number;
} {
  const seed = dayIdx * 137 + blockIdx * 31;
  const count = Math.min(
    Math.floor(seededRand(seed) * 12) + 2,
    MOCK_TOTAL_SPOTS,
  );
  const participants: string[] = [];
  const used = new Set<string>();
  let attempts = 0;
  while (participants.length < count && attempts < 200) {
    attempts++;
    const name =
      FULL_NAMES[
        Math.floor(seededRand(seed + attempts * 7 + 2) * FULL_NAMES.length)
      ];
    if (name && !used.has(name)) {
      used.add(name);
      participants.push(name);
    }
  }
  return { participants, participantCount: participants.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// week helpers
// ─────────────────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 42;

function getWeek(): Date[] {
  const today = new Date();
  const dow = today.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMon);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function sameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReadonlyView
// ─────────────────────────────────────────────────────────────────────────────

export default function ReadonlyView() {
  const router = useRouter();

  const today = new Date();
  const week = getWeek();
  const todayIdx = week.findIndex((d) => sameDay(d, today));
  const defaultDay = todayIdx >= 0 ? todayIdx : 0;
  const defaultBlock = 5; // índice inicial (13:45) — ajustar según lógica real

  const [dayIdx, setDayIdx] = useState(defaultDay);
  const [blockIdx, setBlockIdx] = useState(defaultBlock);
  const [faded, setFaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const animLock = useRef(false);

  const withFade = useCallback((fn: () => void) => {
    if (animLock.current) return;
    animLock.current = true;
    setFaded(true);
    setTimeout(() => {
      fn();
      setFaded(false);
      animLock.current = false;
    }, 140);
  }, []);

  const changeDay = useCallback(
    (delta: number) =>
      withFade(() => setDayIdx((p) => Math.max(0, Math.min(4, p + delta)))),
    [withFade],
  );

  const changeBlock = useCallback(
    (delta: number) =>
      withFade(() =>
        setBlockIdx((p) =>
          Math.max(0, Math.min(MOCK_BLOCKS.length - 1, p + delta)),
        ),
      ),
    [withFade],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent | MouseEvent) => {
      const clientX =
        "touches" in e
          ? (e as TouchEvent).touches[0]?.clientX
          : (e as MouseEvent).clientX;
      const clientY =
        "touches" in e
          ? (e as TouchEvent).touches[0]?.clientY
          : (e as MouseEvent).clientY;
      if (clientX === undefined || clientY === undefined) return;
      startPos.current = { x: clientX, y: clientY };
    };
    const onEnd = (e: TouchEvent | MouseEvent) => {
      if (!startPos.current) return;
      const target = e.target as HTMLElement;
      if (target.closest("button")) {
        startPos.current = null;
        return;
      }
      const clientX =
        "changedTouches" in e
          ? (e as TouchEvent).changedTouches[0]?.clientX
          : (e as MouseEvent).clientX;
      const clientY =
        "changedTouches" in e
          ? (e as TouchEvent).changedTouches[0]?.clientY
          : (e as MouseEvent).clientY;
      if (clientX === undefined || clientY === undefined) return;
      const dx = clientX - startPos.current.x;
      const dy = clientY - startPos.current.y;
      startPos.current = null;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD)
        changeDay(dx > 0 ? -1 : 1);
      else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_THRESHOLD)
        changeBlock(dy > 0 ? -1 : 1);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("mousedown", onStart);
    document.addEventListener("mouseup", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("mousedown", onStart);
      document.removeEventListener("mouseup", onEnd);
    };
  }, [changeDay, changeBlock]);

  const currentBlock = MOCK_BLOCKS[blockIdx] ?? MOCK_BLOCKS[0];
  const { participants, participantCount } = getMockData(dayIdx, blockIdx);

  if (!currentBlock) return null;

  return (
    <div
      className="min-h-screen flex justify-center"
      style={{ background: "var(--color-bg)" }}
    >
      <div
        ref={containerRef}
        className="relative w-full flex flex-col select-none"
        style={{
          maxWidth: 520,
          height: "100svh",
          overflow: "hidden",
          background: "var(--color-surface)",
        }}
      >
        {/* Bloque fijo: banner + navegador horario  */}
        <div className="flex-shrink-0">
          <CalendarBanner
            week={week}
            today={today}
            selectedDay={dayIdx}
            onSelectDay={(i) => withFade(() => setDayIdx(i))}
            onGoToday={() =>
              withFade(() => {
                setDayIdx(defaultDay);
                setBlockIdx(defaultBlock);
              })
            }
          />
          <TimeBlockNav
            timeRange={currentBlock.timeRange}
            blockPosition={{ current: blockIdx + 1, total: MOCK_BLOCKS.length }}
            totalSpots={MOCK_TOTAL_SPOTS}
            participantCount={participantCount}
            hasPrev={blockIdx > 0}
            hasNext={blockIdx < MOCK_BLOCKS.length - 1}
            onPrev={() => changeBlock(-1)}
            onNext={() => changeBlock(1)}
          />
        </div>

        {/* area scrollable , lista de participantes */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ overscrollBehavior: "contain" }}
        >
          <ParticipantList
            participants={participants}
            totalSpots={MOCK_TOTAL_SPOTS}
            faded={faded}
          />

          {/* block dots indicator  */}
          <div
            className="flex justify-center items-center gap-1.5 py-3"
            style={{ borderTop: "1px solid var(--color-divider)" }}
          >
            {MOCK_BLOCKS.map((_, i) => (
              <button
                key={i}
                onClick={() => withFade(() => setBlockIdx(i))}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === blockIdx ? 20 : 6,
                  height: 6,
                  backgroundColor: i === blockIdx ? ACCENT : "#27272a",
                }}
              />
            ))}
          </div>

          {/* swipe hint */}
          <div
            className="text-center pb-5"
            style={{
              fontSize: 10,
              color: "var(--color-text-ghost)",
              letterSpacing: "0.08em",
            }}
          >
            desliza para cambiar día &nbsp;·&nbsp; ↕ cambiar bloque horario
          </div>
        </div>

        {/* btn flotante: ir a Mi reserva  */}
        {/* todo : actualizar ruta cuando apps/usr este listo */}
        <button
          onClick={() => router.push("/student")}
          className="absolute bottom-6 right-4 flex items-center gap-2 px-4 py-2.5 rounded-full transition-all active:scale-95"
          style={{
            background: ACCENT,
            color: "#000",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.05em",
            boxShadow: "0 4px 24px rgba(245,180,0,0.25)",
          }}
        >
          Mi reserva
        </button>
      </div>
    </div>
  );
}
