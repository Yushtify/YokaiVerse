/**
 * Watch Page - Modular Season & Episode Renderer
 * listSeries.ts modülü entegre edilerek optimize edildi.
 * [DEBUG: playlistHandler.ts]
 */

import { listSeries, setActiveCard } from "../listSeries.ts";
import { isNsfwEnabled, isSeriesNsfw } from "../nsfwChecker.ts";

// --- PLAYLIST_CONFIGURATION ---
// All tunable values live here. Change behavior without touching logic below.
const PLAYLIST_CONFIG = {
  // Route this handler is allowed to run on
  WATCH_PAGE_PATH: "/watch",

  // Data sources
  ANIME_ID_MAP_URL: "/animeIDs.json",
  INFO_FILE_NAME: "information.json",
  COVER_FILE_NAME: "cover.webp",
  UPLOADER_IMG_FILE_NAME: "uploader.webp",
  VIDEO_FOLDER_NAME: "video",
  FALLBACK_VIDEO_FILE_NAME: "1080p.webm",

  // URL parsing
  QUERY_PARAM_VIDEO_ID: "v",
  ID_SEPARATOR_REGEX: /\s+/g,
  ID_SEPARATOR_REPLACEMENT: "+",
  SEASON_MATCH_REGEX: /s(\d+)/,
  EPISODE_MATCH_REGEX: /ep(\d+)/,
  ID_SPLIT_REGEX: /[+ ]/,

  // Default season/episode when not specified in URL
  DEFAULT_SEASON: 1,
  DEFAULT_EPISODE: 1,

  // Player storage keys
  PLAYER_STORAGE_KEY: "epPlayerStorage",
  DEFAULT_QUALITY_MODE: "auto",

  // DOM element IDs
  ELEMENT_IDS: {
    animeTitle: "animeTitle",
    episodeTitle: "episodeTitle",
    pageEpTitle: "pageEpTitle",
    pageEpDesc: "pageEpDesc",
    animeAuthor: "animeAuthor",
    episodeUploader: "episodeUploader",
    episodeUploaderIMG: "episodeUploaderIMG",
    episodeViews: "episodeViews",
    episodeUpload: "episodeUpload",
  },

  // Text templates
  LOADING_MESSAGE_INITIAL: "Loading...",
  LOADING_MESSAGE_SWITCHING: "Switching Episode...",
  ERROR_NO_VIDEO_ID:
    "No Video ID found in URL, if this is a mistake on ourside report to suport.",
  ERROR_DB_UNREACHABLE: "Database unreachable.",
  ERROR_SERIES_NOT_FOUND: "Series not found.",
  ERROR_NSFW_DISABLED:
    "This anime is unavailable because adult content is disabled in your settings.",
  ERROR_EPISODE_LOAD_FAILED: "Failed to load episode, try again later.",
  ERROR_EPISODE_DATA_MISSING: "Episode data missing.",
  DEFAULT_ANIME_TITLE: "Untitled Anime",
  DEFAULT_EPISODE_NAME: "Untitled Episdode",
  DEFAULT_DESC: "Error while fetching.",
  DEFAULT_STUDIO: "Unknown Studio",
  DEFAULT_UPLOADER: "Unknown Uploader",
  UPLOADER_PREFIX: "@",
} as const;

// --- TYPE DECLARATIONS ---
interface LoadingManagerInterface {
  show: (message?: string) => void;
  hide: () => void;
  setError: (errorMessage: string) => void;
}

interface EpisodeInfo {
  title?: string;
  episodeName?: string;
  desc?: string;
  author?: string;
  uploader?: string;
}

interface PlayerStorageSettings {
  quality?: string;
  autoPlay?: boolean;
}

declare const LoadingManager: LoadingManagerInterface;
declare function addListeners(): void;
declare const episodePlayer: HTMLVideoElement;

// --- GLOBAL STATE ---
let videoRootSRC: string;
let currentSeason_Num: number = PLAYLIST_CONFIG.DEFAULT_SEASON;
let currentEpisode_Num: number = PLAYLIST_CONFIG.DEFAULT_EPISODE;

