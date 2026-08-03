/**
 * featuredHandler.ts
 * Modular, performant featured lister for both anime and manga.
 * Categories are derived dynamically from each entry's information.json.
 * Handles batched card rendering, Adult Content filtering, and unique lister IDs.
 *
 * Anime and manga are always rendered into separate containers and never
 * share a lister instance. Manga intentionally reuses the anime card
 * template (#animeCardTemplate) instead of having its own.
 */
import categoryConfig from "./categoryConfig.json";
// TODO: adjust this path to wherever SettingsStorage actually lives
import { SettingsStorage } from "../../components/pageComponents/settings/scripts/settingsStorage.ts";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface MediaInfo {
  title: string;
  desc: string;
  author: string;
  ageRestriction: string;
  adultContent: boolean;
  categories: string[];
  series: {
    movie: boolean;
    manga: boolean;
    anime: boolean;
  };
  meta: {
    rating: string;
    uploadDate: string;
    tags?: Record<string, string>;
  };
}

type AnimeInfo = MediaInfo;
type MangaInfo = MediaInfo;

interface MediaEntry<T> {
  id: string;
  root: string;
  data: T;
}

type AnimeEntry = MediaEntry<AnimeInfo>;
type MangaEntry = MediaEntry<MangaInfo>;

interface ListerElements {
  cardGrid: HTMLElement;
}

interface LoadingManagerInterface {
  show: (message?: string) => void;
  hide: () => void;
  setError: (message: string) => void;
}

declare const LoadingManager: LoadingManagerInterface;

interface MediaCardSelectors {
  cover: string;
  title: string;
  rating: string;
  desc: string;
  author: string;
  nsfwFilter: string;
  infoBtn: string;
}

interface MediaTypeConfig {
  idPrefix: string;
  // Name of the global function invoked on card click, e.g. "findAnimeInfo" / "findMangaInfo".
  infoHandler: string;
  database: {
    path: string;
  };
  selectors: {
    listerTemplate: string;
    injectionTarget: string;
    cardTemplate: string;
    listerSVG: string;
    listerTitle: string;
    listerDesc: string;
    cardGrid: string;
    card: MediaCardSelectors;
  };
}

// ─── FEATURED_CONFIG ──────────────────────────────────────────────────────────────────

// Card-level selectors shared by both media types, since manga intentionally
// reuses the anime card template rather than defining its own.
const SHARED_CARD_SELECTORS: MediaCardSelectors = {
  cover: "#animeCover",
  title: "#animeTitle",
  rating: "#animeRating",
  desc: "#animeDesc",
  author: "#animeUploadedBy_Text",
  nsfwFilter: "#animeCardNsfwFilter",
  infoBtn: "#coverButton",
};

const FEATURED_CONFIG = {
  batch: {
    concurrency: 10,
  },
  defaults: {
    title: "Untitled",
    titleData: "featured.contents.listers.untitled.title",
    desc: "No description available.",
    descData: "featured.contents.listers.untitled.desc",
    rating: "Not Rated",
    author: "Unknown",
    category: "Uncategorized",
  },
  categoryMeta: categoryConfig as Record<
    string,
    { icon: string; titleData: string; desc: string; descData: string }
  >,
  fallbackCategoryMeta: {
    icon: "category",
    desc: "Browse titles in this category.",
    titleData: "featured.contents.listers.untitled.title",
    descData: "featured.contents.listers.untitled.desc",
  },
  // Per-media-type config. Anime and manga must never share selector/id names,
  // with the sole intentional exception of the card template + its internal
  // selectors (manga reuses the anime card template).
  media: {
    anime: {
      idPrefix: "anime",
      infoHandler: "findAnimeInfo",
      database: {
        path: "/animeIDs.json",
      },
      selectors: {
        listerTemplate: "animeLister",
        injectionTarget: "animeListerContainer",
        cardTemplate: "animeCardTemplate",
        listerSVG: "#listerSVG",
        listerTitle: "#listerTitle",
        listerDesc: "#listerDesc",
        cardGrid: "#animeCardLister",
        card: SHARED_CARD_SELECTORS,
      },
    } satisfies MediaTypeConfig,
    manga: {
      idPrefix: "manga",
      infoHandler: "findMangaInfo",
      database: {
        // Lives in the same directory as animeIDs.json.
        path: "/mangaIDs.json",
      },
      selectors: {
        listerTemplate: "mangaLister",
        injectionTarget: "mangaListerContainer",
        // Intentionally identical to anime's: manga reuses the anime card template.
        cardTemplate: "animeCardTemplate",
        listerSVG: "#listerSVG",
        listerTitle: "#listerTitle",
        listerDesc: "#listerDesc",
        cardGrid: "#mangaCardLister",
        card: SHARED_CARD_SELECTORS,
      },
    } satisfies MediaTypeConfig,
  },
} as const;

