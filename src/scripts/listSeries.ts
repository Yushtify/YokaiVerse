/**
 * listSeries.ts — Modular Hierarchical Unit & Sub-Unit Renderer (v4: Anime/Manga Dual-Mode)
 *
 * Architecture:
 * - DEBUG: Centralized logging (ERROR, WARN, INFO, DEBUG)
 * - CONFIG: Configurable constants (UI classes, shared selectors, discovery limits)
 * - MODE: Anime ("season"/"episode", video-duration based) and Manga
 *   ("volume"/"chapter", page-count based) each get their own folder prefixes
 *   and DOM ids. Mode is auto-detected from the series' own information.json
 *   (`series.manga` / `series.anime`), or can be passed explicitly to skip
 *   the extra fetch if the caller already has that data.
 * - RENDERERS: Unit (season/volume), Sub-Unit Card (episode/chapter) rendering
 * - MANAGERS: Styling, State, Metadata management
 * - EXPORTS: Public API (listSeries, switchSeason/switchVolume/switchUnit, setActiveCard)
 */

// ─── DEBUG LOGGING ────────────────────────────────────────────────────────────

enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
}

class Logger {
  private level = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(msgLevel: LogLevel): boolean {
    const levels = [
      LogLevel.ERROR,
      LogLevel.WARN,
      LogLevel.INFO,
      LogLevel.DEBUG,
    ];
    return levels.indexOf(msgLevel) <= levels.indexOf(this.level);
  }

  error(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.ERROR))
      console.error(`[listSeries ERROR] ${message}`, data ?? "");
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN))
      console.warn(`[listSeries WARN] ${message}`, data ?? "");
  }

  info(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO))
      console.info(`[listSeries INFO] ${message}`, data ?? "");
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG))
      console.log(`[listSeries DEBUG] ${message}`, data ?? "");
  }
}

const logger = new Logger();
(window as any).listSeriesLogger = logger;

// ─── MODE TYPES ──────────────────────────────────────────────────────────────

type SeriesMode = "anime" | "manga";

interface ModeUnitSelectors {
  number: string;
  title: string;
  desc: string;
  rating: string;
  cover: string;
}

interface ModeSelectors {
  mainWrapper: string;
  unitSwitch: string;
  unitContainerTemplate: string;
  unitRadioTemplate: string;
  unit: ModeUnitSelectors;
}

interface ModeConfig {
  mode: SeriesMode;
  unitFolderPrefix: string; // "season_" | "volume_"
  subUnitFolderPrefix: string; // "ep_" | "ch_"
  unitDomIdPrefix: string; // "season_" | "volume_"
  unitRadioGroup: string; // "seasonSwitchers" | "volumeSwitchers"
  containerIdPrefix: string; // "listAnime_Season_" | "listManga_Volume_"
  hasVideoDuration: boolean;
  subUnitVideoFile?: string;
  selectors: ModeSelectors;
}

const MODE_CONFIGS: Record<SeriesMode, ModeConfig> = {
  anime: {
    mode: "anime",
    unitFolderPrefix: "season_",
    subUnitFolderPrefix: "ep_",
    unitDomIdPrefix: "season_",
    unitRadioGroup: "seasonSwitchers",
    containerIdPrefix: "listAnime_Season_",
    hasVideoDuration: true,
    subUnitVideoFile: "video/144p.webm",
    selectors: {
      mainWrapper: "animeWrapper",
      unitSwitch: "animeSeasonSwitcher",
      unitContainerTemplate: "animeSeasonWrapper_Template",
      unitRadioTemplate: "animeSeasonRadio_Template",
      unit: {
        number: "#seasonNumber",
        title: "#seasonTitle",
        desc: "#seasonDesc",
        rating: "#seasonRating",
        cover: "#seasonCover",
      },
    },
  },
  manga: {
    mode: "manga",
    unitFolderPrefix: "volume_",
    subUnitFolderPrefix: "ch_",
    unitDomIdPrefix: "volume_",
    unitRadioGroup: "volumeSwitchers",
    containerIdPrefix: "listManga_Volume_",
    hasVideoDuration: false,
    selectors: {
      mainWrapper: "mangaWrapper",
      unitSwitch: "mangaVolumeSwitcher",
      unitContainerTemplate: "mangaVolumeWrapper_Template",
      unitRadioTemplate: "mangaVolumeRadio_Template",
      // NOTE: the shared SeasonSwithcer.astro component renders the same
      // fixed ids (#seasonNumber, #seasonTitle, etc.) regardless of mode —
      // it does not parameterize these by givenID. So manga intentionally
      // targets the same ids anime does here, not "#volumeNumber" etc.
      unit: {
        number: "#seasonNumber",
        title: "#seasonTitle",
        desc: "#seasonDesc",
        rating: "#seasonRating",
        cover: "#seasonCover",
      },
    },
  },
};

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Selectors/paths shared by BOTH modes. Sub-unit cards (episode/chapter) and
// the content banner texts are intentionally reused as-is across anime and
// manga pages, the same way manga reuses the anime card template elsewhere.

