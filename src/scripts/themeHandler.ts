// themeHandler.ts

const CONFIG = {
  STORAGE_KEY: "yokaiverseSettings",
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

type Theme = typeof CONFIG.THEMES[number];

interface YokaiverseSettings {
  theme?: Theme;
  [key: string]: unknown; // diğer ayarlar bu key altında birikebilir, ellenmesin diye
}

const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

// ---------- Storage helpers ----------

function readSettings(): YokaiverseSettings {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    return raw ? (JSON.parse(raw) as YokaiverseSettings) : {};
  } catch (err) {
    console.warn(`[WARN: themeHandler] Failed to parse ${CONFIG.STORAGE_KEY}, resetting.`, err);
    return {};
  }
}

function writeSettings(partial: Partial<YokaiverseSettings>): void {
  const current = readSettings();
  const merged = { ...current, ...partial };
  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(merged));
}

function getStoredTheme(): Theme {
  const stored = readSettings().theme;
  return stored && CONFIG.THEMES.includes(stored) ? stored : CONFIG.DEFAULT_THEME;
}

// ---------- Theme application ----------

function getSystemPreference(): "light" | "dark" {
  return mediaQuery.matches ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  const resolved = theme === "system" ? getSystemPreference() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  console.log(`[DEBUG: themeHandler] Applied theme: ${theme} (resolved: ${resolved})`);
}

export function setTheme(theme: Theme): void {
  writeSettings({ theme });
  applyTheme(theme);
}

// ---------- Radio button sync (visual only, doesn't touch radioButtonHandler.ts) ----------

function themeToRadioId(theme: Theme): string | null {
  const entry = Object.entries(CONFIG.RADIO.ID_TO_THEME).find(([, t]) => t === theme);
  return entry ? entry[0] : null;
}

function syncRadioUI(theme: Theme): void {
  const activeId = themeToRadioId(theme);
  if (!activeId) return;

  Object.keys(CONFIG.RADIO.ID_TO_THEME).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset[CONFIG.RADIO.DATASET_STATE] = id === activeId ? "true" : "false";
  });

  // radioButtonHandler.ts bu event'i dinliyor ve data-radstate'e göre
  // aktif class'ları yeniden hesaplıyor — kendi kodunu değiştirmeden.
  document.dispatchEvent(new CustomEvent(CONFIG.EVENTS.initRadioButtons));
  console.log(`[DEBUG: themeHandler] Synced radio UI to: ${theme}`);
}

// ---------- Radio click -> theme ----------

function handleRadChanged(event: Event): void {
  const { group, id } = (event as CustomEvent).detail ?? {};
  if (group !== CONFIG.RADIO.GROUP) return;

  const theme = CONFIG.RADIO.ID_TO_THEME[id as keyof typeof CONFIG.RADIO.ID_TO_THEME];
  if (!theme) {
    console.warn(`[WARN: themeHandler] Unknown radio id in group "${CONFIG.RADIO.GROUP}": ${id}`);
    return;
  }

  setTheme(theme);
}

// ---------- Init ----------

function initThemeHandler(): void {
  const current = getStoredTheme();
  applyTheme(current);

  setTimeout(() => syncRadioUI(current), CONFIG.RADIO_SYNC_DELAY_MS);

  console.log(`[DEBUG: themeHandler] Initialized with theme: ${current}`);
}

mediaQuery.addEventListener("change", () => {
  if (getStoredTheme() === "system") applyTheme("system");
});

document.addEventListener(CONFIG.EVENTS.radChanged, handleRadChanged);
document.addEventListener("DOMContentLoaded", initThemeHandler);
document.addEventListener("astro:after-swap", initThemeHandler);
