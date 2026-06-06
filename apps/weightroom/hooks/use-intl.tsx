"use client";

import { useMemo } from "react";

const LOCALE = "es-CL";

export function useIntl() {
  const dateTimeFormat = useMemo(
    () => ({
      monthLong: new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" }),
      monthShort: new Intl.DateTimeFormat(LOCALE, { month: "short", year: "numeric" }),
      weekday: new Intl.DateTimeFormat(LOCALE, { weekday: "long" }),
      dayOfMonth: new Intl.DateTimeFormat(LOCALE, { day: "numeric" }),
    }),
    [],
  );

  const pluralRules = useMemo(() => new Intl.PluralRules(LOCALE), []);

  const formatPlural = (count: number, singular: string, plural: string) => {
    return pluralRules.select(count) === "one" ? singular : plural;
  };

  const formatSpotsLeft = (spotsLeft: number) => {
    if (spotsLeft <= 0) return "Sin cupos";
    const cupos = formatPlural(spotsLeft, "cupo", "cupos");
    const libres = formatPlural(spotsLeft, "libre", "libres");
    return `${spotsLeft} ${cupos} ${libres}`;
  };

  const formatWeekRange = (start: Date, end: Date) => {
    if (start.getMonth() === end.getMonth()) {
      return dateTimeFormat.monthLong.format(start);
    }
    return `${dateTimeFormat.monthShort.format(start)} — ${dateTimeFormat.monthShort.format(end)}`;
  };

  const formatDateFull = (date: Date) => {
    const dayName = dateTimeFormat.weekday.format(date);
    const dayNum = dateTimeFormat.dayOfMonth.format(date);
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum}`;
  };

  return {
    formatPlural,
    formatSpotsLeft,
    formatWeekRange,
    formatDateFull,
    dateTimeFormat,
  };
}