interface UIConfig {
  unitActiveClass: string;
  unitDeactiveClass: string;
  textDefaultClasses: string[];
  cardActiveClasses: string[];
}

interface SharedSelectorConfig {
  subUnitTemplate: string;
  subUnitCard: string;
  subUnitCover: string;
  subUnitTitle: string;
  subUnitDesc: string;
  subUnitMetric: string;
  subUnitCount: string;
  contentSubUnitCountText: string;
  contentMetricText: string;
  contentMetricBannerText: string;
}

interface SharedPathConfig {
  infoFile: string;
  coverFile: string;
}

const CONFIG = {
  UI: {
    unitActiveClass:
      "group relative flex flex-row items-center justify-start aspect-2/3 min-w-32 w-full max-w-32 md:max-w-48 h-auto gap-2 rounded-3xl cursor-pointer ring-2 ring-Accent",
    unitDeactiveClass:
      "group relative flex flex-row items-center justify-start aspect-2/3 min-w-32 w-full max-w-32 md:max-w-48 h-auto gap-2 rounded-3xl cursor-pointer",
    textDefaultClasses: ["text-LT_Primary", "dark:text-DT_Primary"],
    cardActiveClasses: ["border-2", "border-Accent"],
  } as UIConfig,

  SELECTORS: {
    subUnitTemplate: "episodeCard_Template",
    subUnitCard: "episodeCard",
    subUnitCover: "episodeCover",
    subUnitTitle: "episodeTitle",
    subUnitDesc: "episodeDesc",
    subUnitMetric: "episodeDuration",
    subUnitCount: "episodeCount",
    contentSubUnitCountText: "contentEpisodes_Text",
    contentMetricText: "contentDuration_Text",
    contentMetricBannerText: "contentDuration_BannerText",
  } as SharedSelectorConfig,

  PATHS: {
    infoFile: "information.json",
    coverFile: "cover.webp",
  } as SharedPathConfig,

  TIMEOUTS: {
    subUnitMetric: 5000,
    fetchJson: 5000,
  },

  DISCOVERY: {
    maxUnits: 100,
    maxSubUnits: 10000,
  },
} as const;

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface listSeriesOptions {
  root: string;
  onEpisodeClick: (unitIndex: number, subUnitIndex: number) => void;
  activeSeason?: number;
  activeEpisode?: number;
  cardIdPrefix?: string;
  debugLevel?: LogLevel;
  // Optional explicit mode override — skips auto-detection entirely.
  mode?: SeriesMode;
  // Optional pre-fetched series flags (e.g. from information.json's `series`
  // field) to avoid an extra fetch if the caller already has this data.
  seriesFlags?: { anime?: boolean; manga?: boolean; movie?: boolean };
}

interface Unit {
  index: number;
  data: any;
}

interface SubUnit {
  index: number;
  data: any;
}

// ─── MODE RESOLUTION ─────────────────────────────────────────────────────────

/**
 * Determines whether this series is anime or manga. Resolution order:
 * 1. Explicit `mode` override (no fetch).
 * 2. Pre-fetched `seriesFlags` (no fetch).
 * 3. Auto-detected by fetching the root's own information.json and reading
 *    its `series.manga` / `series.anime` flags.
 * Falls back to "anime" if nothing is conclusive.
 */
