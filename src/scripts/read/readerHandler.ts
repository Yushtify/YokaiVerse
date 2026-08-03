/**
 * readerHandler.ts - Modular Volume & Chapter Handler
 * [DEBUG: readerHandler.ts]
 */

import { listSeries, setActiveCard } from "../listSeries.ts";
import { renderChapterPages } from "../../components/reader/readerPages.ts";
import { isNsfwEnabled, isSeriesNsfw } from "../nsfwChecker.ts";
import { debugHandler } from "../../components/reader/readerConfig.ts";

// --- READER_PAGE_CONFIGURATION ---
const READER_PAGE_CONFIG = {
  // Reader page endpoint path
  READ_PAGE_PATH: "/read",

  // Data sources
  MANGA_ID_MAP_URL: "/mangaIDs.json",
  INFO_FILE_NAME: "information.json",

  // URL Parsing (v=mangaID+v1_ch1 or v=mangaID+ch1)
  QUERY_PARAM_MANGA_ID: "v",
  ID_SEPARATOR_REGEX: /\s+/g,
  ID_SEPARATOR_REPLACEMENT: "+",
  VOLUME_MATCH_REGEX: /v(?:ol)?_?(\d+)/i,
  CHAPTER_MATCH_REGEX: /ch_?(\d+(?:\.\d+)?)/i,
  ID_SPLIT_REGEX: /[+ ]/,

  // Default values when parameters are missing
  DEFAULT_VOLUME: 1,
  DEFAULT_CHAPTER: 1,

  // DOM Element IDs (compatible with titleBar.astro)
  ELEMENT_IDS: {
    mangaTitle: "mangaTitle",
    chapterTitle: "chapterTitle",
    chapterDesc: "chapterDesc",
    mangaAuthor: "mangaAuthor",
    chapterUploader: "chapterUploader",
    chapterUploaderIMG: "chapterUploaderIMG",
  },

  // Messages and Default Strings
  LOADING_MESSAGE_INITIAL: "Loading Chapter...",
  LOADING_MESSAGE_SWITCHING: "Fetching Chapter...",
  ERROR_NO_MANGA_ID: "Couldn't find Manga ID in URL.",
  ERROR_DB_UNREACHABLE: "Couldn't reach Manga database.",
  ERROR_SERIES_NOT_FOUND: "Couldn't find Manga series.",
  ERROR_NSFW_DISABLED:
    "This manga is unavailable because adult content is disabled in your settings.",
  ERROR_CHAPTER_LOAD_FAILED: "Couldn't load chapter pages.",
  DEFAULT_MANGA_TITLE: "Untitled Manga",
  DEFAULT_CHAPTER_NAME: "Untitled Chapter",
} as const;

// --- TYPE DECLARATIONS ---
interface LoadingManagerInterface {
  show: (message?: string) => void;
  hide: () => void;
  setError: (errorMessage: string) => void;
}

interface ChapterInfo {
  title?: string;
  chapterName?: string;
  desc?: string;
  author?: string;
  uploader?: string;
}

declare const LoadingManager: LoadingManagerInterface;

// --- GLOBAL STATE ---
let mangaRootSRC: string;
let currentVolume_Num: number | null = READER_PAGE_CONFIG.DEFAULT_VOLUME;
let currentChapter_Num: number = READER_PAGE_CONFIG.DEFAULT_CHAPTER;

