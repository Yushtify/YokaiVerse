/**
 * listAnime.ts — Modular Hierarchical Season & Episode Renderer (v3: Bugfix Pass)
 *
 * Architecture:
 * - DEBUG: Centralized logging (ERROR, WARN, INFO, DEBUG)
 * - CONFIG: Configurable constants (UI classes, selectors, paths)
 * - RENDERERS: Season, Episode Card rendering (separate concerns)
 * - MANAGERS: Styling, State, Metadata management
 * - EXPORTS: Public API (listAnime, switchSeason, setActiveCard)
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
      console.error(`[listAnime ERROR] ${message}`, data ?? "");
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN))
      console.warn(`[listAnime WARN] ${message}`, data ?? "");
  }

  info(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO))
      console.info(`[listAnime INFO] ${message}`, data ?? "");
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG))
      console.log(`[listAnime DEBUG] ${message}`, data ?? "");
  }
}

const logger = new Logger();
(window as any).listAnimeLogger = logger;

// ─── CONFIG ──────────────────────────────────────────────────────────────────

interface UIConfig {
  seasonActiveClass: string;
  seasonDeactiveClass: string;
  textDefaultClasses: string[];
  cardActiveClasses: string[];
}

interface SelectorConfig {
  mainWrapper: string;
  seasonSwitch: string;
  seasonContainerTemplate: string;
  seasonRadioTemplate: string;
  episodeTemplate: string;
  episodeCard: string;
  episodeCover: string;
  episodeTitle: string;
  episodeDesc: string;
  episodeDuration: string;
  episodeCount: string;
  contentEpisodesText: string;
  contentDurationText: string;
  contentDurationBannerText: string;
}

interface PathConfig {
  seasonInfoFile: string;
  episodeInfoFile: string;
  seasonCoverFile: string;
  episodeCoverFile: string;
  videoExtensionField: string;
}

const CONFIG = {
  UI: {
    seasonActiveClass:
      "group relative flex flex-row items-center justify-start aspect-2/3 min-w-32 w-full max-w-32 md:max-w-48 h-auto gap-2 rounded-3xl cursor-pointer ring-2 ring-Accent",
    seasonDeactiveClass:
      "group relative flex flex-row items-center justify-start aspect-2/3 min-w-32 w-full max-w-32 md:max-w-48 h-auto gap-2 rounded-3xl cursor-pointer",
    textDefaultClasses: ["text-LT_Primary", "dark:text-DT_Primary"],
    cardActiveClasses: ["border-2", "border-Accent"],
  } as UIConfig,

  SELECTORS: {
    mainWrapper: "season_main_wrapper",
    seasonSwitch: "seasonSwitch",
    seasonContainerTemplate: "Season_Container_Template",
    seasonRadioTemplate: "SeasonRadioTemplate",
    episodeTemplate: "episodeCard_Template",
    episodeCard: "episodeCard",
    episodeCover: "episodeCover",
    episodeTitle: "episodeTitle",
    episodeDesc: "episodeDesc",
    episodeDuration: "episodeDuration",
    episodeCount: "episodeCount",
    contentEpisodesText: "contentEpisodes_Text",
    contentDurationText: "contentDuration_Text",
    contentDurationBannerText: "contentDuration_BannerText",
  } as SelectorConfig,

  PATHS: {
    seasonInfoFile: "information.json",
    episodeInfoFile: "information.json",
    seasonCoverFile: "cover.webp",
    episodeCoverFile: "cover.webp",
    videoExtensionField: "videoType",
  } as PathConfig,

  TIMEOUTS: {
    episodeDuration: 5000,
    fetchJson: 5000,
  },

  DISCOVERY: {
    maxSeasons: 100,
    maxEpisodes: 10000,
  },
} as const;

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ListAnimeOptions {
  root: string;
  onEpisodeClick: (seasonIndex: number, epIndex: number) => void;
  activeSeason?: number;
  activeEpisode?: number;
  cardIdPrefix?: string;
  debugLevel?: LogLevel;
}

interface Season {
  index: number;
  data: any;
}

interface Episode {
  index: number;
  data: any;
}

// ─── DURATION CACHE ──────────────────────────────────────────────────────────

class DurationCache {
  private cache = new Map<string, number>();

  set(url: string, duration: number): void {
    this.cache.set(url, duration);
  }

  get(url: string): number | undefined {
    return this.cache.get(url);
  }

  has(url: string): boolean {
    return this.cache.has(url);
  }

  clear(): void {
    this.cache.clear();
  }
}

const durationCache = new DurationCache();

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

// ─── VIDEO DURATION HANDLER ──────────────────────────────────────────────────

class VideoDurationHandler {
  static async getAsync(
    url: string,
    onReady: (duration: number) => void,
    timeout = CONFIG.TIMEOUTS.episodeDuration,
  ): Promise<void> {
    if (!url || url.endsWith("/videoundefined") || url.endsWith("/videonull")) {
      logger.warn(`Invalid video URL: ${url}`);
      onReady(0);
      return;
    }

    if (durationCache.has(url)) {
      logger.debug(`Duration cache hit: ${url}`);
      onReady(durationCache.get(url)!);
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
        durationCache.set(url, video.duration);
        settle(video.duration);
      },
      { once: true },
    );

    video.addEventListener(
      "error",
      () => {
        logger.error(`Video load error: ${url}`);
        settle(0);
      },
      { once: true },
    );

    video.src = url;
  }
}

// ─── DISCOVERY UTILITIES ─────────────────────────────────────────────────────

async function discoverSeasons(root: string): Promise<Season[]> {
  logger.info(`Discovering seasons from: ${root}`);
  const results: Season[] = [];
  let i = 1;

  while (i <= CONFIG.DISCOVERY.maxSeasons) {
    const seasonPath = `${root}/season_${i}`;
    const data = await fetchJson(
      `${seasonPath}/${CONFIG.PATHS.seasonInfoFile}`,
    );
    if (data === null || data === undefined) {
      logger.debug(`Season ${i} not found, stopping discovery`);
      break;
    }
    results.push({ index: i, data });
    logger.debug(`Season ${i} discovered`, data);
    i++;
  }

  logger.info(`Total seasons discovered: ${results.length}`);
  return results;
}

async function discoverEpisodes(seasonPath: string): Promise<Episode[]> {
  logger.debug(`Discovering episodes from: ${seasonPath}`);
  const episodes: Episode[] = [];
  let i = 1;

  while (i <= CONFIG.DISCOVERY.maxEpisodes) {
    const episodePath = `${seasonPath}/ep_${i}`;
    const data = await fetchJson(
      `${episodePath}/${CONFIG.PATHS.episodeInfoFile}`,
    );
    if (data === null || data === undefined) {
      logger.debug(`Episode ${i} not found, stopping discovery`);
      break;
    }
    episodes.push({ index: i, data });
    i++;
  }

  logger.debug(`Total episodes in season: ${episodes.length}`);
  return episodes;
}

// ─── STYLING MANAGER ─────────────────────────────────────────────────────────

class StylingManager {
  static applySeasonButtonStyles(
    radioBtn: HTMLButtonElement,
    isActive: boolean,
    seasonId: number,
  ): void {
    const activeClass =
      radioBtn.getAttribute("data-active-class") ?? CONFIG.UI.seasonActiveClass;
    const deactiveClass =
      radioBtn.getAttribute("data-deactive-class") ??
      CONFIG.UI.seasonDeactiveClass;

    radioBtn.className = isActive ? activeClass : deactiveClass;
    logger.debug(
      `Season ${seasonId} button styles applied (active: ${isActive})`,
    );

    const icon = radioBtn.querySelector<HTMLSpanElement>("#googleSymbol");
    if (icon) icon.classList.toggle("icon-fill", isActive);

    const seasonCover =
      radioBtn.querySelector<HTMLImageElement>("#seasonCover");
    const gradientBg = radioBtn.querySelector<HTMLElement>("#gradientBG");

    if (isActive) {
      seasonCover?.classList.add("border-Accent!");
      gradientBg?.classList.add("from-Accent!");
    } else {
      seasonCover?.classList.remove("border-Accent!");
      gradientBg?.classList.remove("from-Accent!");
    }
  }

  static setActiveCard(
    seasonIndex: number,
    epIndex: number,
    cardIdPrefix: string,
  ): void {
    logger.debug(
      `Setting active card: season ${seasonIndex}, episode ${epIndex}`,
    );

    // Tüm kartlardan aktif sınıfları temizle
    document
      .querySelectorAll<HTMLElement>(`[id^='${cardIdPrefix}_']`)
      .forEach((card) => {
        const cardVidCover = card.querySelector<HTMLElement>(
          `#${CONFIG.SELECTORS.episodeCover}`,
        );

        CONFIG.UI.cardActiveClasses.forEach((cls) =>
          card.classList.remove(cls),
        );
        cardVidCover?.classList.remove("border-Accent!");
      });

    // Aktif card'ı bul ve vurgula
    const activeCard = document.getElementById(
      `${cardIdPrefix}_s${seasonIndex}_ep${epIndex}`,
    );

    if (!activeCard) {
      logger.warn(
        `Active card not found: ${cardIdPrefix}_s${seasonIndex}_ep${epIndex}`,
      );
      return;
    }

    const activeCardVidCover = activeCard.querySelector<HTMLElement>(
      `#${CONFIG.SELECTORS.episodeCover}`,
    );

    CONFIG.UI.cardActiveClasses.forEach((cls) => activeCard.classList.add(cls));
    activeCardVidCover?.classList.add("border-Accent!");

    logger.debug(`Active card styling applied`);
  }
}

// ─── SEASON RENDERER ─────────────────────────────────────────────────────────

class SeasonRenderer {
  static render(
    season: Season,
    seasonSwitch: HTMLElement | null,
    radioTemplate: HTMLTemplateElement | null,
    root: string,
  ): void {
    if (!seasonSwitch || !radioTemplate) {
      logger.warn(`Season renderer: missing seasonSwitch or radioTemplate`);
      return;
    }

    const { index: sid, data: sData } = season;
    const seasonPath = `${root}/season_${sid}`;

    const radioFragment = radioTemplate.content.cloneNode(
      true,
    ) as DocumentFragment;
    const radioBtn = radioFragment.querySelector<HTMLButtonElement>("button");

    if (!radioBtn) {
      logger.error(`Season radio button not found in template`);
      return;
    }

    radioBtn.id = `season_${sid}`;
    radioBtn.dataset.radgroup = "seasonSwitchers";
    radioBtn.dataset.radstate = sid === 1 ? "true" : "false";
    radioBtn.dataset.candisabled = "false";

    // İlk render'da 1. sezon aktifse şablondaki aktif sınıflarını uyguluyoruz
    if (sid === 1 && radioBtn.dataset.radactive) {
      const activeClasses = radioBtn.dataset.radactive
        .split(" ")
        .filter(Boolean);
      radioBtn.classList.add(...activeClasses);
    }

    const titleEl = radioBtn.querySelector<HTMLElement>("#seasonNumber");
    if (titleEl) titleEl.innerText = `${sid}`;

    const seasonTitleEl = radioBtn.querySelector<HTMLElement>("#seasonTitle");
    if (seasonTitleEl) seasonTitleEl.innerText = sData.title ?? `Season ${sid}`;

    const seasonDescEl = radioBtn.querySelector<HTMLElement>("#seasonDesc");
    if (seasonDescEl) seasonDescEl.innerText = sData.desc ?? "";

    const seasonRatingEl = radioBtn.querySelector<HTMLElement>("#seasonRating");
    if (seasonRatingEl)
      seasonRatingEl.innerText = sData.meta.rating ?? "Not rated";

    const seasonCover =
      radioBtn.querySelector<HTMLImageElement>("#seasonCover");
    if (seasonCover) {
      seasonCover.addEventListener(
        "error",
        () => {
          logger.warn(
            `Season cover failed, using fallback: ${root}/cover.webp`,
          );
          seasonCover.src = `${root}/${CONFIG.PATHS.seasonCoverFile}`;
        },
        { once: true },
      );
      seasonCover.src = `${seasonPath}/${CONFIG.PATHS.seasonCoverFile}`;
    }

    radioBtn.addEventListener("click", () => {
      logger.debug(`Season ${sid} clicked`);
      switchSeason(sid);
    });

    seasonSwitch.appendChild(radioFragment);
    logger.debug(`Season ${sid} rendered`);
  }
}

// ─── EPISODE CARD RENDERER ───────────────────────────────────────────────────

class EpisodeCardRenderer {
  static render(
    episode: Episode,
    season: Season,
    seasonPath: string,
    episodeTemplate: HTMLTemplateElement | null,
    container: HTMLElement,
    onEpisodeClick: (seasonIndex: number, epIndex: number) => void,
    cardIdPrefix: string,
    globalEpCount: number,
    onDurationReady: (duration: number) => void,
  ): void {
    if (!episodeTemplate) {
      logger.warn(`Episode card renderer: episodeTemplate is null`);
      return;
    }

    const { index: epIndex, data: epData } = episode;
    const { index: sid } = season;
    const epPath = `${seasonPath}/ep_${epIndex}`;

    const cardFragment = episodeTemplate.content.cloneNode(
      true,
    ) as DocumentFragment;

    const cardBtn = cardFragment.querySelector<HTMLButtonElement>(
      `#${CONFIG.SELECTORS.episodeCard}`,
    );

    if (!cardBtn) {
      logger.error(`Episode card button not found in template`);
      return;
    }

    cardBtn.id = `${cardIdPrefix}_s${sid}_ep${epIndex}`;
    cardBtn.removeAttribute("onclick");

    const cover = cardBtn.querySelector<HTMLImageElement>(
      `#${CONFIG.SELECTORS.episodeCover}`,
    );
    const title = cardBtn.querySelector<HTMLParagraphElement>(
      `#${CONFIG.SELECTORS.episodeTitle}`,
    );
    const desc = cardBtn.querySelector<HTMLParagraphElement>(
      `#${CONFIG.SELECTORS.episodeDesc}`,
    );
    const dur = cardBtn.querySelector<HTMLParagraphElement>(
      `#${CONFIG.SELECTORS.episodeDuration}`,
    );
    const epCountText = cardBtn.querySelector<HTMLParagraphElement>(
      `#${CONFIG.SELECTORS.episodeCount}`,
    );

    if (cover) cover.src = `${epPath}/${CONFIG.PATHS.episodeCoverFile}`;
    if (title) title.innerText = epData.episodeName ?? "Unknown";
    if (desc) desc.innerText = epData.desc ?? "No description";
    if (epCountText) {
      epCountText.innerText = `${globalEpCount}`;
      epCountText.classList.add(...CONFIG.UI.textDefaultClasses);
    }

    if (dur) {
      dur.innerText = "—:——";
      dur.classList.add(...CONFIG.UI.textDefaultClasses);

      const videoURL = epData[CONFIG.PATHS.videoExtensionField]
        ? `${epPath}/video${epData[CONFIG.PATHS.videoExtensionField]}`
        : null;

      if (videoURL) {
        VideoDurationHandler.getAsync(videoURL, (duration) => {
          dur.innerText = FormatUtils.formatTimestamp(duration);
          onDurationReady(duration);
          logger.debug(`Episode ${epIndex} duration: ${duration}s`);
        });
      } else {
        onDurationReady(0);
      }
    } else {
      onDurationReady(0);
    }

    cardBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logger.debug(`Episode clicked: season ${sid}, ep ${epIndex}`);
      onEpisodeClick(sid, epIndex);
    });

    container.appendChild(cardFragment);
    logger.debug(`Episode ${epIndex} card rendered`);
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
}

// ─── METADATA MANAGER ─────────────────────────────────────────────────────────

class MetadataManager {
  static update(totalSeconds: number, count: number): void {
    const epText = document.getElementById(
      CONFIG.SELECTORS.contentEpisodesText,
    );
    const durText = document.getElementById(
      CONFIG.SELECTORS.contentDurationText,
    );
    const durText_Banner = document.getElementById(
      CONFIG.SELECTORS.contentDurationBannerText,
    );

    const readableTime = FormatUtils.formatReadable(totalSeconds);
    const episodeText = `${count} episode${count !== 1 ? "s" : ""}`;

    if (epText) epText.innerText = episodeText;
    if (durText) durText.innerText = readableTime;
    if (durText_Banner) durText_Banner.innerText = readableTime;

    logger.info(`Metadata updated: ${episodeText}, ${readableTime}`);
  }
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function listAnime(options: ListAnimeOptions): Promise<void> {
  const {
    root,
    onEpisodeClick,
    activeSeason,
    activeEpisode,
    cardIdPrefix = "episodeCard",
    debugLevel = LogLevel.INFO,
  } = options;

  logger.setLevel(debugLevel);
  logger.info(`listAnime initialized with root: ${root}`, {
    cardIdPrefix,
    debugLevel,
  });

  const mainWrapper = document.getElementById(CONFIG.SELECTORS.mainWrapper);
  const seasonSwitch = document.getElementById(CONFIG.SELECTORS.seasonSwitch);
  const seasonTemplate = document.getElementById(
    CONFIG.SELECTORS.seasonContainerTemplate,
  ) as HTMLTemplateElement | null;
  const radioTemplate = document.getElementById(
    CONFIG.SELECTORS.seasonRadioTemplate,
  ) as HTMLTemplateElement | null;
  const episodeTemplate = document.getElementById(
    CONFIG.SELECTORS.episodeTemplate,
  ) as HTMLTemplateElement | null;

  if (!mainWrapper || !seasonTemplate || !episodeTemplate) {
    logger.error(`Missing required DOM elements`, {
      mainWrapper: !!mainWrapper,
      seasonTemplate: !!seasonTemplate,
      episodeTemplate: !!episodeTemplate,
    });
    return;
  }

  const seasons = await discoverSeasons(root);
  if (seasons.length === 0) {
    logger.warn(`No seasons discovered from: ${root}`);
    return;
  }

  const allEpisodes = await Promise.all(
    seasons.map(({ index }) => discoverEpisodes(`${root}/season_${index}`)),
  );

  logger.info(`Data discovery complete: ${seasons.length} seasons`);

  let totalSeconds = 0;
  let globalEpCount = 0;
  let pendingDurations = 0;

  const totalEpisodeCount = allEpisodes.reduce(
    (sum, eps) => sum + eps.length,
    0,
  );

  const onDurationReady = (duration: number) => {
    totalSeconds += duration;
    pendingDurations--;
    if (pendingDurations === 0) {
      MetadataManager.update(totalSeconds, globalEpCount);
    }
  };

  for (let si = 0; si < seasons.length; si++) {
    const season = seasons[si];
    const { index: sid } = season;
    const episodes = allEpisodes[si];
    const seasonPath = `${root}/season_${sid}`;

    SeasonRenderer.render(season, seasonSwitch, radioTemplate, root);

    const seasonFragment = seasonTemplate.content.cloneNode(
      true,
    ) as DocumentFragment;
    const seasonDiv = seasonFragment.querySelector<HTMLElement>("div");

    if (!seasonDiv) {
      logger.error(`Season container div not found in template`);
      continue;
    }

    seasonDiv.id = `listAnime_Season_${sid}`;
    if (sid !== 1) seasonDiv.classList.add("hidden");
    mainWrapper.appendChild(seasonFragment);

    const currentContainer = document.getElementById(`listAnime_Season_${sid}`);
    if (!currentContainer) {
      logger.error(
        `Season container not found after append: listAnime_Season_${sid}`,
      );
      continue;
    }

    for (const episode of episodes) {
      globalEpCount++;
      pendingDurations++;

      EpisodeCardRenderer.render(
        episode,
        season,
        seasonPath,
        episodeTemplate,
        currentContainer,
        onEpisodeClick,
        cardIdPrefix,
        globalEpCount,
        onDurationReady,
      );
    }
  }

  if (totalEpisodeCount === 0) {
    MetadataManager.update(0, 0);
  }

  // Sonsuz döngüyü engellemek için genel DOMContentLoaded yerine radyo butonlarına özel tetikleyici gönderiyoruz
  document.dispatchEvent(new Event("initRadioButtons"));
  logger.debug(`Radio group custom init event dispatched`);

  if (activeSeason !== undefined && activeEpisode !== undefined) {
    logger.info(
      `Setting initial active card: season ${activeSeason}, episode ${activeEpisode}`,
    );
    setActiveCard(activeSeason, activeEpisode, cardIdPrefix);
  }

  logger.info(`listAnime rendering complete`);
}

// ─── SEASON SWITCHER ─────────────────────────────────────────────────────────

export function switchSeason(targetSeason: number): void {
  logger.debug(`Switching to season: ${targetSeason}`);

  document.querySelectorAll("[id^='listAnime_Season_']").forEach((el) => {
    el.classList.add("hidden");
  });

  const target = document.getElementById(`listAnime_Season_${targetSeason}`);
  if (target) {
    target.classList.remove("hidden");
    logger.debug(`Season container shown: listAnime_Season_${targetSeason}`);
  } else {
    logger.warn(`Season container not found: listAnime_Season_${targetSeason}`);
  }
}

(window as any).switchSeason = switchSeason;

// ─── ACTIVE CARD SETTER ──────────────────────────────────────────────────────

export function setActiveCard(
  seasonIndex: number,
  epIndex: number,
  cardIdPrefix = "episodeCard",
): void {
  logger.debug(
    `setActiveCard called: season ${seasonIndex}, episode ${epIndex}`,
  );
  StylingManager.setActiveCard(seasonIndex, epIndex, cardIdPrefix);
}

// ─── PUBLIC DEBUG API ────────────────────────────────────────────────────────

(window as any).listAnimeAPI = {
  setDebugLevel: (level: LogLevel) => logger.setLevel(level),
  clearDurationCache: () => durationCache.clear(),
  getLogger: () => logger,
};
