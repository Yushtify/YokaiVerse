/**
 * TYPE DECLARATIONS
 */
interface LoadingManagerInterface {
  show: (message?: string) => void;
  hide: () => void;
  setError: (errorMessage: string) => void;
}

declare const LoadingManager: LoadingManagerInterface;
declare function addListeners(): void;

// --- CONFIGURATION & GLOBAL STATE ---
const MAX_CONCURRENT_VIDEOS = 10;
let videoRootSRC: string;
const slash = "/";
let currentEpisode: string = slash + "ep_1";
let currentEpisode_Num: number = 1;

/**
 * EXTERNAL NAVIGATION HANDLER
 * Call this to redirect to the watch page for a specific series and episode.
 * Example: findAnime('my-series+ep_5')
 */
function findAnime(videoID: string) {
  window.location.href = `/watch?v=${videoID}`;
}
(window as any).findAnime = findAnime;

/**
 * MAIN INITIALIZATION
 * Runs ONLY on page load.
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (window.location.pathname !== "/watch") return;

  LoadingManager.show("Loading Series...");
  addListeners();

  const params = new URLSearchParams(window.location.search);
  const rawV = params.get("v");

  if (!rawV) {
    LoadingManager.setError("No Video ID found in URL.");
    return;
  }

  const decodedV = decodeURIComponent(rawV);
  const parts = decodedV.includes("+")
    ? decodedV.split("+")
    : decodedV.split(" ");
  const videoID = parts[0];

  // Detect starting episode from URL
  if (parts[1] && parts[1].startsWith("ep_")) {
    currentEpisode = slash + parts[1];
    const num = parseInt(parts[1].replace("ep_", ""));
    if (!isNaN(num)) currentEpisode_Num = num;
  }

  try {
    const response = await fetch("/animeIDs.json");
    if (!response.ok) throw new Error("Database unreachable.");

    const idMap = await response.json();
    videoRootSRC = idMap[videoID];

    if (videoRootSRC) {
      // 1. Setup the initial video player data
      await GetTheVideos(videoRootSRC);

      // 2. Build the sidebar playlist ONCE
      LoadingManager.show("fetching video player and playlist");
      await ListEpisodesProgressive(videoRootSRC);

      // 3. Final Reveal
      LoadingManager.hide();

      if (videoPlayer) {
        videoPlayer.play().catch(() => console.warn("Autoplay blocked."));
      }
    } else {
      throw new Error(`Series "${videoID}" not found.`);
    }
  } catch (error: any) {
    LoadingManager.setError(error.message);
  }
});

/**
 * LIGHTWEIGHT EPISODE SWITCHER
 * This is the magic function. It updates the video without touching the sidebar list.
 */
async function SwitchEpisode(epNum: number) {
  if (epNum === currentEpisode_Num) return; // Already on this episode

  LoadingManager.show(`Switching to Episode ${epNum}...`);

  // 1. Update State
  currentEpisode_Num = epNum;
  currentEpisode = slash + "ep_" + epNum;

  // 2. Update Browser URL (without reloading page)
  const params = new URLSearchParams(window.location.search);
  const baseID = params.get("v")?.split(/[+ ]/)[0];
  window.history.pushState(
    null,
    "",
    `${window.location.pathname}?v=${baseID}+ep_${epNum}`,
  );

  // 3. Update Player and Metadata
  await GetTheVideos(videoRootSRC);

  // 4. Update Sidebar UI "Active" State
  document.querySelectorAll("[id^='episodeCard_']").forEach((card) => {
    card.classList.remove("border-2", "!border-Accent", "bg-Accent/10");
  });
  const activeCard = document.getElementById(`episodeCard_${epNum}`);
  if (activeCard) {
    activeCard.classList.add("border-2", "!border-Accent", "bg-Accent/10");
  }

  LoadingManager.hide();
  videoPlayer.play().catch(() => {});
}
(window as any).SwitchEpisode = SwitchEpisode;

/**
 * PROGRESSIVE SIDEBAR RENDERER
 * Runs once per series load.
 */
