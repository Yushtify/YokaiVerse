/**
 * featuredHandler.ts
 * Modular, performant featured anime lister.
 * Categories are derived dynamically from each anime's information.json.
 * Handles batched card rendering, NSFW filtering, and unique lister IDs.
 */

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface AnimeInfo {
  title: string;
  desc: string;
  author: string;
  ageRestriction: string;
  nsfw: boolean;
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
    category: "Uncategorized",
  },
  categoryMeta: {
    popular: { icon: "trending_up", desc: "The most watched and highly rated titles right now.", },
    featured: { icon: "star", desc: "Hand-picked titles you shouldn't miss." },
    movies: { icon: "movie", desc: "Animated films from our collection." },
    movie: { icon: "movie", desc: "Animated films from our collection." },
    series: {
      icon: "play_circle",
      desc: "Ongoing and completed anime series.",
    },
    ova: { icon: "video_library", desc: "Original video animations." },
    special: { icon: "stars", desc: "Special episodes and bonus content." },
    drama: {
      icon: "theater_comedy",
      desc: "Emotionally driven dramatic titles.",
    },
    psychological: {
      icon: "psychology",
      desc: "Mind-bending psychological anime.",
    },
    supernatural: {
      icon: "auto_awesome",
      desc: "Anime with supernatural elements.",
    },
    music: { icon: "music_note", desc: "Anime centered around music." },
  } as Record<string, { icon: string; desc: string }>,
  fallbackCategoryMeta: {
    icon: "category",
    desc: "Browse titles in this category.",
  },
} as const;

// ─── REGISTRY & ID GENERATION ────────────────────────────────────────────────

/**
 * Generates a deterministic, URL-safe DOM element ID based on the category name.
 * This guarantees the exact same string across separate script executions.
 */
function generateListerID(category: string): string {
  const sanitized = category.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `lister-${sanitized}`;
}

// ─── FETCH UTILITIES ─────────────────────────────────────────────────────────

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

// ─── CATEGORY GROUPING ───────────────────────────────────────────────────────

function resolveCategories(raw: string[] | undefined | null): string[] {
  if (!Array.isArray(raw) || raw.length === 0)
    return [CONFIG.defaults.category];

  const cleaned = raw
    .map((c) => {
      const trimmed = c.trim();
      // Normalize casing (e.g., "action" -> "Action") to prevent duplicate keys within Maps
      return trimmed
        ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
        : "";
    })
    .filter(Boolean);

  return cleaned.length > 0 ? cleaned : [CONFIG.defaults.category];
}

function groupByCategory(entries: AnimeEntry[]): Map<string, AnimeEntry[]> {
  const map = new Map<string, AnimeEntry[]>();
  for (const entry of entries) {
    for (const cat of resolveCategories(entry.data.categories)) {
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(entry);
    }
  }
  return map;
}

// ─── CARD TEMPLATE ───────────────────────────────────────────────────────────

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

  const detached = probe.cloneNode(true) as HTMLTemplateElement;
  return detached;
}

// ─── LISTER UI SETUP ─────────────────────────────────────────────────────────

function getCategoryMeta(category: string): { icon: string; desc: string } {
  return (
    CONFIG.categoryMeta[category.toLowerCase()] ?? CONFIG.fallbackCategoryMeta
  );
}

function setupListerUI(
  listerTemplate: HTMLTemplateElement,
  category: string,
  injectionTarget: HTMLElement,
  listerId: string,
): ListerElements {
  const clone = listerTemplate.content.cloneNode(true) as DocumentFragment;

  // En dış container
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

  const meta = getCategoryMeta(category);

  if (svgEl) svgEl.textContent = meta.icon;
  if (titleEl) titleEl.textContent = category;
  if (descEl) descEl.textContent = meta.desc;

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
  if (descEl) descEl.innerHTML = data.desc || CONFIG.defaults.desc;
  if (ratingEl)
    ratingEl.textContent = data.meta?.rating || CONFIG.defaults.rating;
  if (authorEl) authorEl.textContent = data.author || CONFIG.defaults.author;
  if (infoBtn) infoBtn.setAttribute("onclick", `findAnimeInfo('${id}')`);

  if (!data.title) console.warn(`[FH] Missing title for [${id}]`);
  if (!data.desc) console.warn(`[FH] Missing desc for [${id}]`);
  if (!data.meta?.rating) console.warn(`[FH] Missing rating for [${id}]`);
  if (!data.author) console.warn(`[FH] Missing author for [${id}]`);
}

function applyNsfwFilter(clone: DocumentFragment, entry: AnimeEntry): void {
  const { id, data } = entry;
  const filter = clone.querySelector<HTMLElement>(
    CONFIG.selectors.card.nsfwFilter,
  );
  if (!filter) return;

  if (data.nsfw === undefined && data.ageRestriction === undefined) {
    console.warn(`[FH] NSFW fields missing for [${id}]`);
  }

  const isNSFW = data.nsfw === true || data.ageRestriction === "18+";
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

// ─── DATA FETCHING ───────────────────────────────────────────────────────────

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
      } else {
        const reason = result.reason;
        if (reason instanceof FetchError) {
          console.error(`[FH] Fetch failed: ${reason.url} — ${reason.message}`);
        } else {
          console.error(`[FH] Unexpected error fetching entry:`, reason);
        }
      }
    }
  }

  return results;
}

// ─── INIT ────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // Global Lifecycle Guard: Prevents dual-execution if the script file is evaluated multiple times
  if ((window as any).__FH_INITIALIZED__) {
    console.warn(
      "[FH] Already initialized globally, skipping script execution.",
    );
    return;
  }
  (window as any).__FH_INITIALIZED__ = true;

  const listerTemplate = document.getElementById(
    CONFIG.selectors.listerTemplate,
  ) as HTMLTemplateElement | null;
  const injectionTarget = document.getElementById(
    CONFIG.selectors.injectionTarget,
  );

  if (!listerTemplate || !injectionTarget) {
    console.error(
      "[FH] Critical: listerTemplate or injectionTarget not found in DOM.",
    );
    return;
  }

  LoadingManager.show("Loading...");

  try {
    const idMap = await fetchAnimeDatabase();
    const allEntries = await fetchAllAnimeEntries(idMap);

    if (allEntries.length === 0) {
      LoadingManager.setError(
        "No valid content found. Please try again later.",
      );
      return;
    }

    const cardTemplate = extractCardTemplate(listerTemplate);
    const grouped = groupByCategory(allEntries);

    for (const [category, entries] of grouped) {
      try {
        const listerId = generateListerID(category);

        // INTERCEPTOR MERGING GUARD: Scopes layout lookups directly to specific instances.
        // If a duplicate event gets past our guards, it appends cleanly into the matched category
        // layout block instead of overflowing or creating structural loops inside the layout tree.
        let existingLister = document.getElementById(listerId);
        let cardGrid: HTMLElement | null = null;

        if (existingLister) {
          cardGrid = existingLister.querySelector<HTMLElement>(
            CONFIG.selectors.cardGrid,
          );
        } else {
          const ui = setupListerUI(
            listerTemplate,
            category,
            injectionTarget,
            listerId,
          );
          cardGrid = ui.cardGrid;
        }

        if (cardGrid) {
          for (const entry of entries) {
            renderCard(entry, cardGrid, cardTemplate);
          }
        }
      } catch (e) {
        console.error(
          `[FH] Failed to setup lister for category "${category}":`,
          e,
        );
      }
    }

    LoadingManager.hide();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to initialize. Please try again later.";
    LoadingManager.setError(message);
  }
});
