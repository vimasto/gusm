"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MoreHorizontal,
  QrCode,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CREATE_SUPABASE_BROWSER_CLIENT } from "@gusm/database/client";
import { CapacitySlots } from "@/components/CapacitySlots";
import { UserTopBar } from "@/components/UserTopBar";
import { getCurrentUser } from "@/lib/current-user";
import { clearProfileCache } from "@/lib/profile-cache";
import { CURRENT_USER_QUERY_KEY } from "@/lib/query-keys";

const STANDARD_CAPACITY = 15;
const OVERCAPACITY_LIMIT = 3;

type AdmissionSource = "self_service" | "staff_exception" | "staff_overcapacity";
type ParticipantStatus = "confirmed" | "present" | "requested";
type ActionFeedback = {
  description: string;
  title: string;
};
type BlockParticipant = {
  admissionSource?: AdmissionSource;
  canReauthorizeLateQr?: boolean;
  id: string;
  isLateQrAuthorized?: boolean;
  name: string;
  status: ParticipantStatus;
  username: string;
};

const INITIAL_PARTICIPANTS: BlockParticipant[] = [
  { id: "1", name: "Matías Rojas", status: "present", username: "matias.rojas" },
  {
    admissionSource: "self_service",
    id: "2",
    name: "Constanza Vega",
    status: "confirmed",
    username: "constanza.vega",
  },
  { id: "3", name: "Antonia Pérez", status: "requested", username: "antonia.perez" },
  {
    admissionSource: "self_service",
    canReauthorizeLateQr: true,
    id: "4",
    name: "Diego Fuentes",
    status: "confirmed",
    username: "diego.fuentes",
  },
];

const MOCK_SEARCH_RESULTS: BlockParticipant[] = [
  { id: "5", name: "Gabriel Araya", status: "requested", username: "gabriel.araya" },
  { id: "6", name: "Sofía Morales", status: "requested", username: "sofia.morales" },
  { id: "7", name: "Tomás Vidal", status: "requested", username: "tomas.vidal" },
];

function getParticipantStatusLabel(participant: BlockParticipant): string {
  if (participant.status === "present") return "Asistencia registrada";
  if (participant.status === "requested") return "Solicitud de ingreso";
  if (participant.isLateQrAuthorized) return "QR disponible por 5 min";
  if (participant.admissionSource === "staff_exception") return "Ingreso autorizado";
  if (participant.admissionSource === "staff_overcapacity") return "Sobrecupo autorizado";
  return "Reserva confirmada";
}

function getParticipantStatusClass(participant: BlockParticipant): string {
  if (participant.status === "requested")
    return "border-amber-500/35 bg-amber-500/10 text-amber-400";
  if (participant.status === "present")
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (participant.isLateQrAuthorized) return "border-accent/35 bg-accent/10 text-accent";
  return "border-divider bg-ghost/50 text-muted";
}

function getParticipantStatusTextClass(participant: BlockParticipant): string {
  if (participant.status === "requested") return "text-amber-400";
  if (participant.status === "present") return "text-emerald-400";
  if (participant.isLateQrAuthorized) return "text-accent";
  return "text-muted";
}

function getInitials(name: string): string {
  const names = name.split(" ");
  const firstInitial = names[0]?.[0] ?? "";
  const lastInitial = names.at(-1)?.[0] ?? "";
  return `${firstInitial}${lastInitial}`.toUpperCase();
}

