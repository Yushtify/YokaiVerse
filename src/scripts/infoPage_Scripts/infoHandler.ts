/**
 * Info Page - Modular Data & Episode Renderer (Optimized)
 */

let animeRootSrc: string;
const MAX_CONCURRENT_PROMISES = 10; // controls how many episodes can be listed at the same time. (default: 10)

/**
 * Redirects user to the info page for a specific anime
 */
function findAnimeInfo(videoID: string): void {
  window.location.href = `/info?v=${videoID}`;
}
(window as any).findAnimeInfo = findAnimeInfo;

/**
 * MAIN INITIALIZATION
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (window.location.pathname !== "/info") return;

  LoadingManager.show("Fetching Data");

  const params = new URLSearchParams(window.location.search);
  const AnimeID = params.get("v")?.split(/[+ ]/)[0];

  if (!AnimeID) {
    return LoadingManager.setError("No Anime ID provided in the URL.");
  }

  await LoadModularInfo(AnimeID);
});

/**
 * Loads main series information and starts episode listing
 */
async function LoadModularInfo(AnimeID: string): Promise<void> {
  const videoID_MAP = "/animeIDs.json";

  try {
    const response = await fetch(videoID_MAP);
    if (!response.ok) throw new Error("Could not fetch ID mapping file.");

    const idMap = await response.json();
    animeRootSrc = idMap[AnimeID];

    if (!animeRootSrc) {
      throw new Error(`Series "${AnimeID}" not found in database.`);
    }

    const infoRes = await fetch(`${animeRootSrc}/information.json`);
    if (!infoRes.ok)
      throw new Error("Main series information file is missing.");

    const data = await infoRes.json();

    LoadAnimeData(
      `${animeRootSrc}/banner.webp`,
      data.title || "Untitled Series",
      data.desc || "No description available.",
      data.author || "Unknown",
      data.ageRestriction || "Unknown",
      data.meta?.uploadDate || "TBA",
    );

    if (data.meta && data.meta.tags) {
      loadTagData(data.meta.tags);
    }

    // Wait for the optimized episode list to finish
    await ListEpisodes_InfoHandler(animeRootSrc);

    // Final safety hide (in case list was empty)
    LoadingManager.hide();
  } catch (error: any) {
    LoadingManager.setError(error.message || "An unexpected error occurred.");
    console.error("Load Error:", error);
  }
}

/**
 * Optimized Episode Listing with Concurrency Limit
 */
