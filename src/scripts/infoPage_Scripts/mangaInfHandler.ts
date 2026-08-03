import { listSeries } from "../listSeries.ts"; // Import listSeries module
import { isNsfwEnabled, isSeriesNsfw } from "../nsfwChecker.ts";

/**
 * mangaInfHandler.ts
 * Info Page - Debug Enabled Modular Renderer (Manga)
 * All DOM ids, file paths, and defaults live in CONFIG below — zero hardcoding.
 */

// --- GLOBAL TYPES DECLARATION ---
interface LoadingManagerInterface {
  show: (message?: string) => void;
  hide: () => void;
  setError: (errorMessage: string) => void;
}

declare const LoadingManager: LoadingManagerInterface;
declare global {
  interface Window {
    findManga: (id: string, unitIndex: number, subUnitIndex: number) => void;
  }
}

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const CONFIG = {
  route: "/info/manga",
  urlParam: "v",
  paths: {
    idMap: "/mangaIDs.json",
    infoFile: "information.json",
    bannerFile: "banner.webp",
  },
  selectors: {
    banner: "BannerImage",
    title: "contentTitle",
    desc: "contentDescText",
    views: "contentViews_Text",
    rating: "contentRating_Text",
    author: "contentAuthorStudio_Text",
    date: "releaseDate_Text",
    ageRating: "contentAgeRating_Text",
    categoryList: "Category_List",
    categoryTemplate: "Category_PlaceHolder",
    categoryTemplateText: "Category_PlaceHolderText",
  },
  defaults: {
    title: "Untitled Series",
    desc: "No description available.",
    views: "0",
    rating: "Not Rated",
    author: "Unknown",
    age: "Unknown",
    date: "TBA",
  },
  // Global window function invoked when a sub-unit (chapter) card is clicked.
  onSubUnitClick: (id: string, unitIndex: number, subUnitIndex: number) => {
    window.findManga(id, unitIndex, subUnitIndex);
  },
} as const;

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface SeriesInfo {
  title?: string;
  desc?: string;
  author?: string;
  ageRestriction?: string;
  age?: string;
  series?: { anime?: boolean; manga?: boolean; movie?: boolean };
  meta?: {
    views?: string;
    rating?: string;
    uploadDate?: string;
    tags?: Record<string, string>;
  };
}

let seriesRootSrc: string;

// ─── MAIN INITIALIZATION ─────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  if (window.location.pathname !== CONFIG.route) return;

  console.log("[Init]: Info page detected. Starting process...");
  LoadingManager.show("Loading...");

  const params = new URLSearchParams(window.location.search);
  const seriesID = params.get(CONFIG.urlParam)?.split(/[+ ]/)[0];

  if (!seriesID) {
    console.error("[Init Error]: No ID found in URL parameters.");
    return LoadingManager.setError(
      "No ID provided in the URL, if this is a mistake report this to support.",
    );
  }

  console.log("[Init]: Searching for ID: " + seriesID);
  await LoadModularInfo(seriesID);
});

// ─── CORE LOADER ─────────────────────────────────────────────────────────────

/**
 * Loads main series information and starts hierarchical listing
 */