/**
 * MAIN INITIALIZATION
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (window.location.pathname !== PLAYLIST_CONFIG.WATCH_PAGE_PATH) return;

  console.log("[Init]: Watch page detected.");
  LoadingManager.show(PLAYLIST_CONFIG.LOADING_MESSAGE_INITIAL);

  // External listeners (play/pause/volume etc.)
  if (typeof addListeners === "function") addListeners();

  const params = new URLSearchParams(window.location.search);
  const rawV = params.get(PLAYLIST_CONFIG.QUERY_PARAM_VIDEO_ID);

  if (!rawV) {
    LoadingManager.setError(PLAYLIST_CONFIG.ERROR_NO_VIDEO_ID);
    return;
  }

  const { videoID, season, episode } = parseVideoIdentifier(rawV);
  currentSeason_Num = season;
  currentEpisode_Num = episode;

  try {
    const idMap = await fetchJson(PLAYLIST_CONFIG.ANIME_ID_MAP_URL);
    if (!idMap) throw new Error(PLAYLIST_CONFIG.ERROR_DB_UNREACHABLE);

    videoRootSRC = idMap[videoID];

    if (!videoRootSRC) throw new Error(PLAYLIST_CONFIG.ERROR_SERIES_NOT_FOUND);

    // Series-level Adult Content gate: blocks playback entirely if the series is
    // flagged Adult Content and the user has adult content disabled.
    if ((await isSeriesNsfw(videoRootSRC)) && !isNsfwEnabled()) {
      throw new Error(PLAYLIST_CONFIG.ERROR_NSFW_DISABLED);
    }

    // 1. Initial Player Setup
    await GetTheVideos(videoRootSRC);

    // 2. Build Sidebar Playlist using the Module
    // Modül tüm döngü ve DOM klonlama işini devralıyor
    await listSeries({
      root: videoRootSRC,
      activeSeason: currentSeason_Num,
      activeEpisode: currentEpisode_Num,
      onEpisodeClick: (s, e) => SwitchEpisode(s, e),
    });

    LoadingManager.hide();

    if (episodePlayer) {
      episodePlayer.play().catch(() => console.warn("Autoplay blocked."));
    }
  } catch (error: any) {
    LoadingManager.setError(error.message);
    console.error("[Critical Error]:", error);
  }
});

/**
 * Parses the "v" query param into video ID + season/episode.
 * Example input: "oshiNoKo+s1_ep1"
 */
function parseVideoIdentifier(rawV: string): {
  videoID: string;
  season: number;
  episode: number;
} {
  const decodedV = decodeURIComponent(rawV).replace(
    PLAYLIST_CONFIG.ID_SEPARATOR_REGEX,
    PLAYLIST_CONFIG.ID_SEPARATOR_REPLACEMENT,
  );
  const parts = decodedV.split("+");
  const videoID = parts[0];

  let season = PLAYLIST_CONFIG.DEFAULT_SEASON;
  let episode = PLAYLIST_CONFIG.DEFAULT_EPISODE;

  if (parts[1]) {
    const sMatch = parts[1].match(PLAYLIST_CONFIG.SEASON_MATCH_REGEX);
    const eMatch = parts[1].match(PLAYLIST_CONFIG.EPISODE_MATCH_REGEX);
    if (sMatch) season = parseInt(sMatch[1]);
    if (eMatch) episode = parseInt(eMatch[1]);
  }

  return { videoID, season, episode };
}

/**
 * LIGHTWEIGHT EPISODE SWITCHER
 */
async function SwitchEpisode(sNum: number, epNum: number) {
  if (sNum === currentSeason_Num && epNum === currentEpisode_Num) return;

  console.log(`[Switch]: Moving to S${sNum} E${epNum}`);
  LoadingManager.show(PLAYLIST_CONFIG.LOADING_MESSAGE_SWITCHING);

  currentSeason_Num = sNum;
  currentEpisode_Num = epNum;

  updateURLForEpisode(sNum, epNum);

  // Update Player Content
  await GetTheVideos(videoRootSRC);

  // Update Sidebar UI Highlights via Module Helper
  setActiveCard(sNum, epNum);

  LoadingManager.hide();
  if (episodePlayer) episodePlayer.play().catch(() => {});
}
(window as any).SwitchEpisode = SwitchEpisode;