async function resolveSeriesMode(
  root: string,
  explicitMode?: SeriesMode,
  seriesFlags?: { anime?: boolean; manga?: boolean },
): Promise<SeriesMode> {
  if (explicitMode) {
    logger.debug(`Mode explicitly set: ${explicitMode}`);
    return explicitMode;
  }

  if (seriesFlags) {
    if (seriesFlags.manga === true) return "manga";
    if (seriesFlags.anime === true) return "anime";
  }

  logger.debug(
    `No explicit mode/seriesFlags given, auto-detecting from root information.json`,
  );
  const data = await fetchJson(`${root}/${CONFIG.PATHS.infoFile}`);
  const detected: SeriesMode = data?.series?.manga === true ? "manga" : "anime";
  logger.info(`Auto-detected series mode: ${detected}`);
  return detected;
}

// ─── METRIC CACHE ────────────────────────────────────────────────────────────
// Caches either video duration (anime) or page count (manga) per sub-unit URL/key.

class MetricCache {
  private cache = new Map<string, number>();

  set(key: string, value: number): void {
    this.cache.set(key, value);
  }

  get(key: string): number | undefined {
    return this.cache.get(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const metricCache = new MetricCache();

// ─── FETCH UTILITIES ─────────────────────────────────────────────────────────

async function fetchJson(
  url: string,
  timeout = CONFIG.TIMEOUTS.fetchJson,
): Promise<any | null> {
  try {
    logger.debug(`Fetching JSON from: ${url}`);
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutHandle);

    if (!response.ok) {
      logger.warn(`Fetch failed with status ${response.status}: ${url}`);
      return null;
    }

    const data = await response.json();
    logger.debug(`JSON fetch successful: ${url}`, data);
    return data;
  } catch (error) {
    logger.error(`Fetch error for ${url}`, error);
    return null;
  }
}

// ─── VIDEO DURATION HANDLER (anime only) ─────────────────────────────────────

class VideoDurationHandler {
  static async getAsync(
    url: string,
    onReady: (duration: number) => void,
    timeout = CONFIG.TIMEOUTS.subUnitMetric,
  ): Promise<void> {
    if (!url || url.endsWith("/videoundefined") || url.endsWith("/videonull")) {
      logger.warn(`Invalid video URL: ${url}`);
      onReady(0);
      return;
    }

    if (metricCache.has(url)) {
      logger.debug(`Duration cache hit: ${url}`);
      onReady(metricCache.get(url)!);
      return;
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    let settled = false;

    const settle = (duration: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.src = "";
      video.load();
      video.remove();
      logger.debug(`Video duration resolved: ${url} → ${duration}s`);
      onReady(duration);
    };

    const timer = setTimeout(() => {
      logger.warn(`Video duration timeout: ${url}`);
      settle(0);
    }, timeout);

    video.addEventListener(
      "loadedmetadata",
      () => {
        metricCache.set(url, video.duration);
        settle(video.duration);
      },
      { once: true },
    );

    video.addEventListener(
      "error",
      () => {
        const mediaError = video.error;
        logger.error(`Video load error: ${url}`, {
          code: mediaError?.code,
          message: mediaError?.message || "no MediaError message provided",
        });
        settle(0);
      },
      { once: true },
    );

    video.src = url;
  }
}

// ─── DISCOVERY UTILITIES ─────────────────────────────────────────────────────

async function discoverUnits(
  root: string,
  modeConfig: ModeConfig,
): Promise<Unit[]> {
  logger.info(`Discovering ${modeConfig.mode} units from: ${root}`);
  const results: Unit[] = [];
  let i = 1;

  while (i <= CONFIG.DISCOVERY.maxUnits) {
    const unitPath = `${root}/${modeConfig.unitFolderPrefix}${i}`;
    const data = await fetchJson(`${unitPath}/${CONFIG.PATHS.infoFile}`);
    if (data === null || data === undefined) {
      logger.debug(`Unit ${i} not found, stopping discovery`);
      break;
    }
    results.push({ index: i, data });
    logger.debug(`Unit ${i} discovered`, data);
    i++;
  }

  logger.info(`Total units discovered: ${results.length}`);
  return results;
}

async function discoverSubUnits(
  unitPath: string,
  modeConfig: ModeConfig,
): Promise<SubUnit[]> {
  logger.debug(`Discovering sub-units from: ${unitPath}`);
  const subUnits: SubUnit[] = [];
  let i = 1;

  while (i <= CONFIG.DISCOVERY.maxSubUnits) {
    const subUnitPath = `${unitPath}/${modeConfig.subUnitFolderPrefix}${i}`;
    const data = await fetchJson(`${subUnitPath}/${CONFIG.PATHS.infoFile}`);
    if (data === null || data === undefined) {
      logger.debug(`Sub-unit ${i} not found, stopping discovery`);
      break;
    }
    subUnits.push({ index: i, data });
    i++;
  }

  logger.debug(`Total sub-units in unit: ${subUnits.length}`);
  return subUnits;
}

// ─── STYLING MANAGER ─────────────────────────────────────────────────────────

class StylingManager {
  static applyUnitButtonStyles(
    radioBtn: HTMLButtonElement,
    isActive: boolean,
    unitId: number,
    modeConfig: ModeConfig,
  ): void {
    const activeClass =
      radioBtn.getAttribute("data-active-class") ?? CONFIG.UI.unitActiveClass;
    const deactiveClass =
      radioBtn.getAttribute("data-deactive-class") ??
      CONFIG.UI.unitDeactiveClass;

    radioBtn.className = isActive ? activeClass : deactiveClass;
    logger.debug(`Unit ${unitId} button styles applied (active: ${isActive})`);

    const icon = radioBtn.querySelector<HTMLSpanElement>("#googleSymbol");
    if (icon) icon.classList.toggle("icon-fill", isActive);

    const unitCover = radioBtn.querySelector<HTMLImageElement>(
      modeConfig.selectors.unit.cover,
    );
    const gradientBg = radioBtn.querySelector<HTMLElement>("#gradientBG");

    if (isActive) {
      unitCover?.classList.add("border-Accent!");
      gradientBg?.classList.add("from-Accent!");
    } else {
      unitCover?.classList.remove("border-Accent!");
      gradientBg?.classList.remove("from-Accent!");
    }
  }

  static setActiveCard(
    unitIndex: number,
    subUnitIndex: number,
    cardIdPrefix: string,
  ): void {
    logger.debug(
      `Setting active card: unit ${unitIndex}, sub-unit ${subUnitIndex}`,
    );

    // Target selector matching both camelCase and kebab-case dataset attributes
    const targetSelector = "[data-active-class], [data-activeclass]";

    // Remove active classes from every card and its children
    document
      .querySelectorAll<HTMLElement>(`[id^='${cardIdPrefix}_']`)
      .forEach((card) => {
        // Include the card itself along with its children that match the target selector
        const elements = [
          card,
          ...Array.from(card.querySelectorAll<HTMLElement>(targetSelector)),
        ];

        elements.forEach((el) => {
          // Safely resolve attribute value regardless of DOM casing
          const rawActiveClasses =
            el.dataset.activeClass || el.dataset.activeclass;

          if (rawActiveClasses) {
            const classes = rawActiveClasses.split(" ").filter(Boolean);
            if (classes.length) {
              // Spread array values into classList.remove to handle multi-class strings
              el.classList.remove(...classes);
            }
          }
        });
      });

    // Find active card
    const activeCard = document.getElementById(
      `${cardIdPrefix}_s${unitIndex}_ep${subUnitIndex}`,
    ) as HTMLButtonElement;

    if (!activeCard) {
      logger.warn(
        `Active card not found: ${cardIdPrefix}_s${unitIndex}_ep${subUnitIndex}`,
      );
      return;
    }

    // Apply active classes from data-active-class to the active card and its children
    const activeElements = [
      activeCard,
      ...Array.from(activeCard.querySelectorAll<HTMLElement>(targetSelector)),
    ];

    activeElements.forEach((el) => {
      const rawActiveClasses = el.dataset.activeClass || el.dataset.activeclass;

      if (rawActiveClasses) {
        const classes = rawActiveClasses.split(" ").filter(Boolean);
        if (classes.length) {
          // Spread array values into classList.add to handle multi-class strings
          el.classList.add(...classes);
        }
      }
    });

    logger.debug("Active card styling applied");
  }
}

// ─── UNIT RENDERER (season/volume radio buttons) ─────────────────────────────

class UnitRenderer {
  static render(
    unit: Unit,
    modeConfig: ModeConfig,
    unitSwitch: HTMLElement | null,
    radioTemplate: HTMLTemplateElement | null,
    root: string,
  ): void {
    if (!unitSwitch || !radioTemplate) {
      logger.warn(`Unit renderer: missing unitSwitch or radioTemplate`);
      return;
    }

    const { index: uid, data: uData } = unit;
    const unitPath = `${root}/${modeConfig.unitFolderPrefix}${uid}`;
    const s = modeConfig.selectors.unit;

    const radioFragment = radioTemplate.content.cloneNode(
      true,
    ) as DocumentFragment;
    const radioBtn = radioFragment.querySelector<HTMLButtonElement>("button");

    if (!radioBtn) {
      logger.error(`Unit radio button not found in template`);
      return;
    }

    radioBtn.id = `${modeConfig.unitDomIdPrefix}${uid}`;
    radioBtn.dataset.radgroup = modeConfig.unitRadioGroup;
    radioBtn.dataset.radstate = uid === 1 ? "true" : "false";
    radioBtn.dataset.candisabled = "false";

    // Apply the template's active classes if the first unit starts active
    if (uid === 1 && radioBtn.dataset.radactive) {
      const activeClasses = radioBtn.dataset.radactive
        .split(" ")
        .filter(Boolean);
      radioBtn.classList.add(...activeClasses);
    }

    const numberEl = radioBtn.querySelector<HTMLElement>(s.number);
    if (numberEl) numberEl.innerText = `${uid}`;

    const titleEl = radioBtn.querySelector<HTMLElement>(s.title);
    if (titleEl)
      titleEl.innerText =
        uData.title ??
        (modeConfig.mode === "manga" ? `Volume ${uid}` : `Season ${uid}`);

    const descEl = radioBtn.querySelector<HTMLElement>(s.desc);
    if (descEl) descEl.innerText = uData.desc ?? "";

    const ratingEl = radioBtn.querySelector<HTMLElement>(s.rating);
    if (ratingEl) ratingEl.innerText = uData.meta?.rating ?? "Not rated";

    const coverEl = radioBtn.querySelector<HTMLImageElement>(s.cover);
    if (coverEl) {
      coverEl.addEventListener(
        "error",
        () => {
          logger.warn(
            `Unit cover failed, using fallback: ${root}/${CONFIG.PATHS.coverFile}`,
          );
          coverEl.src = `${root}/${CONFIG.PATHS.coverFile}`;
        },
        { once: true },
      );
      coverEl.src = `${unitPath}/${CONFIG.PATHS.coverFile}`;
    }

    radioBtn.addEventListener("click", () => {
      logger.debug(`Unit ${uid} clicked`);
      switchUnit(uid, modeConfig);
    });

    unitSwitch.appendChild(radioFragment);
    logger.debug(`Unit ${uid} rendered`);
  }
}

// ─── SUB-UNIT CARD RENDERER (episode/chapter) ────────────────────────────────

class SubUnitCardRenderer {
  static render(
    subUnit: SubUnit,
    unit: Unit,
    unitPath: string,
    modeConfig: ModeConfig,
    subUnitTemplate: HTMLTemplateElement | null,
    container: HTMLElement,
    onEpisodeClick: (unitIndex: number, subUnitIndex: number) => void,
    cardIdPrefix: string,
    globalSubUnitCount: number,
    onMetricReady: (metric: number) => void,
  ): void {
    if (!subUnitTemplate) {
      logger.warn(`Sub-unit card renderer: template is null`);
      return;
    }

    const { index: subIndex, data: subData } = subUnit;
    const { index: uid } = unit;
    const subUnitPath = `${unitPath}/${modeConfig.subUnitFolderPrefix}${subIndex}`;

    const cardFragment = subUnitTemplate.content.cloneNode(
      true,
    ) as DocumentFragment;

    const cardBtn = cardFragment.querySelector<HTMLButtonElement>(
      `#${CONFIG.SELECTORS.subUnitCard}`,
    );

    if (!cardBtn) {
      logger.error(`Sub-unit card button not found in template`);
      return;
    }

    cardBtn.id = `${cardIdPrefix}_s${uid}_ep${subIndex}`;
    cardBtn.removeAttribute("onclick");

    const cover = cardBtn.querySelector<HTMLImageElement>(
      `#${CONFIG.SELECTORS.subUnitCover}`,
    );
    const title = cardBtn.querySelector<HTMLParagraphElement>(
      `#${CONFIG.SELECTORS.subUnitTitle}`,
    );
    const desc = cardBtn.querySelector<HTMLParagraphElement>(
      `#${CONFIG.SELECTORS.subUnitDesc}`,
    );
    const metricEl = cardBtn.querySelector<HTMLParagraphElement>(
      `#${CONFIG.SELECTORS.subUnitMetric}`,
    );
    const countText = cardBtn.querySelector<HTMLParagraphElement>(
      `#${CONFIG.SELECTORS.subUnitCount}`,
    );

    if (cover) cover.src = `${subUnitPath}/${CONFIG.PATHS.coverFile}`;
    // Chapter titles may use a different field name than episode titles —
    // adjust `chapterName` below if the actual manga info.json schema differs.
    if (title)
      title.innerText =
        subData.episodeName ??
        subData.chapterName ??
        subData.title ??
        "Unknown";
    if (desc) desc.innerText = subData.desc ?? "No description";
    if (countText) countText.textContent = `${globalSubUnitCount}`;

    if (metricEl) {
      metricEl.classList.add(...CONFIG.UI.textDefaultClasses);

      if (modeConfig.hasVideoDuration && modeConfig.subUnitVideoFile) {
        metricEl.innerText = "—:——";
        const videoURL = `${subUnitPath}/${modeConfig.subUnitVideoFile}`;
        VideoDurationHandler.getAsync(videoURL, (duration) => {
          metricEl.innerText = FormatUtils.formatTimestamp(duration);
          onMetricReady(duration);
          logger.debug(`Sub-unit ${subIndex} duration: ${duration}s`);
        });
      } else {
        // Manga mode: no video to probe. Use the page count declared in the
        // chapter's own information.json instead (falls back to 0 if missing).
        // Adjust the field name below (`pages`/`pageCount`) to match the
        // actual schema once chapter info.json files are finalized.
        const pageCount = subData?.pages ?? subData?.pageCount ?? 0;
        metricEl.innerText = `${pageCount}p`;
        onMetricReady(pageCount);
        logger.debug(`Sub-unit ${subIndex} page count: ${pageCount}`);
      }
    } else {
      onMetricReady(0);
    }

    cardBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logger.debug(`Sub-unit clicked: unit ${uid}, sub-unit ${subIndex}`);
      onEpisodeClick(uid, subIndex);
    });

    container.appendChild(cardFragment);
    logger.debug(`Sub-unit ${subIndex} card rendered`);
  }
}

// ─── FORMAT UTILITIES ─────────────────────────────────────────────────────────

class FormatUtils {
  static formatTimestamp(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ss = String(sec).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
  }