/**
 * MAIN INITIALIZATION
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (window.location.pathname !== READER_PAGE_CONFIG.READ_PAGE_PATH) return;

  debugHandler("L", "Manga reading page detected.", "readerHandler.ts");
  if (typeof LoadingManager !== "undefined") {
    LoadingManager.show(READER_PAGE_CONFIG.LOADING_MESSAGE_INITIAL);
  }

  const params = new URLSearchParams(window.location.search);
  const rawV = params.get(READER_PAGE_CONFIG.QUERY_PARAM_MANGA_ID);

  if (!rawV) {
    if (typeof LoadingManager !== "undefined") {
      LoadingManager.setError(READER_PAGE_CONFIG.ERROR_NO_MANGA_ID);
    }
    return;
  }

  const { mangaID, volume, chapter } = parseMangaIdentifier(rawV);
  currentVolume_Num = volume;
  currentChapter_Num = chapter;

  try {
    // 1. Fetch root directory path from mangaIDs.json map
    const idMap = await fetchJson(READER_PAGE_CONFIG.MANGA_ID_MAP_URL);
    if (!idMap) throw new Error(READER_PAGE_CONFIG.ERROR_DB_UNREACHABLE);

    mangaRootSRC = idMap[mangaID];
    if (!mangaRootSRC)
      throw new Error(READER_PAGE_CONFIG.ERROR_SERIES_NOT_FOUND);

    // Series-level Adult Content gate: blocks reading entirely if the series is
    // flagged Adult Content and the user has adult content disabled.
    if ((await isSeriesNsfw(mangaRootSRC)) && !isNsfwEnabled()) {
      throw new Error(READER_PAGE_CONFIG.ERROR_NSFW_DISABLED);
    }

    // 2. Load chapter pages & update title bar
    await LoadChapterData(mangaRootSRC);

    // 3. Build sidebar/playlist navigation structure via listSeries module
    await listSeries({
      root: mangaRootSRC,
      activeSeason: currentVolume_Num || 1,
      activeEpisode: currentChapter_Num,
      onEpisodeClick: (vol, ch) => SwitchChapter(vol, ch),
    });

    if (typeof LoadingManager !== "undefined") LoadingManager.hide();
  } catch (error: any) {
    if (typeof LoadingManager !== "undefined") {
      LoadingManager.setError(error.message);
    }
    console.error("[Manga Reader Critical Error]:", error);
  }
});

/**
 * Parses the "v" query param into manga ID + volume/chapter.
 * Example input: "theFaceOfMyBrotherThatOnlyIKnow+v1_ch1"
 */
function parseMangaIdentifier(rawV: string): {
  mangaID: string;
  volume: number | null;
  chapter: number;
} {
  const decodedV = decodeURIComponent(rawV).replace(
    READER_PAGE_CONFIG.ID_SEPARATOR_REGEX,
    READER_PAGE_CONFIG.ID_SEPARATOR_REPLACEMENT,
  );
  const parts = decodedV.split("+");
  const mangaID = parts[0];

  let volume: number | null = null;
  let chapter = READER_PAGE_CONFIG.DEFAULT_CHAPTER;

  if (parts[1]) {
    const vMatch = parts[1].match(READER_PAGE_CONFIG.VOLUME_MATCH_REGEX);
    const chMatch = parts[1].match(READER_PAGE_CONFIG.CHAPTER_MATCH_REGEX);
    if (vMatch) volume = parseInt(vMatch[1]);
    if (chMatch) chapter = parseFloat(chMatch[1]);
  }

  return { mangaID, volume, chapter };
}

/**
 * Checks if the specified volume and chapter exist by fetching 'information.json'.
 */
async function chapterExists(
  vNum: number | null,
  chNum: number,
): Promise<boolean> {
  if (chNum <= 0) return false;
  if (!mangaRootSRC) return false;

  const chapterPath = buildChapterPath(mangaRootSRC, vNum, chNum);
  const info = await fetchJson(
    `${chapterPath}/${READER_PAGE_CONFIG.INFO_FILE_NAME}`,
  );
  return info !== null;
}

/**
 * Finds the LAST chapter of a given Volume when switching backward (e.g. returns 4 if Vol 1 ends at Ch 4).
 */
async function getLastChapterOfVolume(vNum: number): Promise<number> {
  let ch = 1;
  while (await chapterExists(vNum, ch + 1)) {
    ch++;
  }
  return ch;
}

