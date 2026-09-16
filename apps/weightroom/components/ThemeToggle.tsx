"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { clsx } from "clsx";
import {
  applyThemePreference,
  getDocumentThemePreference,
  type ThemePreference,
} from "@/lib/theme";

type Props = Omit<React.ComponentProps<"button">, "aria-label" | "onClick" | "type"> & {
  onThemePreferenceChange?: (themePreference: ThemePreference) => Promise<boolean>;
  onThemePreferenceSelect?: (themePreference: ThemePreference) => void;
};

export function ThemeToggle({
  className,
  disabled,
  onThemePreferenceChange,
  onThemePreferenceSelect,
  ...props
}: Props) {
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(function synchronizeTheme() {
    setTheme(getDocumentThemePreference());
  }, []);

  async function toggleTheme() {
    if (disabled || isUpdating) return;

    const previousTheme = theme;
    const nextTheme: ThemePreference = theme === "dark" ? "light" : "dark";

    applyThemePreference(nextTheme);
    setTheme(nextTheme);
    onThemePreferenceSelect?.(nextTheme);

    if (onThemePreferenceChange) {
      setIsUpdating(true);
      let didPersist = false;

      try {
        didPersist = await onThemePreferenceChange(nextTheme);
      } catch {
        didPersist = false;
      } finally {
        setIsUpdating(false);
      }

      if (!didPersist) {
        applyThemePreference(previousTheme);
        setTheme(previousTheme);
        onThemePreferenceSelect?.(previousTheme);
      }
    }
  }

  const isDarkTheme = theme === "dark";
  const Icon = isDarkTheme ? Sun : Moon;

  return (
    <button
      {...props}
      type="button"
      onClick={() => void toggleTheme()}
      disabled={disabled || isUpdating}
      aria-label={isDarkTheme ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDarkTheme ? "Modo claro" : "Modo oscuro"}
      className={clsx(
        "flex size-8 shrink-0 items-center justify-center rounded-full border border-accent/30",
        "bg-accent/10 text-accent transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
