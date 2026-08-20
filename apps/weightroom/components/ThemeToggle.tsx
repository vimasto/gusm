"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { clsx } from "clsx";

type Theme = "dark" | "light";
type Props = Omit<React.ComponentProps<"button">, "aria-label" | "onClick" | "type">;

const THEME_STORAGE_KEY = "gymu.theme";

function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeToggle({ className, ...props }: Props) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(function synchronizeTheme() {
    setTheme(getTheme());
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  }

  const isDarkTheme = theme === "dark";
  const Icon = isDarkTheme ? Sun : Moon;

  return (
    <button
      {...props}
      type="button"
      onClick={toggleTheme}
      aria-label={isDarkTheme ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDarkTheme ? "Modo claro" : "Modo oscuro"}
      className={clsx(
        "flex size-8 shrink-0 items-center justify-center rounded-full border border-accent/30",
        "bg-accent/10 text-accent transition-all active:scale-95",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
