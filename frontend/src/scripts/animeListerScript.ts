/**
 * Featured Handler - Modular & High Performance
 * Handles unique lister IDs, batch card rendering, and NSFW filtering.
 */

interface AnimeInfo {
  title: string;
  desc: string;
  author: string;
  ageRestriction: string;
  nsfw: boolean;
  meta: {
    rating: string;
    uploadDate: string;
    views: string;
  };
}

// --- TYPE DECLARATIONS ---
interface LoadingManagerInterface {
  show: (message?: string) => void;
  hide: () => void;
  setError: (errorMessage: string) => void;
}

declare const LoadingManager: LoadingManagerInterface;

// --- CONFIGURATION ---
const listerRegistry: Record<string, number> = {};
const BATCH_SIZE = 20;

document.addEventListener("DOMContentLoaded", async () => {
  const listerTemplate = document.getElementById(
    "animeLister",
  ) as HTMLTemplateElement;
  const injectionTarget = document.getElementById("featuredListComp");

  if (!listerTemplate || !injectionTarget) return;

  LoadingManager.show("Loading...");

  try {
    const idMap = await fetchAnimeDatabase();
    const animeEntries = Object.entries(idMap);

    const { listerClone, cardGrid, cardTemplate } = setupListerUI(
      listerTemplate,
      "Movies",
    );

    injectionTarget.appendChild(listerClone);

    await processAnimeBatches(animeEntries, cardGrid, cardTemplate);
  } catch (error: any) {
    LoadingManager.setError(
      error.message || "Failed to initialize Data base, try again later.",
    );
  }
});

/**
 * Fetches the main anime ID mapping file
 */
async function fetchAnimeDatabase(): Promise<Record<string, string>> {
  const response = await fetch("/animeIDs.json");
  if (!response.ok) throw new Error("Could not load anime database mapping.");
  const data = await response.json();
  if (Object.keys(data).length === 0)
    throw new Error("Anime database is empty.");
  return data;
}

/**
 * Clones the lister template and configures its unique IDs and headers
 */
function setupListerUI(template: HTMLTemplateElement, title: string) {
  const listerClone = template.content.cloneNode(true) as HTMLElement;
  const listerRootDiv = listerClone.querySelector("div");

  const listerSVG = listerClone.querySelector("#listerSVG");
  const listerTitle = listerClone.querySelector("#listerTitle");
  const listerDesc = listerClone.querySelector("#listerDesc");

  if (listerSVG) listerSVG.textContent = "movie";
  if (listerTitle) listerTitle.textContent = title;
  if (listerDesc)
    listerDesc.textContent =
      "Explore the most popular and recently added animated films from our collection.";

  let uniqueID = `${title}Lister`;
  if (listerRegistry[uniqueID]) {
    listerRegistry[uniqueID]++;
    uniqueID = `${uniqueID}_${listerRegistry[uniqueID]}`;
  } else {
    listerRegistry[uniqueID] = 1;
  }

  if (listerRootDiv) listerRootDiv.id = uniqueID;

  const cardGrid = listerClone.querySelector("#animeCardLister") as HTMLElement;
  const cardTemplate = (listerClone.querySelector("#animeCardTemplate") ||
    document.getElementById("animeCardTemplate")) as HTMLTemplateElement;

  if (!cardGrid)
    throw new Error(
      "Critical: #animeCardLister grid container not found in template.",
    );
  if (!cardTemplate) throw new Error("Critical: #animeCardTemplate not found.");

  cardGrid.innerHTML = "";
  return { listerClone, cardGrid, cardTemplate };
}

/**
 * Processes anime entries in throttled batches
 */
async function processAnimeBatches(
  entries: [string, string][],
  grid: HTMLElement,
  template: HTMLTemplateElement,
) {
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async ([id, root]) => {
        await renderAnimeCard(id, root, grid, template);
      }),
    );

    if (i === 0) LoadingManager.hide();
  }

  if (grid.children.length === 0) {
    LoadingManager.setError(
      "No valid content found to display, try again later.",
    );
  }
}

/**
 * Fetches individual anime data and populates a card template
 */
async function renderAnimeCard(
  id: string,
  root: string,
  grid: HTMLElement,
  template: HTMLTemplateElement,
) {
  try {
    const infoRes = await fetch(`${root}/information.json`);

    // ERROR: Path or JSON file not found (logs error, continues list)
    if (!infoRes.ok) {
      console.error(
        `Error: Invalid root or missing information.json for [${id}] at path: ${root}`,
      );
      return;
    }

    const data: AnimeInfo = await infoRes.json();
    const cardClone = template.content.cloneNode(true) as HTMLElement;

    const coverImg = cardClone.querySelector("#animeCover") as HTMLImageElement;
    const titleText = cardClone.querySelector(
      "#animeTitle",
    ) as HTMLParagraphElement;
    const ratingText = cardClone.querySelector(
      "#animeRating_Text",
    ) as HTMLParagraphElement;
    const authorText = cardClone.querySelector(
      "#animeUploadedBy_Text",
    ) as HTMLParagraphElement;

    if (coverImg) coverImg.src = `${root}/cover.webp`;

    // WARN: Log missing data but fall back to defaults
    if (titleText) {
      if (!data.title) console.warn(`Warn: Missing title for [${id}].`);
      titleText.textContent = data.title || "Untitled";
    }

    // Rating
    if (ratingText) {
      if (!data.meta?.rating) console.warn(`Warn: Missing rating for [${id}].`);
      ratingText.textContent = data.meta?.rating || "0.0";
    }

    // Author
    if (authorText) {
      if (!data.author) console.warn(`Warn: Missing author for [${id}].`);
      authorText.textContent = data.author || "Unknown";
    }

    applyNsfwFilter(cardClone, data, id);

    const infoBtn = cardClone.querySelector("#coverButton");
    const playBtn = cardClone.querySelector("#playButton");

    // Set button attribute's
    if (infoBtn) infoBtn.setAttribute("onclick", `findAnimeInfo('${id}')`);
    if (playBtn) playBtn.setAttribute("onclick", `findAnime('${id}')`);
    console.log("ID: " + id + "\n" + "Root: " + root);

    grid.appendChild(cardClone);
  } catch (e) {
    console.error(`Error: Unexpected failure rendering card [${id}]:`, e);
  }
}

/**
 * Controls the visibility of the NSFW overlay
 */
function applyNsfwFilter(
  cardElement: HTMLElement,
  data: AnimeInfo,
  id: string,
) {
  const nsfwFilter = cardElement.querySelector("#animeCardNsfwFilter");
  if (!nsfwFilter) return;

  // Warn if logic fields are missing
  if (data.nsfw === undefined && data.ageRestriction === undefined) {
    console.warn(`Warn: NSFW logic fields missing for [${id}].`);
  }

  const isNSFW = data.nsfw === true || data.ageRestriction === "18+";
  nsfwFilter.classList.toggle("flex", isNSFW);
  nsfwFilter.classList.toggle("hidden", !isNSFW);
}
