"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarCheck,
  Dumbbell,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Settings,
  type LucideIcon,
  User,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { motion, useReducedMotion } from "motion/react";
import { ActiveBookingsPanel, type ActiveBooking } from "@/components/ActiveBookingsPanel";
import { SignOutConfirmationDialog } from "@/components/SignOutConfirmationDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ThemePreference } from "@/lib/theme";

const SPANISH_PLURAL_RULES = new Intl.PluralRules("es-CL");
const STREAK_GLOW_DURATION_MILLISECONDS = 1500;

export type AppRole = "student" | "u_staff" | "gym_staff" | "admin";

type ActivePopover = "bookings" | "menu" | "streak" | null;
type MenuItemVariant = "default" | "destructive";

type AvatarMenuItem = {
  label: string;
  icon: LucideIcon;
  onClick: () => void | Promise<void>;
  variant?: MenuItemVariant;
};

type UserTopBarProps = {
  onGoToday?: () => void;
  isTodaySelected?: boolean;
  onBack?: () => void;
  pageTitle?: string;
  showActiveBookings?: boolean;
  userName?: string;
  role?: AppRole;
  streakWeeks?: number;
  onGoProfile?: () => void;
  onGoCheckIn?: () => void;
  onGoOvercapacity?: () => void;
  onGoInformation?: () => void;
  onGoSettings?: () => void;
  onSignOut?: () => void | Promise<void>;
  activeBookings?: ActiveBooking[];
  onConfirmBooking?: (bookingKey: string) => void;
  onCancelBooking?: (bookingKey: string) => void;
  onThemePreferenceChange?: (themePreference: ThemePreference) => Promise<boolean>;
};

function isAtLeastStaff(role: AppRole): boolean {
  return role === "gym_staff" || role === "admin";
}

function isAdmin(role: AppRole): boolean {
  return role === "admin";
}

function getStreakSeenStorageKey(userName: string): string {
  return `gymu:streak-weeks:${userName.trim().toLocaleLowerCase("es-CL")}`;
}