// ─── Adult Content GATE ────────────────────────────────────────────────────────────────

/**
 * Reads the user's Adult Content preference from persistent settings.
 * Defaults to false (safe) if the setting has never been saved.
 */
function isNsfwEnabled(): boolean {
  const raw = SettingsStorage.load();
  const enabled = raw.adultContent ?? false;
  console.log(
    `[DEBUG: featuredHandler] isNsfwEnabled() -> stored=`,
    raw.adultContent,
    `resolved=`,
    enabled,
  );
  return enabled;
}

/**
 * True if the entry is flagged as 18+/Adult Content content, regardless of
 * which field carries the flag (adultContent boolean or ageRestriction string).
 */
function isEntryNsfw(data: MediaInfo): boolean {
  return data.adultContent === true || data.ageRestriction === "18+";
}

/**
 * Drops Adult Content entries entirely when the user has Adult Content disabled, so they
 * are never fetched into cards, grouped into categories, or rendered —
 * not even behind a hidden/blurred class.
 */
function filterByNsfwSetting<T>(entries: MediaEntry<T>[]): MediaEntry<T>[] {
  const enabled = isNsfwEnabled();
  console.log(
    `[DEBUG: featuredHandler] filterByNsfwSetting() called with ${entries.length} entries, nsfwEnabled=${enabled}`,
  );

  if (enabled) {
    console.log(
      `[DEBUG: featuredHandler] Adult Content enabled, passing all ${entries.length} entries through unfiltered.`,
    );
    return entries;
  }

  const filtered = entries.filter((entry) => {
    const data = entry.data as unknown as MediaInfo;
    const adultContent = isEntryNsfw(data);
    if (adultContent) {
      console.log(
        `[DEBUG: featuredHandler] Dropping Adult Content entry [${entry.id}] — adultContent=${data.adultContent}, ageRestriction=${data.ageRestriction}`,
      );
    }
    return !adultContent;
  });

  console.log(
    `[DEBUG: featuredHandler] filterByNsfwSetting() result: ${filtered.length}/${entries.length} entries kept.`,
  );
  return filtered;
}

// ─── REGISTRY & ID GENERATION ────────────────────────────────────────────────

/**
 * Generates a deterministic, URL-safe DOM element ID based on the media prefix
 * and category name. The prefix guarantees anime and manga never collide even
 * when they share an identical category name (e.g. "Drama").
 */
