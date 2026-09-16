export type ThemePreference = "dark" | "light";

export const THEME_PREFERENCE_STORAGE_KEY = "gymu.theme";
const THEME_SWITCHING_ATTRIBUTE = "data-theme-switching";

export function getDocumentThemePreference(): ThemePreference {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyThemePreference(themePreference: ThemePreference) {
  const root = document.documentElement;

  root.setAttribute(THEME_SWITCHING_ATTRIBUTE, "");
  root.dataset.theme = themePreference;

  try {
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, themePreference);
  } catch {
    // El tema visual sigue funcionando aunque el navegador bloquee almacenamiento local.
  }

  window.requestAnimationFrame(function clearThemeSwitchingState() {
    window.requestAnimationFrame(function removeThemeSwitchingState() {
      root.removeAttribute(THEME_SWITCHING_ATTRIBUTE);
    });
  });
}
