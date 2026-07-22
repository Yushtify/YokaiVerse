import { listAnime } from "../listAnime.ts"; // Import listAnime module

/**
 * Info Page - Debug Enabled Modular Renderer
 */

// --- GLOBAL TYPES DECLARATION ---
interface LoadingManagerInterface {
  show: (message?: string) => void;
  hide: () => void;
  setError: (errorMessage: string) => void;
}

// Declare LoadingManager as a global TypeScript interface
declare const LoadingManager: LoadingManagerInterface;

let animeRootSrc: string;

/**
 * MAIN INITIALIZATION
 */
document.addEventListener("DOMContentLoaded", async () => {
  if (window.location.pathname !== "/info") return;

  console.log("[Init]: Info page detected. Starting process...");
  LoadingManager.show("Loading...");

  const params = new URLSearchParams(window.location.search);
  const animeID = params.get("v")?.split(/[+ ]/)[0];

  if (!animeID) {
    console.error("[Init Error]: No Anime ID found in URL parameters.");
    return LoadingManager.setError(
      "No Anime ID provided in the URL, if this is a mistake report this to support.",
    );
  }

  console.log("[Init]: Searching for Anime ID: " + animeID);
  await LoadModularInfo(animeID);
});

/**
 * Loads main series information and starts hierarchical listing
 */
async function LoadModularInfo(animeID: string): Promise<void> {
  const videoID_MAP = "/animeIDs.json";

  try {
    console.log("[Fetch]: Requesting animeIDs.json...");
    const response = await fetch(videoID_MAP);
    if (!response.ok) throw new Error("Could not fetch ID mapping file.");

    const idMap = await response.json();
    animeRootSrc = idMap[animeID];

    if (!animeRootSrc) {
      console.warn("[Data Error]: ID " + animeID + " not found in mapping.");
      throw new Error("Series " + animeID + " not found in database.");
    }

    console.log("[Data Found]: Root path is " + animeRootSrc);

    console.log("[Fetch]: Requesting series information.json...");
    const infoRes = await fetch(animeRootSrc + "/information.json");
    if (!infoRes.ok)
      throw new Error("Main series information file is missing.");

    const data = await infoRes.json();
    console.log("[Data]: Series metadata loaded successfully.", data);

    // Explicitly extract ageRestriction with proper fallbacks
    const ageRestriction = data.ageRestriction ?? data.age ?? "Unknown";
    console.log(
      "[Data Debug]: ageRestriction extracted as:",
      ageRestriction,
      "| Raw data.ageRestriction:",
      data.ageRestriction,
    );

    // Populate UI with main data
    LoadAnimeData(
      animeRootSrc + "/banner.webp",
      data.title || "Untitled Series",
      data.desc || "No description available.",
      data.author || "Unknown",
      ageRestriction,
      data.meta?.uploadDate || "TBA",
    );

    if (data.meta && data.meta.tags) {
      loadTagData(data.meta.tags);
    }

    // MODULE INTEGRATION: Using listAnime
    console.log(
      "[Process]: Starting hierarchical Season/Episode scan via module...",
    );

    await listAnime({
      root: animeRootSrc,
      onEpisodeClick: (seasonIndex, epIndex) => {
        // Directly send animeID, season, and episode parameters
        window.findAnime(animeID, seasonIndex, epIndex);
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

/**
 * UI Loaders (Tags & Data)
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

function LoadAnimeData(
  banner: string,
  title: string,
  desc: string,
  author: string,
  age: string,
  date: string,
): void {
  const bannerImg = document.getElementById("BannerImage") as HTMLImageElement;
  const titleTxt = document.getElementById("contentTitle");
  const descTxt = document.getElementById("contentDescText");
  const authorTxt = document.getElementById("contentAuthorStudio_Text");
  const dateTxt = document.getElementById("releaseDate_Text");
  const contentRatingTxt = document.getElementById("contentRating_Text");

  if (bannerImg) bannerImg.src = banner;
  if (titleTxt) titleTxt.innerText = title;
  if (descTxt) descTxt.innerText = desc;
  if (authorTxt) authorTxt.innerText = author;
  if (dateTxt) dateTxt.innerText = date;
  if (contentRatingTxt) contentRatingTxt.innerText = age;
}
