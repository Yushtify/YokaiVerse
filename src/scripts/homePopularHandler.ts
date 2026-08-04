/**
 * popularHandler.ts
 * Lister for popular anime on the Home page.
 * Filters anime entries with the "Popular" tag/category and renders them.
 */

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface AnimeInfo {
  title: string;
  desc: string;
  author: string;
  ageRestriction: string;
  adultContent: boolean;
  categories: string[];
  type: {
    movie: boolean;
    anime: boolean;
  };
  meta: {
    rating: string;
    uploadDate: string;
    tags?: Record<string, string>;
  };
}

interface AnimeEntry {
  id: string;
  root: string;
  data: AnimeInfo;
}

interface ListerElements {
  cardGrid: HTMLElement;
}

interface LoadingManagerInterface {
  show: (message?: string) => void;
  hide: () => void;
  setError: (message: string) => void;
}

declare const LoadingManager: LoadingManagerInterface;

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const CONFIG = {
  database: {
    path: "/animeIDs.json",
  },
  batch: {
    concurrency: 5,
  },
  selectors: {
    listerTemplate: "animeLister",
    injectionTarget: "categoryContainer",
    cardTemplate: "animeCardTemplate",
    listerSVG: "#listerSVG",
    listerTitle: "#listerTitle",
    listerDesc: "#listerDesc",
    cardGrid: "#animeCardLister",
    card: {
      cover: "#animeCover",
      title: "#animeTitle",
      rating: "#animeRating",
      desc: "#animeDesc",
      author: "#animeUploadedBy_Text",
      nsfwFilter: "#animeCardNsfwFilter",
      infoBtn: "#coverButton",
    },
  },
  defaults: {
    title: "Untitled",
    desc: "No description available.",
    rating: "Not Rated",
    author: "Unknown",
    category: "Popular",
  },
  popularMeta: {
    title: "Popular Animes",
    icon: "trending_up",
    desc: "The most watched and highly rated titles right now.",
  },
} as const;

// ─── UTILS & FETCHING ────────────────────────────────────────────────────────

function generateListerID(category: string): string {
  const sanitized = category.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `lister-${sanitized}`;
}