/**
 * Updates the browser URL to reflect the current season/episode without reloading.
 */
function updateURLForEpisode(sNum: number, epNum: number) {
  const params = new URLSearchParams(window.location.search);
  const baseID = params
    .get(PLAYLIST_CONFIG.QUERY_PARAM_VIDEO_ID)
    ?.split(PLAYLIST_CONFIG.ID_SPLIT_REGEX)[0];
  const newURL = `${window.location.pathname}?v=${baseID}+s${sNum}_ep${epNum}`;
  window.history.pushState(null, "", newURL);
}

/**
 * PLAYER SETUP
 */
async function GetTheVideos(root: string) {
  // Slash safety check
  const cleanRoot = root.replace(/\/+$/, "");
  const epPath = buildEpisodePath(
    cleanRoot,
    currentSeason_Num,
    currentEpisode_Num,
  );

  try {
    const data: EpisodeInfo | null = await fetchJson(
      `${epPath}/${PLAYLIST_CONFIG.INFO_FILE_NAME}`,
    );
    if (!data) throw new Error(PLAYLIST_CONFIG.ERROR_EPISODE_DATA_MISSING);

    LoadVideoData(
      data.title || PLAYLIST_CONFIG.DEFAULT_ANIME_TITLE,
      data.episodeName || PLAYLIST_CONFIG.DEFAULT_EPISODE_NAME,
      data.desc || PLAYLIST_CONFIG.DEFAULT_DESC,
      data.author || PLAYLIST_CONFIG.DEFAULT_STUDIO,
      data.uploader || PLAYLIST_CONFIG.DEFAULT_UPLOADER,
      `${epPath}/${PLAYLIST_CONFIG.UPLOADER_IMG_FILE_NAME}`,
    );

    if (episodePlayer) {
      // Renditions live inside a "video" folder generated by the rendition
      // build script as per-quality files (e.g. 144p.webm, 1080p.webm), not a
      // single "video.webm". We point the player at the base folder and let
      // setQualityMode resolve the actual quality file.
      const videoBasePath = `${epPath}/${PLAYLIST_CONFIG.VIDEO_FOLDER_NAME}`;
      episodePlayer.setAttribute("data-video-base", videoBasePath);

      episodePlayer.poster = `${epPath}/${PLAYLIST_CONFIG.COVER_FILE_NAME}`;
      episodePlayer.onended = () => (window as any).NextEpisode(false);

      // Read the user's last selected quality (or default to "auto").
      const settings = getPlayerStorageSettings();
      const savedMode =
        settings.quality || PLAYLIST_CONFIG.DEFAULT_QUALITY_MODE;

      // Delegate to playerControls.ts's setQualityMode, which resolves the
      // correct rendition path and triggers .load().
      if (typeof (window as any).setQualityMode === "function") {
        (window as any).setQualityMode(savedMode);
      } else {
        // Fallback if playerControls.ts hasn't loaded yet.
        episodePlayer.src = `${videoBasePath}/${PLAYLIST_CONFIG.FALLBACK_VIDEO_FILE_NAME}`;
        episodePlayer.load();
      }
    }
  } catch (e) {
    console.error("[Player Error]:", e);
    LoadingManager.setError(PLAYLIST_CONFIG.ERROR_EPISODE_LOAD_FAILED);
  }
}

/**
 * Builds the on-disk/URL path for a given season/episode.
 */
function buildEpisodePath(
  root: string,
  season: number,
  episode: number,
): string {
  return `${root}/season_${season}/ep_${episode}`;
}

/**
 * Reads and parses the persisted player settings (session takes priority over local).
 */
