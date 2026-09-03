"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, QrCode, Settings, User, Users, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import { getCurrentUser } from "@/lib/current-user";
import { CURRENT_USER_QUERY_KEY } from "@/lib/query-keys";

type AppNavigationProps = {
  children: React.ReactNode;
};

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

const NAVIGATION_EXCLUDED_PATHS = new Set(["/", "/login", "/terminos", "/qr/escanear"]);

function isStaff(role: "student" | "u_staff" | "gym_staff" | "admin"): boolean {
  return role === "gym_staff" || role === "admin";
}

function getNavigationItems(role: "student" | "u_staff" | "gym_staff" | "admin"): NavigationItem[] {
  const items: NavigationItem[] = [
    { href: "/reserva", icon: CalendarDays, label: "Reserva" },
    { href: "/qr", icon: QrCode, label: "QR" },
    { href: "/perfil", icon: User, label: "Perfil" },
  ];

  if (isStaff(role)) items.push({ href: "/bloque", icon: Users, label: "Bloque" });
  if (role === "admin") items.push({ href: "/configuracion", icon: Settings, label: "Ajustes" });

  return items;
}

function isNavigationVisible(pathname: string): boolean {
  return !NAVIGATION_EXCLUDED_PATHS.has(pathname);
}

function NavigationLinks({ items, pathname }: { items: NavigationItem[]; pathname: string }) {
  return items.map((item) => {
    const Icon = item.icon;
    const isActive = pathname === item.href;

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        title={item.label}
        className={clsx(
          "flex size-13 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md",
          "p-0 text-[length:var(--font-size-bottom-navigation)] font-normal leading-4 transition-colors focus-visible:bg-input focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent focus-visible:outline-none active:scale-[0.98]",
          isActive ? "bg-accent/15 text-accent" : "text-muted hover:bg-input hover:text-foreground",
        )}
      >
        <Icon className="size-5.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  });
}

export function AppNavigation({ children }: AppNavigationProps) {
  const pathname = usePathname();
  const navigationVisible = isNavigationVisible(pathname);
  const currentUserQuery = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getCurrentUser,
    enabled: navigationVisible,
    refetchOnMount: "always",
  });
  const currentUser = currentUserQuery.data;
  const items = currentUser ? getNavigationItems(currentUser.role) : [];
  const hasNavigation = navigationVisible && currentUser !== undefined;

  return (
    <div className={clsx("min-h-svh w-full", hasNavigation && "gymu-navigation-active")}>
      {hasNavigation && (
        <nav
          aria-label="Navegación principal"
          className="fixed bottom-[max(env(safe-area-inset-bottom),0.75rem)] left-1/2 z-30 flex min-h-17 w-fit max-w-[calc(100%-1rem)] -translate-x-1/2 items-center justify-center gap-1 rounded-s-full rounded-e-full border border-divider/65 bg-transparent px-3 py-2 shadow-[0_6px_20px_rgb(0_0_0_/_0.12)] backdrop-blur-sm backdrop-saturate-125"
        >
          <NavigationLinks items={items} pathname={pathname} />
        </nav>
      )}
      {children}
    </div>
  );
}
