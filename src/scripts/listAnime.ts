/**
 * listAnime.ts — Modular Hierarchical Season & Episode Renderer (Optimized & Fixed)
 */

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ListAnimeOptions {
  root: string;
  onEpisodeClick: (seasonIndex: number, epIndex: number) => void;
  activeSeason?: number;
  activeEpisode?: number;
  cardIdPrefix?: string;
}

// ─── RADIO BUTTON CLASSES ────────────────────────────────────────────────────

const ACTIVE_CLASS =
  "relative flex flex-row items-center justify-start min-w-fit w-fit h-fit gap-2 rounded-3xl p-3 text-nowrap font-semibold text-left text-[min(6vw,0.9rem)] text-Light_Text_Primary dark:text-Dark_Text_Primary bg-Light_Border_Primary dark:bg-Dark_Border_Primary hover:bg-Light_Border_Secondary hover:dark:bg-Dark_Border_Secondary transition-all duration-300 ease-in-out overflow-hidden cursor-pointer uppercase";

const DEACTIVE_CLASS =
  "relative flex flex-row items-center justify-start min-w-fit w-fit h-fit gap-2 rounded-3xl p-3 hover:bg-Light_Border_Secondary hover:dark:bg-Dark_Border_Secondary text-nowrap font-semibold text-left text-[min(6vw,0.9rem)] text-Light_Text_Secondary dark:text-Dark_Text_Secondary transition-all duration-300 ease-in-out overflow-hidden cursor-pointer capitalize";

// ─── DURATION CACHE ───────────────────────────────────────────────────────────

const durationCache = new Map<string, number>();

function getVideoDurationAsync(
  url: string,
  onReady: (duration: number) => void,
  timeout = 5000,
): void {
  if (!url || url.endsWith("/videoundefined") || url.endsWith("/videonull")) {
    onReady(0);
    return;
  }

  if (durationCache.has(url)) {
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
    onReady(duration);
  };

  const timer = setTimeout(() => settle(0), timeout);

  video.addEventListener(
    "loadedmetadata",
    () => {
      durationCache.set(url, video.duration);
      settle(video.duration);
    },
    { once: true },
  );

  video.addEventListener("error", () => settle(0), { once: true });

  video.src = url;
}

// ─── DISCOVERY HELPERS ────────────────────────────────────────────────────────

async function discoverSeasons(
  root: string,
): Promise<Array<{ index: number; data: any }>> {
  const results: Array<{ index: number; data: any }> = [];
  let i = 1;

  while (i <= 100) {
    const data = await fetchJson(root + "/season_" + i + "/information.json");
    if (data === null || data === undefined) break;
    results.push({ index: i, data });
    i++;
  }

  return results;
}

