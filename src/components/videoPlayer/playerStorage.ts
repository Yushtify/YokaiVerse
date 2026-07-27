// ─── Player Storage ──────────────────────────────────────────────────────
// Centralized save/load system for persisting player settings across
// sessions (or just the current tab, depending on USE_LOCAL_STORAGE).

// Toggle to completely enable/disable the saving system
const ENABLE_SAVING: boolean = true;
// true = localStorage (persistent across browser restarts)
// false = sessionStorage (clears when the tab is closed)
const USE_LOCAL_STORAGE: boolean = false;
const PLAYER_STORAGE_KEY: string = "epPlayerStorage";

export interface PlayerSettings {
  volume?: number;
  lastVolume?: number;
  subtitles?: boolean;
  loop?: boolean;
  autoPlay?: boolean;
  cinemaLights?: boolean;
  playbackRate?: number;
  gestures?: boolean;
  keybinds?: boolean;
  // "144" / "240" / "360" / "480" / "720" / "1080" = manual pin (no auto-adjustment)
  quality?: "144" | "240" | "360" | "480" | "720" | "1080";
  // Note: Add future settings here (e.g., playbackRate?: number, subtitles?: boolean)
}

// Modular Storage System - Renamed to PlayerStorage to avoid TS global scope collisions
export const PlayerStorage = {
  getStorage(): Storage | null {
    if (!ENABLE_SAVING) return null;
    return USE_LOCAL_STORAGE ? window.localStorage : window.sessionStorage;
  },

  save(settings: Partial<PlayerSettings>): void {
    const storage = this.getStorage();
    if (!storage) return;

    // Load existing settings to avoid overwriting other saved properties
    const existingSettings = this.load();
    const updatedSettings = { ...existingSettings, ...settings };

    storage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(updatedSettings));
  },

  load(): PlayerSettings {
    const storage = this.getStorage();
    if (!storage) return {};

    const data = storage.getItem(PLAYER_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  },
};
