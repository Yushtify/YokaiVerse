// ─── Manga Reader Storage ───────────────────────────────────────────────
// Centralized save/load system for persisting reader settings, mirroring
// playerStorage.ts's PlayerStorage exactly (same on/off + local/session
// toggle pattern) so the two stay consistent across the codebase.

const ENABLE_SAVING: boolean = true;
const USE_LOCAL_STORAGE: boolean = false;
const READER_STORAGE_KEY: string = "chReaderStorage";

export interface MangaReaderSettings {
  lastGrayScale?: number;
  grayScale?: number;
  cinemaLights?: boolean;
  // Note: add future reader settings here (e.g. zoom?: number, readingMode?: "paged" | "webtoon")
}

export const MangaReaderStorage = {
  getStorage(): Storage | null {
    if (!ENABLE_SAVING) return null;
    return USE_LOCAL_STORAGE ? window.localStorage : window.sessionStorage;
  },

  save(settings: Partial<MangaReaderSettings>): void {
    const storage = this.getStorage();
    if (!storage) return;

    const existingSettings = this.load();
    const updatedSettings = { ...existingSettings, ...settings };

    storage.setItem(READER_STORAGE_KEY, JSON.stringify(updatedSettings));
  },

  load(): MangaReaderSettings {
    const storage = this.getStorage();
    if (!storage) return {};

    const data = storage.getItem(READER_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  },
};
