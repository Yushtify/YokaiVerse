// ─── Settings Storage ─────────────────────────────────────────────────────
// Centralized save/load system for persisting user settings across
// browser sessions (or just the current tab, depending on
// USE_LOCAL_STORAGE).

// Toggle the entire saving system on/off.
const ENABLE_SAVING = true;

// true  = localStorage (persists across browser restarts)
// false = sessionStorage (cleared when the current tab is closed)
const USE_LOCAL_STORAGE = true;

const SETTINGS_STORAGE_KEY = "yokaiverseSettings";

export interface Settings {
  animations: boolean;
  episodeViewType?: "Grid" | "List";
  theme?: "system" | "light" | "dark";
  timelineSegments?: boolean;
  adultContent?: boolean;

  // NOTE: Add future settings here
  // playbackRate?: number;
  // videoQuality?: "1080" | "720" | "480";
}

export const SettingsStorage = {
  getStorage(): Storage | null {
    if (!ENABLE_SAVING) return null;
    return USE_LOCAL_STORAGE ? localStorage : sessionStorage;
  },

  save(settings: Partial<Settings>): void {
    const storage = this.getStorage();
    if (!storage) return;

    // Merge with existing settings so unrelated values
    // are preserved instead of being overwritten.
    const existingSettings = this.load();
    const updatedSettings = { ...existingSettings, ...settings };

    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
  },

  load(): Settings {
    const storage = this.getStorage();
    if (!storage) return {};

    try {
      const data = storage.getItem(SETTINGS_STORAGE_KEY);
      return data ? (JSON.parse(data) as Settings) : {};
    } catch (err) {
      console.warn(
        `[WARN: settingsStorage] Failed to parse ${SETTINGS_STORAGE_KEY}, resetting.`,
        err,
      );

      storage.removeItem(SETTINGS_STORAGE_KEY);
      return {};
    }
  },
};
