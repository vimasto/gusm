export type ThemePreference = "dark" | "light";

export const THEME_PREFERENCE_STORAGE_KEY = "gymu.theme";

export function getDocumentThemePreference(): ThemePreference {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyThemePreference(themePreference: ThemePreference) {
  document.documentElement.dataset.theme = themePreference;
  window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, themePreference);
}
