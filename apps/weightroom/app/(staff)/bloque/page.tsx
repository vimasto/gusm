"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, MoreHorizontal, Search, Users, X } from "lucide-react";
import * as z from "zod/v4";
import { CREATE_SUPABASE_BROWSER_CLIENT } from "@gusm/database/client";
import { UserTopBar, type AppRole } from "@/components/UserTopBar";
import { clearQueryCache } from "@/lib/query-client";

const CURRENT_USER_SCHEMA = z.object({
  userName: z.string().min(1),
  role: z.enum(["student", "u_staff", "gym_staff", "admin"]),
  streakWeeks: z.number().int().nonnegative(),
});

const BLOCK_CONTEXT_SCHEMA = z.object({
  bookingDate: z.string().date(),
  timeBlockId: z.number().int().positive(),
  blockStartsAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  standardCapacity: z.number().int().positive(),
  standardCount: z.number().int().nonnegative(),
  overcapacityMaxAbove: z.number().int().nonnegative(),
  overcapacityCount: z.number().int().nonnegative(),
});

const BLOCK_CANDIDATE_SCHEMA = z.object({
  userId: z.string().uuid(),
  userName: z.string().min(1),
  bookingStatus: z.enum(["reserved", "confirmed", "present", "absent", "cancelled"]).nullable(),
  isOvercapacity: z.boolean().nullable(),
  admissionSource: z.enum(["self_service", "staff_exception", "staff_overcapacity"]).nullable(),
  requestId: z.string().uuid().nullable(),
  requestedAt: z.string().datetime().nullable(),
});

const BLOCK_RESPONSE_SCHEMA = z.object({
  context: BLOCK_CONTEXT_SCHEMA,
  candidates: z.array(BLOCK_CANDIDATE_SCHEMA),
});

const SEARCH_RESULT_SCHEMA = z.object({
  userId: z.string().uuid(),
  userName: z.string().min(1),
  institutionalUsername: z.string().min(1),
  bookingStatus: z.enum(["reserved", "confirmed", "present", "absent", "cancelled"]).nullable(),
});

const SEARCH_RESPONSE_SCHEMA = z.object({ results: z.array(SEARCH_RESULT_SCHEMA) });

type CurrentUser = z.infer<typeof CURRENT_USER_SCHEMA>;
type BlockContext = z.infer<typeof BLOCK_CONTEXT_SCHEMA>;
type BlockCandidate = z.infer<typeof BLOCK_CANDIDATE_SCHEMA>;
type SearchResult = z.infer<typeof SEARCH_RESULT_SCHEMA>;
type AdmissionSource = "staff_exception" | "staff_overcapacity";

function getCandidateStatusLabel(candidate: BlockCandidate) {
  if (candidate.bookingStatus === "present") return "Asistencia registrada";
  if (candidate.bookingStatus === "confirmed") return "Confirmado";
  if (candidate.bookingStatus === "reserved") return "Reserva sin confirmar";
  if (candidate.bookingStatus === "absent") return "Ausente";
  if (candidate.bookingStatus === "cancelled") return "Cancelada";
  if (candidate.requestId) return "Solicitud presencial";
  return "Sin reserva";
}

function formatCurrentBlockLabel(context: BlockContext) {
  return `Bloque ${context.timeBlockId} · hasta ${new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Santiago",
  }).format(new Date(context.expiresAt))}`;
}

function isStaff(role: AppRole | undefined): boolean {
  return role === "gym_staff" || role === "admin";
}

