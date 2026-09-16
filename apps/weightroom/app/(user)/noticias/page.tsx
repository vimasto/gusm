"use client";

import { Newspaper } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CREATE_SUPABASE_BROWSER_CLIENT } from "@gusm/database/client";
import { UserTopBar } from "@/components/UserTopBar";
import { getCurrentUser } from "@/lib/current-user";
import { clearProfileCache } from "@/lib/profile-cache";
import { CURRENT_USER_QUERY_KEY } from "@/lib/query-keys";

export default function NewsPage() {
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
      console.error("[NEWS] could not sign out.", error);
      return;
    }

    clearProfileCache();
    router.replace("/login");
  }

  return (
    <main className="flex min-h-svh w-full justify-center bg-bg">
      <div className="flex h-svh gusm-app-shell flex-col overflow-hidden">
        <header className="z-20 shrink-0 border-b border-divider bg-surface">
          <UserTopBar
            pageTitle="Noticias"
            showActiveBookings={false}
            role={currentUser?.role}
            onGoBookings={() => router.push("/reserva")}
            onGoOvercapacity={() => router.push("/bloque")}
            onGoRoutines={() => router.push("/rutinas")}
            onGoSettings={() => router.push("/configuracion")}
            onSignOut={signOut}
          />
        </header>

        <section className="flex gusm-page-scroll flex-col items-center justify-center px-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-center">
          <Newspaper className="size-8 text-accent" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">Noticias de la sala</h1>
          <p className="mt-2 max-w-72 text-sm leading-6 text-muted">
            Aquí aparecerán los avisos y actividades publicadas por DEFIDER.
          </p>
        </section>
      </div>
    </main>
  );
}