export default function CurrentBlockPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const currentUserQuery = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getCurrentUser,
  });
  const [participants, setParticipants] = useState(INITIAL_PARTICIPANTS);
  const [standardCount, setStandardCount] = useState(14);
  const [overcapacityCount, setOvercapacityCount] = useState(0);
  const [openParticipantId, setOpenParticipantId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  const currentUser = currentUserQuery.data;
  const normalizedQuery = query.trim().toLocaleLowerCase("es-CL");
  const searchResults = MOCK_SEARCH_RESULTS.filter((result) => {
    if (!normalizedQuery) return true;
    return result.name.toLocaleLowerCase("es-CL").includes(normalizedQuery);
  });

  function dismissFeedback() {
    setFeedback(null);
  }

  function handleParticipantAction(participant: BlockParticipant) {
    if (participant.status === "requested") {
      const isStandardAdmission = standardCount < STANDARD_CAPACITY;
      const admissionSource: AdmissionSource = isStandardAdmission
        ? "staff_exception"
        : "staff_overcapacity";

      if (!isStandardAdmission && overcapacityCount >= OVERCAPACITY_LIMIT) {
        setFeedback({
          description: "El máximo operativo de sobrecupo ya fue alcanzado para este bloque.",
          title: "No quedan sobrecupos disponibles",
        });
        return;
      }

      setParticipants((currentParticipants) =>
        currentParticipants.map((currentParticipant) => {
          if (currentParticipant.id !== participant.id) return currentParticipant;
          return {
            ...currentParticipant,
            admissionSource,
            isLateQrAuthorized: true,
            status: "confirmed",
          };
        }),
      );
      if (isStandardAdmission) {
        setStandardCount((currentCount) => currentCount + 1);
      } else {
        setOvercapacityCount((currentCount) => currentCount + 1);
      }
      setFeedback({
        description:
          "La persona puede generar y presentar su QR durante los próximos cinco minutos.",
        title: isStandardAdmission ? "Ingreso autorizado" : "Sobrecupo autorizado",
      });
    } else if (participant.status === "confirmed") {
      setParticipants((currentParticipants) =>
        currentParticipants.map((currentParticipant) =>
          currentParticipant.id === participant.id
            ? { ...currentParticipant, isLateQrAuthorized: true }
            : currentParticipant,
        ),
      );
      setFeedback({
        description:
          "La reserva conserva su procedencia y su cupo. Solo se habilitó el QR por cinco minutos.",
        title: "QR habilitado temporalmente",
      });
    }

    setOpenParticipantId(null);
  }

  function addSearchResult(result: BlockParticipant) {
    const alreadyListed = participants.some((participant) => participant.id === result.id);
    if (alreadyListed) {
      setFeedback({
        description: "Esta persona ya está incluida en la lista del bloque actual.",
        title: "Persona ya añadida",
      });
      return;
    }

    setParticipants((currentParticipants) => [...currentParticipants, result]);
    setQuery("");
    setIsSearchOpen(false);
    setOpenParticipantId(result.id);
  }

  async function signOut() {
    const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[BLOCK] could not sign out.", error);
      return;
    }

    clearProfileCache();
    router.replace("/login");
  }

  return (
    <main className="flex min-h-svh w-full justify-center bg-bg">
      <div className="flex h-svh gusm-app-shell flex-col overflow-hidden bg-surface">
        <header className="z-20 shrink-0 border-b border-divider bg-surface">
          <UserTopBar
            onBack={() => router.push("/reserva")}
            pageTitle="Bloque actual"
            showActiveBookings={false}
            userName={currentUser?.userName}
            role={currentUser?.role}
            streakWeeks={currentUser?.streakWeeks}
            onGoProfile={() => router.push("/perfil")}
            onGoCheckIn={() => router.push("/qr")}
            onGoSettings={() => router.push("/configuracion")}
            onSignOut={signOut}
          />
        </header>

        <div className="gusm-page-scroll px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-5">
            <section className="border-b border-divider pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
                    Control de ingreso
                  </h1>
                  <p className="mt-1 text-sm text-muted">Bloque 7 · 17:15 · 18:40</p>
                </div>
                <QrCode className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm leading-5 text-foreground-muted">
                Autoriza ingresos presenciales y recupera QR tardíos sin perder la trazabilidad.
              </p>
            </section>

            <section aria-label="Capacidad del bloque" className="flex flex-col gap-3">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {standardCount}/{STANDARD_CAPACITY} cupos estándar
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {overcapacityCount}/{OVERCAPACITY_LIMIT} sobrecupos autorizados
                  </p>
                </div>
                <Users className="size-5 shrink-0 text-accent" aria-hidden="true" />
              </div>
              <CapacitySlots occupied={standardCount} total={STANDARD_CAPACITY} />
            </section>

            <section className="border-y border-divider py-3">
              <button
                type="button"
                onClick={() => setIsSearchOpen((isOpen) => !isOpen)}
                aria-expanded={isSearchOpen}
                className="flex w-full items-center justify-between gap-3 text-left text-base text-foreground transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <span className="flex items-center gap-2">
                  <UserPlus className="size-4 text-accent" aria-hidden="true" />
                  Añadir persona sin reserva
                </span>
                {isSearchOpen ? (
                  <X className="size-4" aria-hidden="true" />
                ) : (
                  <Search className="size-4" aria-hidden="true" />
                )}
              </button>

              <AnimatePresence initial={false}>
                {isSearchOpen && (
                  <motion.div
                    initial={
                      shouldReduceMotion
                        ? false
                        : { opacity: 0, y: -6, clipPath: "inset(0 0 100% 0)" }
                    }
                    animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
                    exit={
                      shouldReduceMotion
                        ? undefined
                        : { opacity: 0, y: -4, clipPath: "inset(0 0 100% 0)" }
                    }
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
                    }
                    className="mt-3 flex flex-col gap-2"
                  >
                    <label className="sr-only" htmlFor="block-user-search">
                      Buscar por usuario institucional
                    </label>
                    <input
                      id="block-user-search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar usuario institucional"
                      className="gusm-input-primary w-full"
                    />
                    <div className="flex flex-col gap-1">
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          onClick={() => addSearchResult(result)}
                          className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 text-left transition-colors hover:bg-input focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-base text-foreground">
                              {result.name}
                            </span>
                            <span className="block truncate text-sm text-muted">
                              {result.username}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm text-accent">Añadir</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <section aria-labelledby="block-participants-title">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2
                  id="block-participants-title"
                  className="text-base font-semibold text-foreground"
                >
                  Personas del bloque
                </h2>
                <span className="text-sm text-muted tabular-nums">{participants.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {participants.map((participant) => {
                  const isActionOpen = openParticipantId === participant.id;
                  const isActionable =
                    participant.status === "requested" ||
                    (participant.status === "confirmed" && participant.canReauthorizeLateQr);
                  const isStandardAdmission = standardCount < STANDARD_CAPACITY;
                  const actionLabel =
                    participant.status === "requested"
                      ? isStandardAdmission
                        ? "Autorizar ingreso"
                        : "Autorizar sobrecupo"
                      : "Habilitar QR 5 min";

                  return (
                    <motion.article
                      key={participant.id}
                      layout
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { layout: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }
                      }
                      className="rounded-xl border border-divider bg-input/45 px-3 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ghost text-sm font-semibold text-foreground"
                          aria-hidden="true"
                        >
                          {getInitials(participant.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold text-foreground">
                            {participant.name}
                          </p>
                          <p className="truncate text-sm text-muted">{participant.username}</p>
                        </div>
                        <span
                          className={clsx(
                            "hidden shrink-0 rounded-full border px-2 py-1 text-xs sm:block",
                            getParticipantStatusClass(participant),
                          )}
                        >
                          {getParticipantStatusLabel(participant)}
                        </span>
                        {isActionable && (
                          <button
                            type="button"
                            onClick={() =>
                              setOpenParticipantId((openId) =>
                                openId === participant.id ? null : participant.id,
                              )
                            }
                            aria-expanded={isActionOpen}
                            aria-label={`Acciones para ${participant.name}`}
                            className="flex size-9 shrink-0 items-center justify-center text-accent transition-transform focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-95"
                          >
                            {isActionOpen ? (
                              <X className="size-4" aria-hidden="true" />
                            ) : (
                              <MoreHorizontal className="size-5" aria-hidden="true" />
                            )}
                          </button>
                        )}
                      </div>
                      <p
                        className={clsx(
                          "mt-2 text-sm sm:hidden",
                          getParticipantStatusTextClass(participant),
                        )}
                      >
                        {getParticipantStatusLabel(participant)}
                      </p>

                      <AnimatePresence initial={false}>
                        {isActionOpen && (
                          <motion.div
                            initial={
                              shouldReduceMotion
                                ? false
                                : { opacity: 0, y: -5, clipPath: "inset(0 0 100% 0)" }
                            }
                            animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
                            exit={
                              shouldReduceMotion
                                ? undefined
                                : { opacity: 0, y: -3, clipPath: "inset(0 0 100% 0)" }
                            }
                            transition={
                              shouldReduceMotion
                                ? { duration: 0 }
                                : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
                            }
                            className="mt-3 flex items-center gap-2 border-t border-divider pt-3"
                          >
                            <button
                              type="button"
                              onClick={() => handleParticipantAction(participant)}
                              className={clsx(
                                "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98]",
                                participant.status === "requested" && !isStandardAdmission
                                  ? "border-red-500/35 bg-red-500/10 text-red-400 focus-visible:ring-red-400"
                                  : "border-accent/35 bg-accent/10 text-accent hover:bg-accent/15 focus-visible:ring-accent",
                              )}
                            >
                              {participant.status === "confirmed" ? (
                                <Clock3 className="size-4" aria-hidden="true" />
                              ) : (
                                <CheckCircle2 className="size-4" aria-hidden="true" />
                              )}
                              {actionLabel}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </div>
            </section>

            <p className="flex items-start gap-2 pb-2 text-xs leading-5 text-dim">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Vista de maqueta: las autorizaciones no modifican reservas ni asistencias reales.
            </p>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {feedback && (
            <motion.div
              className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] gusm-app-overlay z-40 px-4"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
              transition={
                shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
              }
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3 rounded-xl border border-accent/35 bg-surface px-4 py-3 shadow-xl">
                <CheckCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground">{feedback.title}</p>
                  <p className="mt-0.5 text-sm leading-5 text-muted">{feedback.description}</p>
                </div>
                <button
                  type="button"
                  onClick={dismissFeedback}
                  aria-label="Cerrar aviso"
                  className="shrink-0 text-muted transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