/**
 * LIGHTWEIGHT CHAPTER SWITCHER
 */
async function SwitchChapter(vNum: number, chNum: number) {
  if (vNum === currentVolume_Num && chNum === currentChapter_Num) return;

  debugHandler(
    "L",
    `Switching Chapter: Vol ${vNum} Ch ${chNum}`,
    "readerHandler.ts",
  );
  if (typeof LoadingManager !== "undefined") {
    LoadingManager.show(READER_PAGE_CONFIG.LOADING_MESSAGE_SWITCHING);
  }

  currentVolume_Num = vNum;
  currentChapter_Num = chNum;

  updateURLForChapter(vNum, chNum);

  // Reload chapter images and metadata
  await LoadChapterData(mangaRootSRC);

  // Update sidebar / active card selection
  setActiveCard(vNum, chNum);

  if (typeof LoadingManager !== "undefined") LoadingManager.hide();
}
(window as any).SwitchChapter = SwitchChapter;

/**
 * PREVIOUS CHAPTER LOGIC
 */
async function PreviousChapter() {
  const vol = currentVolume_Num;

  // CASE 1: Previous chapter exists within the same volume (e.g. Vol 1 Ch 2 -> Vol 1 Ch 1)
  if (currentChapter_Num > 1) {
    const hasPrevInVol = await chapterExists(vol, currentChapter_Num - 1);

    if (hasPrevInVol) {
      debugHandler(
        "L",
        `Navigating to previous chapter: Ch ${currentChapter_Num - 1}`,
        "readerHandler.ts",
      );
      await SwitchChapter(vol ?? 1, currentChapter_Num - 1);
      return;
    }
  }

  // CASE 2: Switch to previous volume (e.g. Vol 2 Ch 1 -> Vol 1's Last Chapter)
  if (vol !== null && vol > 1) {
    const prevVol = vol - 1;
    const hasPrevVol = await chapterExists(prevVol, 1);

    if (hasPrevVol) {
      const lastChOfPrevVol = await getLastChapterOfVolume(prevVol);
      debugHandler(
        "L",
        `Navigating to previous volume's last chapter: Vol ${prevVol} Ch ${lastChOfPrevVol}`,
        "readerHandler.ts",
      );
      await SwitchChapter(prevVol, lastChOfPrevVol);
      return;
    }
  }

  // CASE 3: No previous chapter or volume found
  debugHandler(
    "W",
    `Previous chapter or volume not found. You are at the beginning! (Vol ${vol} Ch ${currentChapter_Num})`,
    "readerHandler.ts",
  );
}
(window as any).PreviousChapter = PreviousChapter;
(window as any).prevChapter = PreviousChapter;

/**
 * NEXT CHAPTER LOGIC
 */
async function NextChapter() {
  const vol = currentVolume_Num;

  // CASE 1: Next chapter exists within the same volume (e.g. Vol 1 Ch 1 -> Vol 1 Ch 2)
  const hasNextInVol = await chapterExists(vol, currentChapter_Num + 1);

  if (hasNextInVol) {
    debugHandler(
      "L",
      `Navigating to next chapter: Ch ${currentChapter_Num + 1}`,
      "readerHandler.ts",
    );
    await SwitchChapter(vol ?? 1, currentChapter_Num + 1);
    return;
  }

  // CASE 2: First chapter of next volume exists (e.g. Vol 1 finished -> Vol 2 Ch 1)
  if (vol !== null) {
    const nextVol = vol + 1;
    const hasNextVolFirstCh = await chapterExists(nextVol, 1);

    if (hasNextVolFirstCh) {
      debugHandler(
        "L",
        `Navigating to next volume: Vol ${nextVol} Ch 1`,
        "readerHandler.ts",
      );
      await SwitchChapter(nextVol, 1);
      return;
    }
  }

  // CASE 3: No next chapter or volume found
  debugHandler(
    "W",
    `Next chapter or volume not found. You are at the end! (Vol ${vol} Ch ${currentChapter_Num})`,
    "readerHandler.ts",
  );
}
(window as any).NextChapter = NextChapter;
(window as any).nextChapter = NextChapter;