class FetchError extends Error {
  constructor(
    public readonly message: string,
    public readonly url: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new FetchError(`HTTP ${res.status}`, url, res.status);
  return res.json() as Promise<T>;
}

async function fetchAnimeDatabase(): Promise<Record<string, string>> {
  const data = await fetchJSON<Record<string, string>>(CONFIG.database.path);
  if (Object.keys(data).length === 0)
    throw new Error("Anime database is empty.");
  return data;
}

// ─── POPULAR FILTERING ───────────────────────────────────────────────────────

/**
 * Filters entries that have 'Popular' in their categories array or meta tags.
 */
function filterPopularAnime(entries: AnimeEntry[]): AnimeEntry[] {
  return entries.filter((entry) => {
    const categories = entry.data.categories || [];
    const tags = entry.data.meta?.tags || {};

    const hasPopularCategory = categories.some(
      (cat) => cat.trim().toLowerCase() === "popular",
    );

    const hasPopularTag =
      Object.keys(tags).some((k) => k.toLowerCase() === "popular") ||
      Object.values(tags).some(
        (v) => typeof v === "string" && v.toLowerCase() === "popular",
      );

    return hasPopularCategory || hasPopularTag;
  });
}

// ─── DOM & UI TEMPLATES ──────────────────────────────────────────────────────

function extractCardTemplate(
  listerTemplate: HTMLTemplateElement,
): HTMLTemplateElement {
  const probe = listerTemplate.content.querySelector<HTMLTemplateElement>(
    `#${CONFIG.selectors.cardTemplate}`,
  );
  if (!probe)
    throw new Error(
      "Critical: #animeCardTemplate not found inside lister template.",
    );

  return probe.cloneNode(true) as HTMLTemplateElement;
}

function setupListerUI(
  listerTemplate: HTMLTemplateElement,
  injectionTarget: HTMLElement,
  listerId: string,
): ListerElements {
  const clone = listerTemplate.content.cloneNode(true) as DocumentFragment;
  const root = clone.firstElementChild as HTMLElement | null;

  if (!root) {
    throw new Error("Lister template root not found.");
  }

  root.id = listerId;

  const svgEl = root.querySelector<HTMLElement>(CONFIG.selectors.listerSVG);
  const titleEl = root.querySelector<HTMLElement>(CONFIG.selectors.listerTitle);
  const descEl = root.querySelector<HTMLElement>(CONFIG.selectors.listerDesc);
  const cardGrid = root.querySelector<HTMLElement>(CONFIG.selectors.cardGrid);

  if (!cardGrid) {
    throw new Error("Critical: #animeCardLister not found.");
  }

  if (svgEl) svgEl.textContent = CONFIG.popularMeta.icon;
  if (titleEl) titleEl.textContent = CONFIG.popularMeta.title;
  if (descEl) descEl.textContent = CONFIG.popularMeta.desc;

  cardGrid.replaceChildren();
  injectionTarget.appendChild(root);

  return { cardGrid };
}

// ─── CARD RENDERING ──────────────────────────────────────────────────────────

function populateCard(clone: DocumentFragment, entry: AnimeEntry): void {
  const s = CONFIG.selectors.card;
  const { id, root, data } = entry;

  const coverImg = clone.querySelector<HTMLImageElement>(s.cover);
  const titleEl = clone.querySelector<HTMLElement>(s.title);
  const ratingEl = clone.querySelector<HTMLElement>(s.rating);
  const descEl = clone.querySelector<HTMLElement>(s.desc);
  const authorEl = clone.querySelector<HTMLElement>(s.author);
  const infoBtn = clone.querySelector<HTMLElement>(s.infoBtn);

  if (coverImg) coverImg.src = `${root}/cover.webp`;
  if (titleEl) titleEl.textContent = data.title || CONFIG.defaults.title;
  if (descEl) descEl.textContent = data.desc || CONFIG.defaults.desc;
  if (ratingEl)
    ratingEl.textContent = data.meta?.rating || CONFIG.defaults.rating;
  if (authorEl) authorEl.textContent = data.author || CONFIG.defaults.author;
  if (infoBtn) infoBtn.setAttribute("onclick", `findAnimeInfo('${id}')`);
}

function applyNsfwFilter(clone: DocumentFragment, entry: AnimeEntry): void {
  const { data } = entry;
  const filter = clone.querySelector<HTMLElement>(
    CONFIG.selectors.card.nsfwFilter,
  );
  if (!filter) return;

  const isNSFW = data.adultContent === true || data.ageRestriction === "18+";
  filter.classList.toggle("flex", isNSFW);
  filter.classList.toggle("hidden", !isNSFW);
}

function renderCard(
  entry: AnimeEntry,
  grid: HTMLElement,
  cardTemplate: HTMLTemplateElement,
): void {
  const clone = cardTemplate.content.cloneNode(true) as DocumentFragment;
  populateCard(clone, entry);
  applyNsfwFilter(clone, entry);
  grid.appendChild(clone);
}

// ─── BATCH FETCHING ──────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size)
    chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function fetchAllAnimeEntries(
  idMap: Record<string, string>,
): Promise<AnimeEntry[]> {
  const pairs = Object.entries(idMap);
  const chunks = chunkArray(pairs, CONFIG.batch.concurrency);
  const results: AnimeEntry[] = [];

  for (const chunk of chunks) {
    const settled = await Promise.allSettled(
      chunk.map(async ([id, root]) => {
        const data = await fetchJSON<AnimeInfo>(`${root}/information.json`);
        return { id, root, data } satisfies AnimeEntry;
      }),
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else if (result.reason instanceof FetchError) {
        console.error(`[PH] Fetch failed: ${result.reason.url}`);
      }
    }
  }

  return results;
}

// ─── INIT ────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // Global Lifecycle Guard
  if ((window as any).__PH_INITIALIZED__) {
    console.warn("[PH] Already initialized, skipping.");
    return;
  }
  (window as any).__PH_INITIALIZED__ = true;

  const listerTemplate = document.getElementById(
    CONFIG.selectors.listerTemplate,
  ) as HTMLTemplateElement | null;
  const injectionTarget = document.getElementById(
    CONFIG.selectors.injectionTarget,
  );

  if (!listerTemplate || !injectionTarget) {
    console.error(
      "[PH] Critical: listerTemplate or injectionTarget not found in DOM.",
    );
    return;
  }

  LoadingManager.show("Loading home page...");

  try {
    const idMap = await fetchAnimeDatabase();
    const allEntries = await fetchAllAnimeEntries(idMap);
    const popularEntries = filterPopularAnime(allEntries);

    if (popularEntries.length === 0) {
      LoadingManager.setError(
        "Loading page failed. [No popular entries found]",
      );
      return;
    }

    const cardTemplate = extractCardTemplate(listerTemplate);
    const listerId = generateListerID("popular");

    let existingLister = document.getElementById(listerId);
    let cardGrid: HTMLElement | null = null;

    if (existingLister) {
      cardGrid = existingLister.querySelector<HTMLElement>(
        CONFIG.selectors.cardGrid,
      );
    } else {
      const ui = setupListerUI(listerTemplate, injectionTarget, listerId);
      cardGrid = ui.cardGrid;
    }

    if (cardGrid) {
      for (const entry of popularEntries) {
        renderCard(entry, cardGrid, cardTemplate);
      }
    }

    LoadingManager.hide();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to initialize popular list.";
    LoadingManager.setError(message);
  }
});