function getPlayerStorageSettings(): PlayerStorageSettings {
  return JSON.parse(
    sessionStorage.getItem(PLAYLIST_CONFIG.PLAYER_STORAGE_KEY) ??
      localStorage.getItem(PLAYLIST_CONFIG.PLAYER_STORAGE_KEY) ??
      "{}",
  );
}

/**
 * Checks whether an episode exists by probing its information.json.
 */
async function episodeExists(
  season: number,
  episode: number,
): Promise<boolean> {
  const path = buildEpisodePath(videoRootSRC, season, episode);
  const response = await fetch(`${path}/${PLAYLIST_CONFIG.INFO_FILE_NAME}`);
  return response.ok;
}

/**
 * PREVIOUS EPISODE LOGIC
 */
async function PreviousEpisode() {
  const hasPrevInSeason = await episodeExists(
    currentSeason_Num,
    currentEpisode_Num - 1,
  );

  if (hasPrevInSeason) {
    await SwitchEpisode(currentSeason_Num, currentEpisode_Num - 1);
    return;
  }

  // NOTE: preserved original (likely buggy) fallback behavior:
  // checks NEXT season's ep_1 but switches to PREVIOUS season.
  const hasNextSeasonFirstEp = await episodeExists(currentSeason_Num + 1, 1);
  if (hasNextSeasonFirstEp) {
    await SwitchEpisode(currentSeason_Num - 1, 1);
  }
}
(window as any).PreviousEpisode = PreviousEpisode;

/**
 * NEXT EPISODE LOGIC
 */
async function NextEpisode(forceNext: boolean) {
  const settings = getPlayerStorageSettings();

  if (!forceNext && !settings.autoPlay) return;

  const hasNextInSeason = await episodeExists(
    currentSeason_Num,
    currentEpisode_Num + 1,
  );

  if (hasNextInSeason) {
    await SwitchEpisode(currentSeason_Num, currentEpisode_Num + 1);
    return;
  }

  const hasNextSeasonFirstEp = await episodeExists(currentSeason_Num + 1, 1);
  if (hasNextSeasonFirstEp) {
    await SwitchEpisode(currentSeason_Num + 1, 1);
  }
}
(window as any).NextEpisode = NextEpisode;

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

function LoadVideoData(
  Title: string,
  EpisodeName: string,
  Desc: string,
  UploaderStudio: string,
  Uploader: string,
  Img: string,
) {
  const ids = PLAYLIST_CONFIG.ELEMENT_IDS;
  const els = {
    epAnimeTitle: document.getElementById(
      ids.animeTitle,
    ) as HTMLParagraphElement,
    epTitle: document.getElementById(ids.episodeTitle) as HTMLParagraphElement,
    pTitle: document.getElementById(ids.pageEpTitle) as HTMLParagraphElement,
    pDesc: document.getElementById(ids.pageEpDesc) as HTMLParagraphElement,
    pStudioUploader: document.getElementById(
      ids.animeAuthor,
    ) as HTMLParagraphElement,
    pUploader: document.getElementById(
      ids.episodeUploader,
    ) as HTMLParagraphElement,
    pImg: document.getElementById(ids.episodeUploaderIMG) as HTMLImageElement,
    pViews: document.getElementById(ids.episodeViews) as HTMLParagraphElement,
    pDate: document.getElementById(ids.episodeUpload) as HTMLParagraphElement,
  };
  const fullTitle = `${Title} - ${EpisodeName}`;

  if (els.epAnimeTitle) els.epAnimeTitle.innerText = Title;
  if (els.epTitle) els.epTitle.innerText = EpisodeName;
  if (els.pTitle) els.pTitle.innerText = fullTitle;
  if (els.pDesc) els.pDesc.innerText = Desc;
  if (els.pStudioUploader) els.pStudioUploader.innerText = UploaderStudio;
  if (els.pUploader)
    els.pUploader.innerText = `${PLAYLIST_CONFIG.UPLOADER_PREFIX}${Uploader}`;
  if (els.pImg) els.pImg.src = Img;
}