export default function CurrentBlockPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [context, setContext] = useState<BlockContext | null>(null);
  const [candidates, setCandidates] = useState<BlockCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openActionUserId, setOpenActionUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function loadBlock() {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [currentUserResponse, blockResponse] = await Promise.all([
        fetch("/api/current-user", { cache: "no-store" }),
        fetch("/api/block", { cache: "no-store" }),
      ]);

      if (!currentUserResponse.ok || !blockResponse.ok) {
        throw new Error("The current block is unavailable.");
      }

      const [currentUserPayload, blockPayload]: [unknown, unknown] = await Promise.all([
        currentUserResponse.json(),
        blockResponse.json(),
      ]);
      const parsedCurrentUser = CURRENT_USER_SCHEMA.safeParse(currentUserPayload);
      const parsedBlock = BLOCK_RESPONSE_SCHEMA.safeParse(blockPayload);

      if (
        !parsedCurrentUser.success ||
        !parsedBlock.success ||
        !isStaff(parsedCurrentUser.data.role)
      ) {
        throw new Error("The current block response is invalid.");
      }

      setCurrentUser(parsedCurrentUser.data);
      setContext(parsedBlock.data.context);
      setCandidates(parsedBlock.data.candidates);
    } catch (error) {
      console.error("[BLOCK] could not load the staff block.", error);
      setLoadError("No hay un bloque habilitado para gestión presencial.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadBlock();
  }, []);

  async function admitUser(userId: string, admissionSource: AdmissionSource) {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "admit", userId, admissionSource }),
      });

      if (!response.ok) throw new Error("Staff admission was rejected.");

      setOpenActionUserId(null);
      await loadBlock();
    } catch (error) {
      console.error("[BLOCK] could not admit the selected user.", error);
      setLoadError("La admisión fue rechazada. Revisa cupos, estado y vigencia del bloque.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function reauthorizeQr(userId: string) {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reauthorize_qr", userId }),
      });

      if (!response.ok) throw new Error("Late QR reauthorization was rejected.");

      setOpenActionUserId(null);
      await loadBlock();
    } catch (error) {
      console.error("[BLOCK] could not reauthorize the late QR.", error);
      setLoadError(
        "No fue posible reabrir el QR. Verifica que la llegada sea posterior a los 15 minutos.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function searchUsers() {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setSearchResults([]);
      setSearchError("Ingresa al menos dos caracteres del usuario institucional.");
      return;
    }

    setSearchError(null);
    try {
      const response = await fetch("/api/block/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalizedQuery }),
      });
      if (!response.ok) throw new Error("Staff search was rejected.");

      const payload: unknown = await response.json();
      const parsed = SEARCH_RESPONSE_SCHEMA.safeParse(payload);
      if (!parsed.success) throw new Error("Staff search response is invalid.");

      setSearchResults(parsed.data.results);
    } catch (error) {
      console.error("[BLOCK] could not search users.", error);
      setSearchError("No fue posible buscar usuarios en este bloque.");
    }
  }

  async function signOut() {
    const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[BLOCK] could not sign out.", error);
      return;
    }

    clearQueryCache();
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
            onGoProfile={() => router.push("/perfil")}
            onGoCheckIn={() => router.push("/qr")}
            onSignOut={signOut}
          />
        </header>

        <div className="flex gusm-page-scroll flex-col gap-4 px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
          {isLoading ? (
            <p className="text-center text-sm text-dim">Cargando bloque actual…</p>
          ) : loadError && !context ? (
            <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-base text-foreground-muted">{loadError}</p>
              <button
                type="button"
                onClick={() => void loadBlock()}
                className="gusm-button-primary"
              >
                Reintentar
              </button>
            </section>
          ) : context ? (
            <>
              <section className="rounded-2xl border border-accent/20 bg-input/40 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium tracking-[0.12em] text-dim uppercase">
                      Gestión presencial
                    </p>
                    <h1 className="mt-1 text-lg font-semibold text-foreground">
                      {formatCurrentBlockLabel(context)}
                    </h1>
                  </div>
                  <Users className="size-5 shrink-0 text-accent" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm text-foreground-muted">
                  {context.standardCount}/{context.standardCapacity} cupos estándar ·{" "}
                  {context.overcapacityCount}/{context.overcapacityMaxAbove} sobrecupos
                </p>
              </section>

              {loadError && (
                <p role="alert" className="text-sm text-rose-400">
                  {loadError}
                </p>
              )}

              <section className="rounded-2xl border border-divider bg-input/30 p-3">
                <div className="flex gap-2">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void searchUsers();
                    }}
                    placeholder="Usuario institucional"
                    className="gusm-control-height min-w-0 flex-1 rounded-xl border border-divider bg-surface px-3 text-base text-foreground outline-none placeholder:text-dim focus:border-accent/60"
                  />
                  <button
                    type="button"
                    onClick={() => void searchUsers()}
                    aria-label="Buscar usuario"
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent active:scale-95"
                  >
                    <Search className="size-5" aria-hidden="true" />
                  </button>
                </div>
                {searchError && (
                  <p role="alert" className="mt-2 text-sm text-rose-400">
                    {searchError}
                  </p>
                )}
                {searchResults.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {searchResults.map((result) => (
                      <div
                        key={result.userId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-divider px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-base text-foreground">{result.userName}</p>
                          <p className="truncate text-xs text-dim">
                            {result.institutionalUsername}
                          </p>
                        </div>
                        {result.bookingStatus === "confirmed" ? (
                          <button
                            type="button"
                            onClick={() => void reauthorizeQr(result.userId)}
                            disabled={isSubmitting}
                            className="flex shrink-0 items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2 py-1.5 text-sm text-accent disabled:opacity-40"
                          >
                            <CheckCircle2 className="size-4" aria-hidden="true" />
                            QR 5 min
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void admitUser(result.userId, "staff_exception")}
                            disabled={isSubmitting}
                            className="flex shrink-0 items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2 py-1.5 text-sm text-accent disabled:opacity-40"
                          >
                            <CheckCircle2 className="size-4" aria-hidden="true" />
                            Admitir
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <h2 className="px-1 text-sm font-medium text-foreground-muted">
                  Personas del bloque
                </h2>
                {candidates.length === 0 ? (
                  <p className="rounded-xl border border-divider px-3 py-4 text-center text-sm text-dim">
                    No hay reservas ni solicitudes presenciales.
                  </p>
                ) : (
                  candidates.map((candidate) => {
                    const hasOpenActions = openActionUserId === candidate.userId;
                    const canAdmit =
                      candidate.bookingStatus !== "confirmed" &&
                      candidate.bookingStatus !== "present";
                    const canReauthorizeQr = candidate.bookingStatus === "confirmed";
                    const canManage = canAdmit || canReauthorizeQr;

                    return (
                      <article
                        key={candidate.userId}
                        className="flex items-center gap-2 rounded-xl border border-divider bg-input/20 px-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base text-foreground">{candidate.userName}</p>
                          <p className="text-sm text-muted">{getCandidateStatusLabel(candidate)}</p>
                        </div>

                        {candidate.isOvercapacity && (
                          <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-1 text-xs text-accent">
                            Sobrecupo
                          </span>
                        )}

                        {canManage && hasOpenActions && (
                          <div className="animate-in fade-in slide-in-from-right-2 flex shrink-0 items-center gap-1 duration-200">
                            {canReauthorizeQr ? (
                              <button
                                type="button"
                                onClick={() => void reauthorizeQr(candidate.userId)}
                                disabled={isSubmitting}
                                className="rounded-lg border border-accent/30 bg-accent/10 px-2 py-1.5 text-sm text-accent disabled:opacity-40"
                              >
                                QR 5 min
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void admitUser(candidate.userId, "staff_exception")
                                  }
                                  disabled={isSubmitting}
                                  className="rounded-lg border border-accent/30 bg-accent/10 px-2 py-1.5 text-sm text-accent disabled:opacity-40"
                                >
                                  Admitir
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void admitUser(candidate.userId, "staff_overcapacity")
                                  }
                                  disabled={isSubmitting}
                                  className="rounded-lg border border-accent/40 bg-accent/15 px-2 py-1.5 text-sm text-accent disabled:opacity-40"
                                >
                                  +1
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {canManage && (
                          <button
                            type="button"
                            onClick={() =>
                              setOpenActionUserId((currentUserId) =>
                                currentUserId === candidate.userId ? null : candidate.userId,
                              )
                            }
                            aria-label="Abrir acciones de admisión"
                            className="flex size-9 shrink-0 items-center justify-center rounded-full text-accent hover:bg-accent/10"
                          >
                            {hasOpenActions ? (
                              <X className="size-4" aria-hidden="true" />
                            ) : (
                              <MoreHorizontal className="size-5" aria-hidden="true" />
                            )}
                          </button>
                        )}
                      </article>
                    );
                  })
                )}
              </section>
            </>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => router.push("/reserva")}
          className="mx-4 mb-5 flex items-center justify-center gap-2 rounded-xl border border-divider py-3 text-base text-muted active:scale-[0.98]"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Volver a reservas
        </button>
      </div>
    </main>
  );
}