/**
 * Updates browser URL for chapter navigation without reload.
 */
function updateURLForChapter(vNum: number, chNum: number) {
  const params = new URLSearchParams(window.location.search);
  const baseID = params
    .get(READER_PAGE_CONFIG.QUERY_PARAM_MANGA_ID)
    ?.split(READER_PAGE_CONFIG.ID_SPLIT_REGEX)[0];
  const newURL = `${window.location.pathname}?v=${baseID}+v${vNum}_ch${chNum}`;
  window.history.pushState(null, "", newURL);
}

/**
 * CHAPTER SETUP & PAGES RENDER
 */
async function LoadChapterData(root: string) {
  const chapterPath = buildChapterPath(
    root,
    currentVolume_Num,
    currentChapter_Num,
  );

  try {
    // Fetch chapter title metadata (if available)
    const data: ChapterInfo | null = await fetchJson(
      `${chapterPath}/${READER_PAGE_CONFIG.INFO_FILE_NAME}`,
    );

    UpdateReaderPage(
      data?.title || READER_PAGE_CONFIG.DEFAULT_MANGA_TITLE,
      data?.chapterName || `Chapter ${currentChapter_Num}`,
      data?.desc || "",
      data?.author || "Unknown",
      data?.uploader || "Unknown",
      `${chapterPath}/uploader.webp` || "",
    );

    // Trigger image rendering function inside readerPages.ts
    await renderChapterPages(chapterPath);
  } catch (e) {
    console.error("[Reader Error]:", e);
    if (typeof LoadingManager !== "undefined") {
      LoadingManager.setError(READER_PAGE_CONFIG.ERROR_CHAPTER_LOAD_FAILED);
    }
  }
}

/**
 * Builds the on-disk/URL path for a given volume/chapter.
 */
function buildChapterPath(
  root: string,
  volume: number | null,
  chapter: number,
): string {
  const cleanRoot = root.replace(/\/+$/, "");
  if (volume !== null && volume > 0) {
    return `${cleanRoot}/volume_${volume}/ch_${chapter}`;
  }
  return `${cleanRoot}/ch_${chapter}`;
}

/**
 * Updates titleBar.astro DOM elementsIL
 */
function UpdateReaderPage(
  mangaTitle: string,
  chapterTitle: string,
  chapterDescription: string,
  chapterAuthorTitle: string,
  chapterUploaderTitle: string,
  chapterUploaderIMGSrc: string,
) {
  const ids = READER_PAGE_CONFIG.ELEMENT_IDS;
  const mangaEl = document.getElementById(ids.mangaTitle);
  const chapterEl = document.getElementById(ids.chapterTitle);
  const chapterDescEl = document.getElementById(ids.chapterDesc);
  const mangaAuthorEl = document.getElementById(ids.mangaAuthor);
  const chapterUploaderEl = document.getElementById(ids.chapterUploader);
  const chapterUploaderIMGEl = document.getElementById(
    ids.chapterUploaderIMG,
  ) as HTMLImageElement;

  if (mangaEl) mangaEl.innerText = mangaTitle;
  if (chapterEl) chapterEl.innerText = chapterTitle;
  if (chapterDescEl) chapterDescEl.innerText = chapterDescription;
  if (mangaAuthorEl) mangaAuthorEl.innerText = chapterAuthorTitle;
  if (chapterUploaderEl) chapterUploaderEl.innerText = chapterUploaderTitle;
  if (chapterUploaderIMGEl) chapterUploaderIMGEl.src = chapterUploaderIMGSrc;
  console.log(chapterUploaderIMGSrc);
}

/**
 * HELPERS
 */
async function fetchJson(url: string) {
  try {
    const r = await fetch(url);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
