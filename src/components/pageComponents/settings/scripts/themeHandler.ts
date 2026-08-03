import { SettingsStorage } from "./settingsStorage";

const CONFIG = {
  THEMES: ["system", "light", "dark"] as const,
  DEFAULT_THEME: "system" as const,
  RADIO: {
    GROUP: "webTheme",
    ID_TO_THEME: {
      themeAuto_radio: "system",
      themeLight_radio: "light",
      themeDark_radio: "dark",
    } as const,
    DATASET_STATE: "radstate",
  },
  EVENTS: {
    radChanged: "radChanged",
    initRadioButtons: "initRadioButtons",
  },
  RADIO_SYNC_DELAY_MS: 50,
} as const;

type Theme = (typeof CONFIG.THEMES)[number];

const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

// ─── Theme Helpers ─────────────────────────────────────────────────────────

function getStoredTheme(): Theme {
  const theme = SettingsStorage.load().theme;

  return theme && CONFIG.THEMES.includes(theme) ? theme : CONFIG.DEFAULT_THEME;
}

function getSystemPreference(): "light" | "dark" {
  return mediaQuery.matches ? "dark" : "light";
}

// ─── Theme Application ─────────────────────────────────────────────────────

function applyTheme(theme: Theme): void {
  const resolved = theme === "system" ? getSystemPreference() : theme;

  document.documentElement.classList.toggle("dark", resolved === "dark");

  console.log(
    `[DEBUG: themeHandler] Applied theme: ${theme} (resolved: ${resolved})`,
  );
}

export function setTheme(theme: Theme): void {
  // Persist the selected theme before applying it.
  SettingsStorage.save({ theme });

  applyTheme(theme);
}

// ─── Radio Button Synchronization ──────────────────────────────────────────

function themeToRadioId(theme: Theme): string | null {
  const entry = Object.entries(CONFIG.RADIO.ID_TO_THEME).find(
    ([, value]) => value === theme,
  );

  return entry ? entry[0] : null;
}

function syncRadioUI(theme: Theme): void {
  const activeId = themeToRadioId(theme);
  if (!activeId) return;

  Object.keys(CONFIG.RADIO.ID_TO_THEME).forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;

    element.dataset[CONFIG.RADIO.DATASET_STATE] =
      id === activeId ? "true" : "false";
  });

  // Notify radioButtonHandler.ts to refresh the visual state
  // without directly depending on its implementation.
  document.dispatchEvent(new CustomEvent(CONFIG.EVENTS.initRadioButtons));

  console.log(`[DEBUG: themeHandler] Synced radio UI to: ${theme}`);
}

// ─── Radio Events ──────────────────────────────────────────────────────────

function handleRadChanged(event: Event): void {
  const { group, id } = (event as CustomEvent).detail ?? {};

  if (group !== CONFIG.RADIO.GROUP) return;

  const theme =
    CONFIG.RADIO.ID_TO_THEME[id as keyof typeof CONFIG.RADIO.ID_TO_THEME];

  if (!theme) {
    console.warn(
      `[WARN: themeHandler] Unknown radio id in group "${CONFIG.RADIO.GROUP}": ${id}`,
    );
    return;
  }

  setTheme(theme);
}

// ─── Initialization ────────────────────────────────────────────────────────

function initThemeHandler(): void {
  const currentTheme = getStoredTheme();

  applyTheme(currentTheme);

  // Delay the radio synchronization until the custom radio
  // components have finished initializing.
  setTimeout(() => syncRadioUI(currentTheme), CONFIG.RADIO_SYNC_DELAY_MS);

  console.log(`[DEBUG: themeHandler] Initialized with theme: ${currentTheme}`);
}

mediaQuery.addEventListener("change", () => {
  // Re-apply the resolved theme whenever the operating system
  // theme changes while "system" mode is active.
  if (getStoredTheme() === "system") {
    applyTheme("system");
  }
});

document.addEventListener(CONFIG.EVENTS.radChanged, handleRadChanged);
document.addEventListener("DOMContentLoaded", initThemeHandler);
document.addEventListener("astro:after-swap", initThemeHandler);