  static formatReadable(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  static formatTotalMetric(value: number, modeConfig: ModeConfig): string {
    return modeConfig.hasVideoDuration
      ? FormatUtils.formatReadable(value)
      : `${value} page${value !== 1 ? "s" : ""}`;
  }
}

// ─── METADATA MANAGER ─────────────────────────────────────────────────────────

class MetadataManager {
  static update(
    totalMetric: number,
    count: number,
    modeConfig: ModeConfig,
  ): void {
    const countTextEl = document.getElementById(
      CONFIG.SELECTORS.contentSubUnitCountText,
    );
    const metricTextEl = document.getElementById(
      CONFIG.SELECTORS.contentMetricText,
    );
    const metricBannerTextEl = document.getElementById(
      CONFIG.SELECTORS.contentMetricBannerText,
    );

    const metricText = FormatUtils.formatTotalMetric(totalMetric, modeConfig);
    const countText = `${count}`;

    if (countTextEl) countTextEl.innerText = countText;
    if (metricTextEl) metricTextEl.innerText = metricText;
    if (metricBannerTextEl) metricBannerTextEl.innerText = metricText;

    logger.info(`Metadata updated: ${countText}, ${metricText}`);
  }
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

// Tracks the mode of the most recently rendered series, so exported functions
// like switchSeason/setActiveCard (often invoked later from click handlers,
// sometimes via a bare window global) know which mode config to use without
// requiring every caller to pass it explicitly.
let currentModeConfig: ModeConfig = MODE_CONFIGS.anime;

export async function listSeries(options: listSeriesOptions): Promise<void> {
  const {
    root,
    onEpisodeClick,
    activeSeason,
    activeEpisode,
    cardIdPrefix = "episodeCard",
    debugLevel = LogLevel.INFO,
    mode,
    seriesFlags,
  } = options;

  logger.setLevel(debugLevel);

  const detectedMode = await resolveSeriesMode(root, mode, seriesFlags);
  const modeConfig = MODE_CONFIGS[detectedMode];
  currentModeConfig = modeConfig;

  logger.info(`listSeries initialized with root: ${root}`, {
    mode: detectedMode,
    cardIdPrefix,
    debugLevel,
  });

  const mainWrapper = document.getElementById(modeConfig.selectors.mainWrapper);
  const unitSwitch = document.getElementById(modeConfig.selectors.unitSwitch);
  const unitTemplate = document.getElementById(
    modeConfig.selectors.unitContainerTemplate,
  ) as HTMLTemplateElement | null;
  const radioTemplate = document.getElementById(
    modeConfig.selectors.unitRadioTemplate,
  ) as HTMLTemplateElement | null;
  const subUnitTemplate = document.getElementById(
    CONFIG.SELECTORS.subUnitTemplate,
  ) as HTMLTemplateElement | null;

  if (!mainWrapper || !unitTemplate || !subUnitTemplate) {
    logger.error(`Missing required DOM elements`, {
      mainWrapper: !!mainWrapper,
      unitTemplate: !!unitTemplate,
      subUnitTemplate: !!subUnitTemplate,
      mode: detectedMode,
    });
    return;
  }

  const units = await discoverUnits(root, modeConfig);
  if (units.length === 0) {
    logger.warn(`No units discovered from: ${root}`);
    return;
  }

  const allSubUnits = await Promise.all(
    units.map(({ index }) =>
      discoverSubUnits(
        `${root}/${modeConfig.unitFolderPrefix}${index}`,
        modeConfig,
      ),
    ),
  );

  logger.info(`Data discovery complete: ${units.length} units`);

  let totalMetric = 0;
  let globalSubUnitCount = 0;
  let pendingMetrics = 0;

  const totalSubUnitCount = allSubUnits.reduce(
    (sum, eps) => sum + eps.length,
    0,
  );

  const onMetricReady = (metric: number) => {
    totalMetric += metric;
    pendingMetrics--;
    if (pendingMetrics === 0) {
      MetadataManager.update(totalMetric, globalSubUnitCount, modeConfig);
    }
  };

  for (let ui = 0; ui < units.length; ui++) {
    const unit = units[ui];
    const { index: uid } = unit;
    const subUnits = allSubUnits[ui];
    const unitPath = `${root}/${modeConfig.unitFolderPrefix}${uid}`;

    UnitRenderer.render(unit, modeConfig, unitSwitch, radioTemplate, root);

    const unitFragment = unitTemplate.content.cloneNode(
      true,
    ) as DocumentFragment;
    const unitDiv = unitFragment.querySelector<HTMLElement>("div");

    if (!unitDiv) {
      logger.error(`Unit container div not found in template`);
      continue;
    }

    unitDiv.id = `${modeConfig.containerIdPrefix}${uid}`;
    if (uid !== 1) unitDiv.classList.add("hidden");
    mainWrapper.appendChild(unitFragment);

    const currentContainer = document.getElementById(
      `${modeConfig.containerIdPrefix}${uid}`,
    );
    if (!currentContainer) {
      logger.error(
        `Unit container not found after append: ${modeConfig.containerIdPrefix}${uid}`,
      );
      continue;
    }

    for (const subUnit of subUnits) {
      globalSubUnitCount++;
      pendingMetrics++;

      SubUnitCardRenderer.render(
        subUnit,
        unit,
        unitPath,
        modeConfig,
        subUnitTemplate,
        currentContainer,
        onEpisodeClick,
        cardIdPrefix,
        globalSubUnitCount,
        onMetricReady,
      );
      document.dispatchEvent(new Event("episodeCardsLoaded"));
    }
  }

  if (totalSubUnitCount === 0) {
    MetadataManager.update(0, 0, modeConfig);
  }

  // Dispatch a scoped custom event instead of the generic DOMContentLoaded to avoid retrigger loops
  document.dispatchEvent(new Event("initRadioButtons"));
  logger.debug(`Radio group custom init event dispatched`);

  if (activeSeason !== undefined && activeEpisode !== undefined) {
    logger.info(
      `Setting initial active card: unit ${activeSeason}, sub-unit ${activeEpisode}`,
    );
    setActiveCard(activeSeason, activeEpisode, cardIdPrefix);
  }

  logger.info(`listSeries rendering complete (mode: ${detectedMode})`);
}

// ─── UNIT SWITCHER ───────────────────────────────────────────────────────────

export function switchUnit(
  targetUnit: number,
  modeConfig: ModeConfig = currentModeConfig,
): void {
  logger.debug(`Switching to unit: ${targetUnit} (mode: ${modeConfig.mode})`);

  document
    .querySelectorAll(`[id^='${modeConfig.containerIdPrefix}']`)
    .forEach((el) => {
      el.classList.add("hidden");
    });

  const target = document.getElementById(
    `${modeConfig.containerIdPrefix}${targetUnit}`,
  );
  if (target) {
    target.classList.remove("hidden");
    logger.debug(
      `Unit container shown: ${modeConfig.containerIdPrefix}${targetUnit}`,
    );
  } else {
    logger.warn(
      `Unit container not found: ${modeConfig.containerIdPrefix}${targetUnit}`,
    );
  }
}

// Backward-compatible aliases: existing anime code (and onclick handlers) can
// keep calling switchSeason; manga code can call switchVolume. Both resolve
// to the same generic switchUnit, using the currently active mode.
export function switchSeason(targetSeason: number): void {
  switchUnit(targetSeason, MODE_CONFIGS.anime);
}

export function switchVolume(targetVolume: number): void {
  switchUnit(targetVolume, MODE_CONFIGS.manga);
}

(window as any).switchSeason = switchSeason;
(window as any).switchVolume = switchVolume;
(window as any).switchUnit = switchUnit;

// ─── ACTIVE CARD SETTER ──────────────────────────────────────────────────────

export function setActiveCard(
  unitIndex: number,
  subUnitIndex: number,
  cardIdPrefix = "episodeCard",
): void {
  logger.debug(
    `setActiveCard called: unit ${unitIndex}, sub-unit ${subUnitIndex}`,
  );
  StylingManager.setActiveCard(unitIndex, subUnitIndex, cardIdPrefix);
}

// ─── PUBLIC DEBUG API ────────────────────────────────────────────────────────

(window as any).listAnimeAPI = {
  setDebugLevel: (level: LogLevel) => logger.setLevel(level),
  clearDurationCache: () => metricCache.clear(),
  getLogger: () => logger,
};

// Generic alias, kept alongside listAnimeAPI for backward compatibility.
(window as any).listSeriesAPI = (window as any).listAnimeAPI;