async function discoverEpisodes(
  seasonPath: string,
): Promise<Array<{ index: number; data: any }>> {
  const episodes: Array<{ index: number; data: any }> = [];
  let i = 1;

  while (i <= 10000) {
    const data = await fetchJson(seasonPath + "/ep_" + i + "/information.json");
    if (data === null || data === undefined) break;
    episodes.push({ index: i, data });
    i++;
  }

  return episodes;
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function listAnime(options: ListAnimeOptions): Promise<void> {
  const {
    root,
    onEpisodeClick,
    activeSeason,
    activeEpisode,
    cardIdPrefix = "episodeCard",
  } = options;

  const mainWrapper = document.getElementById("season_main_wrapper");
  const seasonSwitch = document.getElementById("seasonSwitch");
  const seasonTemplate = document.getElementById(
    "Season_Container_Template",
  ) as HTMLTemplateElement | null;
  const radioTemplate = document.getElementById(
    "SeasonRadioTemplate",
  ) as HTMLTemplateElement | null;
  const cardTemplate = document.getElementById(
    "videoCard_Template",
  ) as HTMLTemplateElement | null;

  if (!mainWrapper || !seasonTemplate || !cardTemplate) {
    console.error("[listAnime]: Required elements not found in DOM.");
    return;
  }

  const seasons = await discoverSeasons(root);
  if (seasons.length === 0) return;

  const allEpisodes = await Promise.all(
    seasons.map(({ index }) => discoverEpisodes(root + "/season_" + index)),
  );

  let totalSeconds = 0;
  let globalEpCount = 0;
  let pendingDurations = 0;

  for (let si = 0; si < seasons.length; si++) {
    const { index: sid, data: sData } = seasons[si];
    const episodes = allEpisodes[si];
    const seasonName = sData.seasonName || "Season " + sid;
    const seasonPath = root + "/season_" + sid;

    // Render season radio button
    if (seasonSwitch && radioTemplate) {
      const radioFragment = radioTemplate.content.cloneNode(
        true,
      ) as DocumentFragment;
      const radioBtn = radioFragment.querySelector(
        "button",
      ) as HTMLButtonElement | null;

      if (radioBtn) {
        radioBtn.id = "season_" + sid;
        radioBtn.dataset.group = "seasonSwitchers";
        radioBtn.className = sid === 1 ? ACTIVE_CLASS : DEACTIVE_CLASS;

        // Find the title element inside the cloned button and set its content
        const titleEl = radioBtn.querySelector("#title") as HTMLElement | null;
        if (titleEl) {
          titleEl.innerText = "Season " + sid;
        }

        const icon = radioBtn.querySelector(
          "#googleSymbol",
        ) as HTMLSpanElement | null;
        if (icon) icon.classList.toggle("icon-fill", sid === 1);

        radioBtn.setAttribute(
          "onclick",
          `switchTheFilter(this, this.id); switchSeason(${sid});`,
        );
        seasonSwitch.appendChild(radioFragment);
      }
    }

    // Render season container
    const seasonFragment = seasonTemplate.content.cloneNode(
      true,
    ) as DocumentFragment;
    const seasonDiv = seasonFragment.querySelector("div") as HTMLElement | null;

    if (!seasonDiv) continue;

    seasonDiv.id = "listAnime_Season_" + sid;
    if (sid !== 1) seasonDiv.classList.add("hidden");
    mainWrapper.appendChild(seasonFragment);

    const currentContainer = document.getElementById("listAnime_Season_" + sid);
    if (!currentContainer) continue;

    const cardBatch = document.createDocumentFragment();

    for (const { index: epIndex, data: epData } of episodes) {
      // Değerleri bu döngü adımına hapsediyoruz (Closure Fix)
      const currentSid = sid;
      const currentEpIndex = epIndex;

      const epPath = seasonPath + "/ep_" + currentEpIndex;
      globalEpCount++;

      const cardFragment = cardTemplate.content.cloneNode(
        true,
      ) as DocumentFragment;
      const cardBtn = cardFragment.querySelector(
        "#videoCard",
      ) as HTMLButtonElement | null;

      if (cardBtn) {
        cardBtn.id = cardIdPrefix + "_s" + currentSid + "_ep" + currentEpIndex;
        cardBtn.removeAttribute("onclick");

        const cover = cardBtn.querySelector(
          "#episodeCover",
        ) as HTMLImageElement | null;
        const title = cardBtn.querySelector(
          "#episodeTitle",
        ) as HTMLParagraphElement | null;
        const desc = cardBtn.querySelector(
          "#episodeDesc",
        ) as HTMLParagraphElement | null;
        const dur = cardBtn.querySelector(
          "#videoDuration",
        ) as HTMLParagraphElement | null;

        if (cover) cover.src = epPath + "/cover.webp";

        const epCountText = cardBtn.querySelector(
          "#episodeCount_Text",
        ) as HTMLParagraphElement;
        if (epCountText) {
          epCountText.innerText = "episode " + globalEpCount.toString();
        }

        if (title) title.innerText = epData.episodeName;
        if (desc) desc.innerText = epData.desc;

        if (dur) {
          dur.innerHTML =
            '<span class="material-symbols-rounded">schedule</span> —:——';
          const videoURL = epData.videoType
            ? epPath + "/video" + epData.videoType
            : null;

          if (videoURL) {
            pendingDurations++;
            const durEl = dur;
            getVideoDurationAsync(videoURL, (duration) => {
              totalSeconds += duration;
              durEl.innerHTML =
                '<span class="material-symbols-rounded">schedule</span> ' +
                formatTimestamp(duration);
              pendingDurations--;
              if (pendingDurations === 0)
                updateMetadata(
                  totalSeconds,
                  globalEpCount,
                  epData.nsfw,
                  epData.ageRating,
                  epData.meta.rating,
                  epData.meta.uploadDate,
                );
            });
          }
        }

        // ASIL FIX BURASI: Listener artık her kart için doğru sid ve epIndex'i biliyor
        cardBtn.addEventListener("click", (e) => {
          e.preventDefault();
          onEpisodeClick(currentSid, currentEpIndex);
        });

        if (currentSid === activeSeason && currentEpIndex === activeEpisode) {
          cardBtn.classList.add("border-2", "!border-Accent", "bg-Accent/10");
        }

        cardBatch.appendChild(cardFragment);
      }
    }
    currentContainer.appendChild(cardBatch);
  }

  // Handle case where no episodes have video metadata
  if (pendingDurations === 0) updateMetadata(totalSeconds, globalEpCount);
}

// ─── SEASON SWITCHER ─────────────────────────────────────────────────────────

export function switchSeason(targetSeason: number): void {
  document.querySelectorAll("[id^='listAnime_Season_']").forEach((el) => {
    el.classList.add("hidden");
  });

  const target = document.getElementById("listAnime_Season_" + targetSeason);
  if (target) target.classList.remove("hidden");
}
(window as any).switchSeason = switchSeason;

// ─── ACTIVE CARD HELPER ──────────────────────────────────────────────────────

export function setActiveCard(
  seasonIndex: number,
  epIndex: number,
  cardIdPrefix = "episodeCard",
): void {
  document.querySelectorAll("[id^='" + cardIdPrefix + "_']").forEach((card) => {
    card.classList.remove("border-2", "!border-Accent", "bg-Accent/10");
  });

  const activeCard = document.getElementById(
    cardIdPrefix + "_s" + seasonIndex + "_ep" + epIndex,
  );
  if (activeCard) {
    activeCard.classList.add("border-2", "!border-Accent", "bg-Accent/10");
  }
}

// ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

async function fetchJson(url: string): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

function formatTimestamp(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? h + ":" + String(m).padStart(2, "0") + ":" + ss : m + ":" + ss;
}

function formatReadable(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? h + "h " + m + "m" : m + "m";
}

function updateMetadata(
  totalSeconds: number,
  count: number,
  nsfw?: boolean,
  ageRating?: string,
  rating?: string,
  uploadDate?: string,
): void {
  const epText = document.getElementById("contentEpisodes_Text");
  const durText = document.getElementById("contentDuration_Text");
  const durText_Banner = document.getElementById("contentDuration_BannerText");
  const releaseText = document.getElementById("releaseDate_Text");
  const releaseText_Banner = document.getElementById("releaseDate_BannerText");
  const ageRatingText = document.getElementById("contentRating_Text");
  const ageRating_Banner = document.getElementById("contentRating_BannerText");

  if (epText) epText.innerText = count + " episodes" || "Unknown";
  if (durText) durText.innerText = formatReadable(totalSeconds) || "Unknown";
  if (durText_Banner)
    durText_Banner.innerText = formatReadable(totalSeconds) || "Unknown";
  if (releaseText) releaseText.innerText = uploadDate || "Unknown";
  if (releaseText_Banner)
    releaseText_Banner.innerText = uploadDate || "Unknown";

  if (nsfw) {
    if (ageRatingText) ageRatingText.innerText = "18+";
    if (ageRating_Banner) ageRating_Banner.innerText = "18+";
  } else {
    if (ageRatingText) ageRatingText.innerText = ageRating || "unknown";
    if (ageRating_Banner) ageRating_Banner.innerText = ageRating || "unknown";
  }
}