async function LoadModularInfo(seriesID: string): Promise<void> {
  try {
    console.log(`[Fetch]: Requesting ${CONFIG.paths.idMap}...`);
    const response = await fetch(CONFIG.paths.idMap);
    if (!response.ok) throw new Error("Could not fetch ID mapping file.");

    const idMap = await response.json();
    seriesRootSrc = idMap[seriesID];

    if (!seriesRootSrc) {
      console.warn("[Data Error]: ID " + seriesID + " not found in mapping.");
      throw new Error("Series " + seriesID + " not found in database.");
    }

    console.log("[Data Found]: Root path is " + seriesRootSrc);

    console.log(`[Fetch]: Requesting series ${CONFIG.paths.infoFile}...`);
    const infoRes = await fetch(`${seriesRootSrc}/${CONFIG.paths.infoFile}`);
    if (!infoRes.ok)
      throw new Error("Main series information file is missing.");

    const data: SeriesInfo = await infoRes.json();
    console.log("[Data]: Series metadata loaded successfully.", data);

    // Series-level Adult Content gate: uses the already-fetched `data` as the
    // pre-fetched info so isSeriesNsfw doesn't re-fetch information.json.
    if ((await isSeriesNsfw(seriesRootSrc, data)) && !isNsfwEnabled()) {
      console.warn(
        `[Adult Content Gate]: Series ${seriesID} is flagged Adult Content and adult content is disabled.`,
      );
      return LoadingManager.setError(
        "This manga is unavailable because adult content is disabled in your settings.",
      );
    }

    const ageRestriction =
      data.ageRestriction ?? data.age ?? CONFIG.defaults.age;
    console.log(
      "[Data Debug]: ageRestriction extracted as:",
      ageRestriction,
      "| Raw data.ageRestriction:",
      data.ageRestriction,
    );

    LoadSeriesData(
      `${seriesRootSrc}/${CONFIG.paths.bannerFile}`,
      data.title || CONFIG.defaults.title,
      data.desc || CONFIG.defaults.desc,
      data.meta?.views || CONFIG.defaults.views,
      data.meta?.rating || CONFIG.defaults.rating,
      data.author || CONFIG.defaults.author,
      ageRestriction,
      data.meta?.uploadDate || CONFIG.defaults.date,
    );

    if (data.meta?.tags) {
      loadTagData(data.meta.tags);
    }

    console.log(
      "[Process]: Starting hierarchical Volume/Chapter scan via module...",
    );

    await listSeries({
      root: seriesRootSrc,
      // This file only ever runs on /info/manga, so the mode is already known —
      // pass it explicitly rather than letting listSeries guess it from
      // data.series, which may not be populated correctly/at all yet.
      mode: "manga",
      onEpisodeClick: (unitIndex, subUnitIndex) => {
        CONFIG.onSubUnitClick(seriesID, unitIndex, subUnitIndex);
      },
    });

    LoadingManager.hide();
  } catch (error: any) {
    LoadingManager.setError(
      error.message || "An unexpected error occurred, try again later.",
    );
    console.error("[Critical Error]:", error);
  }
}

// ─── UI LOADERS (Tags & Data) ────────────────────────────────────────────────

function loadTagData(tags: Record<string, string>): void {
  const container = document.getElementById(CONFIG.selectors.categoryList);
  const template = document.getElementById(
    CONFIG.selectors.categoryTemplate,
  ) as HTMLTemplateElement | null;
  if (!container || !template) return;

  container.textContent = "";
  Object.values(tags).forEach((tagName) => {
    if (!tagName) return;
    const clone = template.content.cloneNode(true) as HTMLElement;
    const txt = clone.querySelector<HTMLElement>(
      `#${CONFIG.selectors.categoryTemplateText}`,
    );
    if (txt) txt.innerText = tagName;
    container.appendChild(clone);
  });
}

function LoadSeriesData(
  banner: string,
  title: string,
  desc: string,
  contentViews: string,
  contentRating: string,
  author: string,
  age: string,
  date: string,
): void {
  const s = CONFIG.selectors;

  const bannerImg = document.getElementById(
    s.banner,
  ) as HTMLImageElement | null;
  const titleTxt = document.getElementById(s.title);
  const descTxt = document.getElementById(s.desc);
  const viewsTxt = document.getElementById(s.views);
  const ratingTxt = document.getElementById(s.rating);
  const authorTxt = document.getElementById(s.author);
  const dateTxt = document.getElementById(s.date);
  const ageRatingTxt = document.getElementById(s.ageRating);

  if (bannerImg) bannerImg.src = banner;
  if (titleTxt) titleTxt.innerText = title;
  if (descTxt) descTxt.innerText = desc;
  if (viewsTxt) viewsTxt.innerText = contentViews;
  if (ratingTxt) ratingTxt.innerText = contentRating;
  if (authorTxt) authorTxt.innerText = author;
  if (dateTxt) dateTxt.innerText = date;
  if (ageRatingTxt) ageRatingTxt.innerText = age;
}