async function ListEpisodes_InfoHandler(root: string): Promise<void> {
  const container = document.getElementById("episodeContainer");
  const firstEpContainer = document.getElementById("firstEpisodeContainer");
  const episodeCountElement = document.getElementById("contentEpisodes_Text");
  const totalDurText = document.getElementById("contentDuration_Text");
  const totalDurBanner = document.getElementById("contentDuration_BannerText");
  const template = document.getElementById(
    "videoCard_Template",
  ) as HTMLTemplateElement;

  if (!container || !template) return;

  container.innerHTML = "";
  let epIndex = 1;
  let searching = true;
  let totalSeconds = 0;
  const episodeMetadataList: { index: number; data: any }[] = [];

  // Step 1: Rapidly featured episodes (Low overhead fetch)
  while (searching) {
    try {
      const epRes = await fetch(`${root}/ep_${epIndex}/information.json`);
      if (!epRes.ok) {
        searching = false;
        break;
      }
      const epData = await epRes.json();
      episodeMetadataList.push({ index: epIndex, data: epData });
      epIndex++;
    } catch (e) {
      searching = false;
    }
  }

  // Step 2: Throttled Duration Fetching & DOM Injection
  // We process in batches of MAX_CONCURRENT_PROMISES
  for (
    let i = 0;
    i < episodeMetadataList.length;
    i += MAX_CONCURRENT_PROMISES
  ) {
    const batch = episodeMetadataList.slice(i, i + MAX_CONCURRENT_PROMISES);

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const videoURL = `${root}/ep_${item.index}/video${item.data.videoType}`;
        const duration = await getVideoDuration_InfoHandler(videoURL);
        return { ...item, duration };
      }),
    );

    const fragment = document.createDocumentFragment();

    batchResults.forEach((ep) => {
      totalSeconds += ep.duration;
      const clone = template.content.cloneNode(true) as HTMLElement;
      const cardBtn = clone.querySelector("#videoCard") as HTMLButtonElement;

      if (cardBtn) {
        cardBtn.id = `episodeCard_${ep.index}`;
        const cover = cardBtn.querySelector("#videoCover") as HTMLImageElement;
        const title = cardBtn.querySelector("#videoTitle") as HTMLElement;
        const desc = cardBtn.querySelector("#videoDesc") as HTMLElement;
        const dur = cardBtn.querySelector("#videoDuration") as HTMLElement;

        if (cover) cover.src = `${root}/ep_${ep.index}/cover.webp`;
        if (title)
          title.innerText = ep.data.episodeName || `Episode ${ep.index}`;
        if (desc) desc.innerText = ep.data.desc || "";
        if (dur) {
          dur.innerHTML = `<span class="material-symbols-rounded">schedule</span> ${formatSecondstoTS(ep.duration)}`;
        }

        const params = new URLSearchParams(window.location.search);
        const baseID = params.get("v")?.split(/[+ ]/)[0];
        cardBtn.setAttribute(
          "onclick",
          `findAnime('${baseID}+ep_${ep.index}')`,
        );

        if (ep.index === 1 && firstEpContainer) {
          firstEpContainer.innerHTML = "";
          firstEpContainer.appendChild(clone.cloneNode(true));
        }

        fragment.appendChild(clone);
      }
    });

    container.appendChild(fragment);

    // NEW: After the first batch is injected, hide the loading screen
    if (i === 0) {
      LoadingManager.hide();
    }

    // Step 4: Metadata Updates (Progressive)
    const finalTimeFormatted = formatSecondstoTR(totalSeconds);
    if (totalDurText) totalDurText.innerText = finalTimeFormatted;
    if (totalDurBanner) totalDurBanner.innerText = finalTimeFormatted;
    if (episodeCountElement)
      episodeCountElement.innerText = `${episodeMetadataList.length} episodes`;
  }
}

/**
 * Helper: Video Metadata Fetcher
 */
function getVideoDuration_InfoHandler(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve(video.duration);
      video.remove();
    };
    video.onerror = () => {
      resolve(0);
      video.remove();
    };
    video.src = url;
  });
}

/**
 * Helper: Formatting
 */
function formatSecondstoTS(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

function formatSecondstoTR(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Tag/Category Loader
 */
function loadTagData(tags: Record<string, string>): void {
  const container = document.getElementById("Category_List");
  const template = document.getElementById(
    "Category_PlaceHolder",
  ) as HTMLTemplateElement;
  if (!container || !template) return;

  container.innerHTML = "";
  Object.values(tags).forEach((tagName) => {
    if (!tagName) return;
    const clone = template.content.cloneNode(true) as HTMLElement;
    const txt = clone.querySelector("#Category_PlaceHolderText") as HTMLElement;
    if (txt) txt.innerText = tagName;
    container.appendChild(clone);
  });
}

/**
 * Meta/Banner Loader
 */
function LoadAnimeData(
  Banner: string,
  Title: string,
  Desc: string,
  Author: string,
  AgeRestriction: string,
  Date: string,
): void {
  const bannerImg = document.getElementById("BannerImage") as HTMLImageElement;
  const titleTxt = document.getElementById("contentTitle");
  const descTxt = document.getElementById("contentDescText");
  const authorTxt = document.getElementById("contentAuthorStudio_Text");
  const dateTxt = document.getElementById("releaseDate_Text");
  const dateBannerTxt = document.getElementById("releaseDate_BannerText");
  const contentRatingTxt = document.getElementById("contentRating_Text");
  const contentRatingBannerTxt = document.getElementById(
    "contentRating_BannerText",
  );

  if (bannerImg) bannerImg.src = Banner;
  if (titleTxt) titleTxt.innerText = Title;
  if (descTxt) descTxt.innerText = Desc;
  if (authorTxt) authorTxt.innerText = Author;
  if (dateTxt) dateTxt.innerText = Date;
  if (dateBannerTxt) dateBannerTxt.innerText = Date;
  if (contentRatingTxt) contentRatingTxt.innerText = AgeRestriction;
  if (contentRatingBannerTxt) contentRatingBannerTxt.innerText = AgeRestriction;
}
