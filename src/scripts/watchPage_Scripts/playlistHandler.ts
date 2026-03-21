/**
 * Watch Page - Modular Season & Episode Renderer
 * listAnime.ts modülü entegre edilerek optimize edildi.
 */

import { listAnime, setActiveCard } from "../listAnime.ts";

// --- TYPE DECLARATIONS ---
interface LoadingManagerInterface {
  show: (message?: string) => void;
  hide: () => void;
  setError: (errorMessage: string) => void;
}

declare const LoadingManager: LoadingManagerInterface;
declare function addListeners(): void;
declare const videoPlayer: HTMLVideoElement;

// --- CONFIGURATION & GLOBAL STATE ---
let videoRootSRC: string;
let currentSeason_Num: number = 1;
let currentEpisode_Num: number = 1;

/**
 * MAIN INITIALIZATION
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (window.location.pathname !== "/watch") return;

  console.log("[Init]: Watch page detected.");
  LoadingManager.show("Loading Series...");

  // External listeners (play/pause/volume etc.)
  if (typeof addListeners === "function") addListeners();

  const params = new URLSearchParams(window.location.search);
  const rawV = params.get("v");

  if (!rawV) {
    LoadingManager.setError("No Video ID found in URL.");
    return;
  }

  // Parse ID and detect Season/Episode (e.g., "oshiNoKo+s1_ep1")
  const decodedV = decodeURIComponent(rawV).replace(/\s+/g, "+");
  const parts = decodedV.split("+");
  const videoID = parts[0];

  if (parts[1]) {
    const sMatch = parts[1].match(/s(\d+)/);
    const eMatch = parts[1].match(/ep(\d+)/);
    if (sMatch) currentSeason_Num = parseInt(sMatch[1]);
    if (eMatch) currentEpisode_Num = parseInt(eMatch[1]);
  }

  try {
    const response = await fetch("/animeIDs.json");
    if (!response.ok) throw new Error("Database unreachable.");

    const idMap = await response.json();
    videoRootSRC = idMap[videoID];

    if (videoRootSRC) {
      // 1. Initial Player Setup
      await GetTheVideos(videoRootSRC);

      // 2. Build Sidebar Playlist using the Module
      // Modül tüm döngü ve DOM klonlama işini devralıyor
      await listAnime({
        root: videoRootSRC,
        activeSeason: currentSeason_Num,
        activeEpisode: currentEpisode_Num,
        onEpisodeClick: (s, e) => SwitchEpisode(s, e),
      });

      LoadingManager.hide();

      if (videoPlayer) {
        videoPlayer.play().catch(() => console.warn("Autoplay blocked."));
      }
    } else {
      throw new Error("Series not found.");
    }
  } catch (error: any) {
    LoadingManager.setError(error.message);
    console.error("[Critical Error]:", error);
  }
});

/**
 * LIGHTWEIGHT EPISODE SWITCHER
 */
async function SwitchEpisode(sNum: number, epNum: number) {
  if (sNum === currentSeason_Num && epNum === currentEpisode_Num) return;

  console.log(`[Switch]: Moving to S${sNum} E${epNum}`);
  LoadingManager.show("Switching Episode...");

  currentSeason_Num = sNum;
  currentEpisode_Num = epNum;

  // Update URL without reloading
  const params = new URLSearchParams(window.location.search);
  const baseID = params.get("v")?.split(/[+ ]/)[0];
  const newURL = `${window.location.pathname}?v=${baseID}+s${sNum}_ep${epNum}`;
  window.history.pushState(null, "", newURL);

  // Update Player Content
  await GetTheVideos(videoRootSRC);

  // Update Sidebar UI Highlights via Module Helper
  setActiveCard(sNum, epNum);

  LoadingManager.hide();
  if (videoPlayer) videoPlayer.play().catch(() => {});
}
(window as any).SwitchEpisode = SwitchEpisode;

/**
 * PLAYER SETUP
 */
async function GetTheVideos(root: string) {
  // Slash safety check
  const cleanRoot = root.replace(/\/+$/, "");
  const epPath = `${cleanRoot}/season_${currentSeason_Num}/ep_${currentEpisode_Num}`;

  try {
    const data = await fetchJson(`${epPath}/information.json`);
    if (!data) throw new Error("Episode data missing.");

    const vType = data.videoType.startsWith(".")
      ? data.videoType
      : `.${data.videoType}`;
    const videoSrc = `${epPath}/video${vType}`;

    LoadVideoData(
      data.title || "Untitled Episode",
      data.episodeName || `S${currentSeason_Num} E${currentEpisode_Num}`,
      data.desc || "Error while fetching.",
      data.author || "Unknown Studio",
      data.uploader || "Unknown Uploader",
      `${epPath}/uploader.webp`,
    );

    if (videoPlayer) {
      videoPlayer.src = videoSrc;
      videoPlayer.poster = `${epPath}/cover.webp`;
      videoPlayer.onended = () => (window as any).NextEpisode();
    }
  } catch (e) {
    console.error("[Player Error]:", e);
    LoadingManager.setError("Failed to load episode.");
  }
}

/**
 * NEXT EPISODE LOGIC
 */
async function NextEpisode() {
  // Check next episode in current season
  const nextEpCheck = await fetch(
    `${videoRootSRC}/season_${currentSeason_Num}/ep_${currentEpisode_Num + 1}/information.json`,
  );

  if (nextEpCheck.ok) {
    await SwitchEpisode(currentSeason_Num, currentEpisode_Num + 1);
  } else {
    // Check first episode of next season
    const nextSeasonCheck = await fetch(
      `${videoRootSRC}/season_${currentSeason_Num + 1}/ep_1/information.json`,
    );
    if (nextSeasonCheck.ok) {
      await SwitchEpisode(currentSeason_Num + 1, 1);
    }
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
  const els = {
    vTitle: document.getElementById("videoTitle") as HTMLParagraphElement,
    pTitle: document.getElementById("pageVideoTitle") as HTMLParagraphElement,
    pDesc: document.getElementById("pageVideoDesc") as HTMLParagraphElement,
    pStudioUploader: document.getElementById(
      "pageVideoStudio",
    ) as HTMLParagraphElement,
    pUploader: document.getElementById(
      "pageVideoUploader",
    ) as HTMLParagraphElement,
    pImg: document.getElementById("pageVideoUploaderIMG") as HTMLImageElement,
    pViews: document.getElementById("pageVideoViews") as HTMLParagraphElement,
    pDate: document.getElementById("pageVideoUpload") as HTMLParagraphElement,
  };
  const fullTitle = `${Title} - ${EpisodeName}`;
  if (els.vTitle) els.vTitle.innerText = fullTitle;
  if (els.pTitle) els.pTitle.innerText = fullTitle;
  if (els.pDesc) els.pDesc.innerText = Desc;
  if (els.pStudioUploader)
    els.pStudioUploader.innerText = "By " + UploaderStudio;
  if (els.pUploader) els.pUploader.innerText = "Uploaded by @" + Uploader;
  if (els.pImg) els.pImg.src = Img;
}