function getStoredStreakWeeks(storageKey: string): number {
  const value = Number(window.localStorage.getItem(storageKey));
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function UserTopBar({
  onGoToday,
  isTodaySelected,
  onBack,
  pageTitle,
  showActiveBookings = true,
  userName,
  role,
  streakWeeks,
  onGoProfile,
  onGoCheckIn,
  onGoOvercapacity,
  onGoInformation,
  onGoSettings,
  onSignOut,
  activeBookings = [],
  onConfirmBooking,
  onCancelBooking,
  onThemePreferenceChange,
}: UserTopBarProps) {
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [isSignOutConfirmationOpen, setIsSignOutConfirmationOpen] = useState(false);
  const [isStreakCelebrating, setIsStreakCelebrating] = useState(false);
  const topBarRef = useRef<HTMLDivElement>(null);
  const previousStreakWeeksRef = useRef(streakWeeks);
  const shouldReduceMotion = useReducedMotion();

  const closePopover = useCallback(() => {
    setActivePopover(null);
  }, []);

  useEffect(() => {
    if (activePopover === null) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (event.target instanceof Node && topBarRef.current?.contains(event.target)) return;
      closePopover();
    }

    document.addEventListener("click", closeOnOutsideClick);
    return () => document.removeEventListener("click", closeOnOutsideClick);
  }, [activePopover, closePopover]);

  useEffect(() => {
    const previousStreakWeeks = previousStreakWeeksRef.current;
    previousStreakWeeksRef.current = streakWeeks;

    if (streakWeeks === undefined || !userName) return;

    const storageKey = getStreakSeenStorageKey(userName);
    const storedStreakWeeks = getStoredStreakWeeks(storageKey);
    const previousKnownStreakWeeks = previousStreakWeeks ?? storedStreakWeeks;
    window.localStorage.setItem(storageKey, String(streakWeeks));

    if (streakWeeks <= previousKnownStreakWeeks) return;

    setIsStreakCelebrating(true);
    const timeout = window.setTimeout(() => {
      setIsStreakCelebrating(false);
    }, STREAK_GLOW_DURATION_MILLISECONDS);

    return () => window.clearTimeout(timeout);
  }, [streakWeeks, userName]);

  function togglePopover(event: React.MouseEvent<HTMLButtonElement>, popover: ActivePopover) {
    event.stopPropagation();
    setActivePopover((currentPopover) => (currentPopover === popover ? null : popover));
  }

  function handleMenuItemClick(menuItem: AvatarMenuItem) {
    closePopover();

    if (menuItem.variant === "destructive") {
      setIsSignOutConfirmationOpen(true);
      return;
    }

    void menuItem.onClick();
  }

  function confirmSignOut() {
    setIsSignOutConfirmationOpen(false);
    if (onSignOut) void onSignOut();
  }

  const streakLabel =
    streakWeeks === undefined
      ? null
      : SPANISH_PLURAL_RULES.select(streakWeeks) === "one"
        ? "semana entrenando"
        : "semanas entrenando";

  const avatarMenu: AvatarMenuItem[] = [];
  if (onGoProfile) {
    avatarMenu.push({ label: "Perfil", icon: User, onClick: onGoProfile });
  }
  if (onGoCheckIn) {
    avatarMenu.push({ label: "Marcar asistencia", icon: QrCode, onClick: onGoCheckIn });
  }
  if (role && isAtLeastStaff(role) && onGoOvercapacity) {
    avatarMenu.push({ label: "Bloque actual", icon: Users, onClick: onGoOvercapacity });
  }
  if (role && isAtLeastStaff(role) && onGoInformation) {
    avatarMenu.push({ label: "Información", icon: LayoutDashboard, onClick: onGoInformation });
  }
  if (role && isAdmin(role) && onGoSettings) {
    avatarMenu.push({ label: "Configuración", icon: Settings, onClick: onGoSettings });
  }
  if (onSignOut) {
    avatarMenu.push({
      label: "Cerrar sesión",
      icon: LogOut,
      onClick: onSignOut,
      variant: "destructive",
    });
  }

  const hasMenu = avatarMenu.length > 0;
  const hasStreak = streakWeeks !== undefined && streakLabel !== null;

  return (
    <div ref={topBarRef} className="flex min-h-18 items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-accent">
        {hasMenu && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(event) => togglePopover(event, "menu")}
              aria-expanded={activePopover === "menu"}
              aria-label="Abrir menú de cuenta"
              className="flex size-8 items-center justify-center text-accent transition-transform active:scale-95"
            >
              <Menu className="size-4" aria-hidden="true" />
            </button>

            {activePopover === "menu" && (
              <div
                className={clsx(
                  "absolute top-full left-0 z-50 mt-2 flex min-w-52 flex-col rounded-xl",
                  "border border-divider bg-input p-1 shadow-xl",
                  "animate-in fade-in slide-in-from-top-1 duration-200",
                )}
              >
                {avatarMenu.map((menuItem) => {
                  const Icon = menuItem.icon;
                  const isDestructive = menuItem.variant === "destructive";

                  return (
                    <button
                      key={menuItem.label}
                      type="button"
                      onClick={() => handleMenuItemClick(menuItem)}
                      className={clsx(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-base transition-colors",
                        isDestructive
                          ? "text-red-500 hover:bg-red-500/10"
                          : "text-foreground-muted hover:bg-accent/10 hover:text-accent",
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {menuItem.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent transition-all active:scale-95"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </button>
        )}
        <Dumbbell className="size-5 shrink-0" aria-hidden="true" />
        <span className="truncate text-sm font-semibold tracking-[0.14em]">GYMU</span>
        {pageTitle && <span className="truncate text-sm font-medium text-muted">{pageTitle}</span>}
        {onGoToday && (
          <button
            type="button"
            onClick={onGoToday}
            className={clsx(
              "flex min-h-10 shrink-0 items-center rounded-lg px-2 text-base transition-colors active:scale-95",
              isTodaySelected ? "text-accent hover:bg-accent/10" : "text-muted hover:bg-input",
            )}
          >
            Hoy
          </button>
        )}
      </div>

      <div className="flex min-w-0 shrink items-center gap-2">
        {userName && (
          <span className="hidden max-w-48 min-w-0 truncate text-sm text-muted sm:block">
            {userName}
          </span>
        )}

        {showActiveBookings && (
          <button
            type="button"
            onClick={(event) => togglePopover(event, "bookings")}
            aria-expanded={activePopover === "bookings"}
            aria-label="Ver reservas activas"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-accent transition-colors hover:bg-accent/10 active:scale-95"
          >
            <CalendarCheck className="size-4" aria-hidden="true" />
          </button>
        )}

        {showActiveBookings && hasStreak && <span className="h-5 w-px shrink-0 bg-divider" />}

        {hasStreak && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(event) => togglePopover(event, "streak")}
              aria-expanded={activePopover === "streak"}
              aria-label="Ver detalle de racha"
              className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-base text-accent transition-colors hover:bg-accent/10 active:scale-95"
            >
              <span className="relative flex size-4 items-center justify-center" aria-hidden="true">
                {isStreakCelebrating && !shouldReduceMotion && (
                  <motion.span
                    className="absolute -inset-2 rounded-full bg-accent/35 blur-md"
                    initial={{ opacity: 0, scale: 0.55 }}
                    animate={{ opacity: [0, 0.8, 0], scale: [0.55, 1.2, 1.65] }}
                    transition={{ duration: 0.72, repeat: 1, repeatDelay: 0.06 }}
                  />
                )}
                <motion.span
                  animate={
                    isStreakCelebrating && !shouldReduceMotion
                      ? { scale: [1, 1.22, 1], y: [0, -1, 0] }
                      : { scale: 1, y: 0 }
                  }
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Flame className="size-4" />
                </motion.span>
              </span>
              <span className="tabular-nums">{streakWeeks}</span>
              {isStreakCelebrating && (
                <span className="sr-only" aria-live="polite">
                  Nueva semana de racha conseguida
                </span>
              )}
            </button>

            {activePopover === "streak" && (
              <div
                className={clsx(
                  "absolute top-full right-0 z-50 mt-2 flex min-w-52 items-center gap-2 rounded-xl",
                  "border border-accent/20 bg-input px-3 py-2 shadow-xl",
                  "animate-in fade-in slide-in-from-top-1 duration-200",
                )}
              >
                <Flame className="size-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="text-sm text-foreground-muted">
                  Llevas{" "}
                  <span className="font-semibold text-accent tabular-nums">{streakWeeks}</span>{" "}
                  {streakLabel}
                </span>
              </div>
            )}
          </div>
        )}

        {onThemePreferenceChange && (
          <ThemeToggle onThemePreferenceChange={onThemePreferenceChange} />
        )}
      </div>

      {showActiveBookings &&
        activePopover === "bookings" &&
        onConfirmBooking &&
        onCancelBooking && (
          <ActiveBookingsPanel
            bookings={activeBookings}
            onClose={closePopover}
            onConfirm={onConfirmBooking}
            onCancel={onCancelBooking}
          />
        )}

      {isSignOutConfirmationOpen && (
        <SignOutConfirmationDialog
          onCancel={() => setIsSignOutConfirmationOpen(false)}
          onConfirm={confirmSignOut}
        />
      )}
    </div>
  );
}