function generateListerID(idPrefix: string, category: string): string {
  const sanitized = category.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `lister-${idPrefix}-${sanitized}`;
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

async function fetchMediaDatabase(
  path: string,
): Promise<Record<string, string>> {
  const data = await fetchJSON<Record<string, string>>(path);
  if (Object.keys(data).length === 0)
    throw new Error(`Database at ${path} is empty.`);
  return data;
}

// ─── CATEGORY GROUPING ───────────────────────────────────────────────────────

function resolveCategories(raw: string[] | undefined | null): string[] {
  if (!Array.isArray(raw) || raw.length === 0)
    return [FEATURED_CONFIG.defaults.category];

  const cleaned = raw
    .map((c) => {
      const trimmed = c.trim();
      // Normalize casing (e.g., "action" -> "Action") to prevent duplicate keys within Maps
      return trimmed
        ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
        : "";
    })
    .filter(Boolean);

  return cleaned.length > 0 ? cleaned : [FEATURED_CONFIG.defaults.category];
}

function groupByCategory<T>(
  entries: MediaEntry<T>[],
): Map<string, MediaEntry<T>[]> {
  const map = new Map<string, MediaEntry<T>[]>();
  for (const entry of entries) {
    for (const cat of resolveCategories(
      (entry.data as unknown as MediaInfo).categories,
    )) {
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(entry);
    }
  }
  return map;
}

// ─── CARD TEMPLATE ───────────────────────────────────────────────────────────

function extractCardTemplate(
  listerTemplate: HTMLTemplateElement,
  cardTemplateId: string,
): HTMLTemplateElement {
  const probe = listerTemplate.content.querySelector<HTMLTemplateElement>(
    `#${cardTemplateId}`,
  );
  if (!probe)
    throw new Error(
      `Critical: #${cardTemplateId} not found inside lister template.`,
    );

  const detached = probe.cloneNode(true) as HTMLTemplateElement;
  return detached;
}

// ─── LISTER UI SETUP ─────────────────────────────────────────────────────────

function getCategoryMeta(category: string): {
  icon: string;
  desc: string;
  titleData?: string;
  descData?: string;
} {
  return (
    FEATURED_CONFIG.categoryMeta[category.toLowerCase()] ??
    FEATURED_CONFIG.fallbackCategoryMeta
  );
}

function setupListerUI(
  listerTemplate: HTMLTemplateElement,
  category: string,
  injectionTarget: HTMLElement,
  listerId: string,
  mediaConfig: MediaTypeConfig,
): ListerElements {
  const clone = listerTemplate.content.cloneNode(true) as DocumentFragment;

  // Outer container
  const root = clone.firstElementChild as HTMLElement | null;

  if (!root) {
    throw new Error("Lister template root not found.");
  }

  root.id = listerId;

  const svgEl = root.querySelector<HTMLElement>(
    mediaConfig.selectors.listerSVG,
  );
  const titleEl = root.querySelector<HTMLElement>(
    mediaConfig.selectors.listerTitle,
  );
  const descEl = root.querySelector<HTMLElement>(
    mediaConfig.selectors.listerDesc,
  );
  const cardGrid = root.querySelector<HTMLElement>(
    mediaConfig.selectors.cardGrid,
  );

  if (!cardGrid) {
    throw new Error(
      `Critical: ${mediaConfig.selectors.cardGrid} not found for prefix "${mediaConfig.idPrefix}".`,
    );
  }

  const meta = getCategoryMeta(category);

  if (svgEl) svgEl.textContent = meta.icon;

  if (titleEl) {
    titleEl.textContent = category;
    if ("titleData" in meta) {
      titleEl.setAttribute("data-i18n", meta.titleData!);
    }
  }

  if (descEl) {
    descEl.textContent = meta.desc;
    if ("descData" in meta) {
      descEl.setAttribute("data-i18n", meta.descData!);
    }
  }

  cardGrid.replaceChildren();

  injectionTarget.appendChild(root);

  return { cardGrid };
}

// ─── CARD RENDERING ──────────────────────────────────────────────────────────

function populateCard<T>(
  clone: DocumentFragment,
  entry: MediaEntry<T>,
  cardSelectors: MediaCardSelectors,
  infoHandler: string,
): void {
  const s = cardSelectors;
  const { id, root, data } = entry as unknown as MediaEntry<MediaInfo>;

  const coverImg = clone.querySelector<HTMLImageElement>(s.cover);
  const titleEl = clone.querySelector<HTMLElement>(s.title);
  const ratingEl = clone.querySelector<HTMLElement>(s.rating);
  const descEl = clone.querySelector<HTMLElement>(s.desc);
  const authorEl = clone.querySelector<HTMLElement>(s.author);
  const infoBtn = clone.querySelector<HTMLElement>(s.infoBtn);

  if (coverImg) coverImg.src = `${root}/cover.webp`;
  if (titleEl)
    titleEl.textContent = data.title || FEATURED_CONFIG.defaults.title;
  if (descEl) descEl.textContent = data.desc || FEATURED_CONFIG.defaults.desc;
  if (ratingEl)
    ratingEl.textContent = data.meta?.rating || FEATURED_CONFIG.defaults.rating;
  if (authorEl)
    authorEl.textContent = data.author || FEATURED_CONFIG.defaults.author;
  if (infoBtn) infoBtn.setAttribute("onclick", `${infoHandler}('${id}')`);

  if (!data.title) console.warn(`[FH] Missing title for [${id}]`);
  if (!data.desc) console.warn(`[FH] Missing desc for [${id}]`);
  if (!data.meta?.rating) console.warn(`[FH] Missing rating for [${id}]`);
  if (!data.author) console.warn(`[FH] Missing author for [${id}]`);
}

function renderCard<T>(
  entry: MediaEntry<T>,
  grid: HTMLElement,
  cardTemplate: HTMLTemplateElement,
  mediaConfig: MediaTypeConfig,
): void {
  const clone = cardTemplate.content.cloneNode(true) as DocumentFragment;
  populateCard(
    clone,
    entry,
    mediaConfig.selectors.card,
    mediaConfig.infoHandler,
  );
  grid.appendChild(clone);
}

// ─── DATA FETCHING ───────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size)
    chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function fetchAllMediaEntries<T>(
  idMap: Record<string, string>,
): Promise<MediaEntry<T>[]> {
  const pairs = Object.entries(idMap);
  const chunks = chunkArray(pairs, FEATURED_CONFIG.batch.concurrency);
  const results: MediaEntry<T>[] = [];

  for (const chunk of chunks) {
    const settled = await Promise.allSettled(
      chunk.map(async ([id, root]) => {
        const data = await fetchJSON<T>(`${root}/information.json`);
        return { id, root, data } satisfies MediaEntry<T>;
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

// ─── LISTER RUNNER ───────────────────────────────────────────────────────────

/**
 * Runs the full fetch -> group -> render pipeline for a single media type
 * (anime or manga). The card template is passed in rather than resolved
 * per-media-type, since manga intentionally reuses the anime card template.
 */
async function runFeaturedLister<T>(
  mediaConfig: MediaTypeConfig,
  cardTemplate: HTMLTemplateElement,
): Promise<void> {
  const listerTemplate = document.getElementById(
    mediaConfig.selectors.listerTemplate,
  ) as HTMLTemplateElement | null;
  const injectionTarget = document.getElementById(
    mediaConfig.selectors.injectionTarget,
  );

  if (!listerTemplate || !injectionTarget) {
    console.error(
      `[FH] Critical: listerTemplate or injectionTarget not found for "${mediaConfig.idPrefix}".`,
    );
    return;
  }

  const idMap = await fetchMediaDatabase(mediaConfig.database.path);
  const fetchedEntries = await fetchAllMediaEntries<T>(idMap);

  // Adult Content gate: entries are dropped here, before grouping/rendering,
  // so disallowed content never touches the category map, the DOM,
  // or the card template at all — not fetched-then-hidden, just skipped.
  const allEntries = filterByNsfwSetting(fetchedEntries);

  if (allEntries.length === 0) {
    console.warn(`[FH] No valid content found for "${mediaConfig.idPrefix}".`);
    return;
  }

  const grouped = groupByCategory(allEntries);

  for (const [category, entries] of grouped) {
    try {
      const listerId = generateListerID(mediaConfig.idPrefix, category);

      // INTERCEPTOR MERGING GUARD: Scopes layout lookups directly to specific instances.
      // If a duplicate event gets past our guards, it appends cleanly into the matched category
      // layout block instead of overflowing or creating structural loops inside the layout tree.
      let existingLister = document.getElementById(listerId);
      let cardGrid: HTMLElement | null = null;

      if (existingLister) {
        cardGrid = existingLister.querySelector<HTMLElement>(
          mediaConfig.selectors.cardGrid,
        );
      } else {
        const ui = setupListerUI(
          listerTemplate,
          category,
          injectionTarget,
          listerId,
          mediaConfig,
        );
        cardGrid = ui.cardGrid;
      }

      if (cardGrid) {
        for (const entry of entries) {
          renderCard(entry, cardGrid, cardTemplate, mediaConfig);
        }
      }
    } catch (e) {
      console.error(
        `[FH] Failed to setup lister for category "${category}" (${mediaConfig.idPrefix}):`,
        e,
      );
    }
  }
}

// ─── INIT ────────────────────────────────────────────────────────────────────

let isRunning = false;

function clearInjectedListers(): void {
  console.log(
    `[DEBUG: featuredHandler] clearInjectedListers() called — wiping previous DOM.`,
  );
  for (const mediaConfig of Object.values(FEATURED_CONFIG.media)) {
    const target = document.getElementById(
      mediaConfig.selectors.injectionTarget,
    );
    if (target) {
      console.log(
        `[DEBUG: featuredHandler] clearing #${mediaConfig.selectors.injectionTarget} (${target.children.length} children removed)`,
      );
      target.replaceChildren();
    } else {
      console.warn(
        `[DEBUG: featuredHandler] clearInjectedListers() couldn't find #${mediaConfig.selectors.injectionTarget}`,
      );
    }
  }
}

async function initFeaturedListers(): Promise<void> {
  console.log(
    `[DEBUG: featuredHandler] initFeaturedListers() called. isRunning=${isRunning}`,
  );
  if (isRunning) {
    console.warn(`[DEBUG: featuredHandler] Skipped — already running.`);
    return;
  }
  isRunning = true;

  LoadingManager.show("Loading...");

  try {
    const animeListerTemplate = document.getElementById(
      FEATURED_CONFIG.media.anime.selectors.listerTemplate,
    ) as HTMLTemplateElement | null;

    if (!animeListerTemplate) {
      throw new Error("Critical: animeLister template not found in DOM.");
    }

    const cardTemplate = extractCardTemplate(
      animeListerTemplate,
      FEATURED_CONFIG.media.anime.selectors.cardTemplate,
    );

    const results = await Promise.allSettled([
      runFeaturedLister<AnimeInfo>(FEATURED_CONFIG.media.anime, cardTemplate),
      runFeaturedLister<MangaInfo>(FEATURED_CONFIG.media.manga, cardTemplate),
    ]);

    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[FH] A media lister failed to run:", result.reason);
      }
    }

    console.log(
      `[DEBUG: featuredHandler] initFeaturedListers() completed successfully.`,
    );
    LoadingManager.hide();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to initialize. Please try again later.";
    console.error(
      `[DEBUG: featuredHandler] initFeaturedListers() threw:`,
      error,
    );
    LoadingManager.setError(message);
  } finally {
    isRunning = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log(`[DEBUG: featuredHandler] DOMContentLoaded fired.`);
  initFeaturedListers();
});

document.addEventListener("astro:after-swap", () => {
  console.log(`[DEBUG: featuredHandler] astro:after-swap fired.`);
  clearInjectedListers();
  initFeaturedListers();
});

document.addEventListener("toggleChanged", (e) => {
  const action = (e as CustomEvent).detail?.action;
  console.log(
    `[DEBUG: featuredHandler] toggleChanged fired, action="${action}"`,
  );
  if (action === "toggleNSFW") {
    console.log(
      `[DEBUG: featuredHandler] toggleNSFW detected, forcing re-render.`,
    );
    clearInjectedListers();
    initFeaturedListers();
  }
});