async function ListEpisodesProgressive(root: string): Promise<void> {
  const container = document.getElementById("episodeContainer");
  const template = document.getElementById(
    "videoCard_Template",
  ) as HTMLTemplateElement;
  const totalDurText = document.getElementById("contentDuration_Text");
  const episodeCountElement = document.getElementById("contentEpisodes_Text");

  if (!container || !template) return;
  container.innerHTML = "";

  let epIndex = 1;
  let searching = true;
  let totalSeconds = 0;
  const episodeList: { index: number; data: any }[] = [];

  // PHASE 1: Scan for all episodes
  while (searching) {
    try {
      const epRes = await fetch(`${root}/ep_${epIndex}/information.json`);
      if (!epRes.ok) {
        searching = false;
        break;
      }
      const data = await epRes.json();
      episodeList.push({ index: epIndex, data });
      epIndex++;
    } catch (e) {
      searching = false;
    }
  }

  if (episodeCountElement)
    episodeCountElement.innerText = `${episodeList.length} episodes`;

  // PHASE 2: Process Metadata
  for (let i = 0; i < episodeList.length; i += MAX_CONCURRENT_VIDEOS) {
    const batch = episodeList.slice(i, i + MAX_CONCURRENT_VIDEOS);
    const fragment = document.createDocumentFragment();

    const resolvedBatch = await Promise.all(
      batch.map(async (item) => {
        const videoURL = `${root}/ep_${item.index}/video${item.data.videoType}`;
        const duration = await getVideoDurationWithTimeout(videoURL, 10000);
        return { ...item, duration };
      }),
    );

    resolvedBatch.forEach((ep) => {
      totalSeconds += ep.duration;
      const clone = template.content.cloneNode(true) as HTMLElement;
      const cardBtn = clone.querySelector("#videoCard") as HTMLButtonElement;

      if (cardBtn) {
        cardBtn.id = `episodeCard_${ep.index}`;

        // Fill in static data (Covers, titles, durations)
        const cover = cardBtn.querySelector("#videoCover") as HTMLImageElement;
        const title = cardBtn.querySelector("#videoTitle") as HTMLElement;
        const desc = cardBtn.querySelector("#videoDesc") as HTMLElement;
        const dur = cardBtn.querySelector("#videoDuration") as HTMLElement;

        if (cover) cover.src = `${root}/ep_${ep.index}/cover.webp`;
        if (title)
          title.innerText = ep.data.episodeName || `Episode ${ep.index}`;
        if (desc) desc.innerText = ep.data.desc || "";
        if (dur) {
          dur.innerHTML = `<span class="material-symbols-rounded">schedule</span> ${ep.duration > 0 ? formatSecondsToTimestamp(ep.duration) : "--:--"}`;
        }

        // Use SwitchEpisode to avoid page reload during session
        cardBtn.setAttribute("onclick", `SwitchEpisode(${ep.index})`);

        if (ep.index === currentEpisode_Num) {
          cardBtn.classList.add("border-2", "!border-Accent", "bg-Accent/10");
        }
        fragment.appendChild(clone);
      }
    });

    container.appendChild(fragment);
    if (totalDurText)
      totalDurText.innerText = formatSecondsToReadable(totalSeconds);
  }
}

/**
 * PLAYER SETUP & NAVIGATION
 */
async function GetTheVideos(videoRootSource: string) {
  if (!videoRootSource) return;
  videoRootSRC = videoRootSource;
  const videoInformationJSON =
    videoRootSource + currentEpisode + "/information.json";
  const posterSource = videoRootSource + currentEpisode + "/cover.webp";
  const uploaderIMG = videoRootSource + currentEpisode + "/uploader.webp";
  const videoSourceBase = videoRootSource + currentEpisode + "/video";

  await WriteVideoInformation(
    videoSourceBase,
    posterSource,
    uploaderIMG,
    videoInformationJSON,
  );
}

async function WriteVideoInformation(
  videoSource: string,
  posterSource: string,
  uploaderIMG: string,
  videoInformationJSON: string,
) {
  if (!videoPlayer) return;
  try {
    const response = await fetch(videoInformationJSON);
    if (!response.ok) throw new Error("Episode details not found.");
    const data = await response.json();
    const finalVideoSrc = videoSource + data.videoType;

    LoadVideoData(
      data.title || "Untitled",
      data.episodeName || `Episode ${currentEpisode_Num}`,
      data.desc || "",
      data.author || "Unknown",
      data.meta?.views || "0",
      data.meta?.uploadDate || "TBA",
      uploaderIMG,
    );

    videoPlayer.src = finalVideoSrc;
    videoPlayer.poster = posterSource;
    videoPlayer.volume = 1;

    videoPlayer.onerror = () =>
      LoadingManager.setError("Video source missing.");
    videoPlayer.onended = () => NextEpisode();
  } catch (error: any) {
    LoadingManager.setError(error.message);
  }
}

async function PreviousEpisode() {
  if (currentEpisode_Num <= 1) return;
  await SwitchEpisode(currentEpisode_Num - 1);
}
(window as any).PreviousEpisode = PreviousEpisode;

async function NextEpisode() {
  await SwitchEpisode(currentEpisode_Num + 1);
}
(window as any).NextEpisode = NextEpisode;

/**
 * UI DATA WRITER
 */
function LoadVideoData(
  TitleData: string,
  EpisodeData: string,
  DescData: string,
  UploaderData: string,
  ViewData: string,
  UploadDateData: string,
  uploaderIMG: string,
) {
  const elements = {
    vTitle: document.getElementById("videoTitle"),
    pTitle: document.getElementById("pageVideoTitle"),
    pDesc: document.getElementById("pageVideoDesc"),
    vUploader: document.getElementById("videoUploader"),
    pUploader: document.getElementById("pageVideoUploader"),
    pImg: document.getElementById("pageVideoUploaderIMG") as HTMLImageElement,
    pViews: document.getElementById("pageVideoViews"),
    pDate: document.getElementById("pageVideoUpload"),
  };
  if (elements.vTitle)
    elements.vTitle.innerHTML = `${TitleData} - ${EpisodeData}`;
  if (elements.pTitle)
    elements.pTitle.innerHTML = `${TitleData} - ${EpisodeData}`;
  if (elements.pDesc) elements.pDesc.innerHTML = DescData;
  if (elements.vUploader) elements.vUploader.innerHTML = UploaderData;
  if (elements.pUploader) elements.pUploader.innerHTML = UploaderData;
  if (elements.pImg) elements.pImg.src = uploaderIMG;
  if (elements.pViews) elements.pViews.innerHTML = `${ViewData} Views`;
  if (elements.pDate) elements.pDate.innerHTML = UploadDateData;
}

/**
 * FORMATTERS
 */
function formatSecondsToTimestamp(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

function formatSecondsToReadable(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getVideoDurationWithTimeout(
  url: string,
  timeout: number,
): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const timer = setTimeout(() => {
      video.src = "";
      resolve(0);
      video.remove();
    }, timeout);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve(video.duration);
      video.remove();
    };
    video.onerror = () => {
      clearTimeout(timer);
      resolve(0);
      video.remove();
    };
    video.src = url;
  });
}
