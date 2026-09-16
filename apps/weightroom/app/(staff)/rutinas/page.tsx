"use client";

import { useRouter } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CREATE_SUPABASE_BROWSER_CLIENT } from "@gusm/database/client";
import { RoutineEditor } from "@/components/RoutineEditor";
import { UserTopBar } from "@/components/UserTopBar";
import { getCurrentUser } from "@/lib/current-user";
import { clearProfileCache } from "@/lib/profile-cache";
import { CURRENT_USER_QUERY_KEY } from "@/lib/query-keys";

function isGymStaff(role: "student" | "u_staff" | "gym_staff" | "admin"): boolean {
  return role === "gym_staff" || role === "admin";
}

export default function RoutinesPage() {
  const router = useRouter();
  const currentUserQuery = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getCurrentUser,
  });
  const currentUser = currentUserQuery.data;

  async function signOut() {
    const supabase = CREATE_SUPABASE_BROWSER_CLIENT();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[ROUTINES] could not sign out.", error);
      return;
    }

    clearProfileCache();
    router.replace("/login");
  }

  if (currentUser && !isGymStaff(currentUser.role)) {
    return (
      <main className="flex min-h-svh w-full justify-center bg-bg">
        <div className="flex h-svh gusm-app-shell flex-col overflow-hidden bg-surface">
          <header className="z-20 shrink-0 border-b border-divider bg-surface">
            <UserTopBar
              pageTitle="Rutinas"
              showActiveBookings={false}
              showUserName={false}
              role={currentUser.role}
              streakWeeks={currentUser.streakWeeks}
              onGoBookings={() => router.push("/reserva")}
              onGoOvercapacity={() => router.push("/bloque")}
              onGoRoutines={() => router.push("/rutinas")}
              onGoSettings={() => router.push("/configuracion")}
              onSignOut={signOut}
            />
          </header>
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <Dumbbell className="size-6 text-muted" aria-hidden="true" />
            <h1 className="mt-4 text-lg font-semibold text-foreground">
              Acceso de personal requerido
            </h1>
            <p className="mt-1 text-sm leading-5 text-muted">
              La creación de rutinas está disponible para el equipo de sala y administración.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh w-full justify-center bg-bg">
      <div className="flex h-svh gusm-app-shell flex-col overflow-hidden bg-surface">
        <header className="z-20 shrink-0 border-b border-divider bg-surface">
          <UserTopBar
            pageTitle="Rutinas"
            showActiveBookings={false}
            showUserName={false}
            role={currentUser?.role}
            streakWeeks={currentUser?.streakWeeks}
            onGoBookings={() => router.push("/reserva")}
            onGoOvercapacity={() => router.push("/bloque")}
            onGoRoutines={() => router.push("/rutinas")}
            onGoSettings={() => router.push("/configuracion")}
            onSignOut={signOut}
          />
        </header>
        <RoutineEditor />
      </div>
    </main>
  );
}
