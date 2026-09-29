"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { sileo, Toaster, type SileoOptions } from "sileo";

type AppTheme = "dark" | "light";

const TOASTER_OPTIONS: Partial<SileoOptions> = {
  duration: 3_000,
  roundness: 12,
};

const TOAST_FILL_BY_THEME: Record<AppTheme, string> = {
  dark: "#f5b400",
  light: "#275d8c",
};

function getAppTheme(): AppTheme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function getToastTheme(appTheme: AppTheme): AppTheme {
  return appTheme === "dark" ? "light" : "dark";
}

function getToastFill(theme: AppTheme): string {
  return TOAST_FILL_BY_THEME[theme];
}

export function SileoToaster() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [fill, setFill] = useState("rgb(245 180 0 / 10%)");
  const toasterOptions = useMemo<Partial<SileoOptions>>(
    () => ({ ...TOASTER_OPTIONS, fill }),
    [fill],
  );

  useEffect(() => {
    const initialTheme = getAppTheme();
    setTheme(initialTheme);
    setFill(getToastFill(initialTheme));

    const observer = new MutationObserver(() => {
      const nextTheme = getAppTheme();
      setTheme(nextTheme);
      setFill(getToastFill(nextTheme));
    });
    observer.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    sileo.clear();
  }, [pathname]);

  return (
    <Toaster
      position="top-center"
      offset={{
        bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)",
        top: "calc(env(safe-area-inset-top) + 4.5rem)",
      }}
      options={toasterOptions}
      theme={getToastTheme(theme)}
    />
  );
}
