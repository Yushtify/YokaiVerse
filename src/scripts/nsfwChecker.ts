/**
 * nsfwChecker.ts — Centralized Adult Content Gate Utility
 *
 * Single source of truth for:
 * - Reading the user's Adult Content preference from persistent settings.
 * - Determining whether a sub-unit (episode/chapter) or an entire series
 *   is flagged as Adult Content.
 * - Rendering a blocked-state UI when a series is Adult Content-flagged and the
 *   user has adult content disabled.
 *
 * listSeries.ts (and any other module needing this gate) imports from here
 * instead of duplicating the logic.
 */

import { SettingsStorage } from "../components/pageComponents/settings/scripts/settingsStorage.ts";

// ─── DEBUG LOGGING ────────────────────────────────────────────────────────────

function debugLog(message: string, data?: any): void {
  console.log(`[DEBUG: nsfwChecker] ${message}`, data ?? "");
}

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const CONFIG = {
  PATHS: {
    infoFile: "information.json",
  },
  SELECTORS: {
    blockedStateId: "seriesNsfwBlocked",
  },
  TIMEOUTS: {
    fetchJson: 5000,
  },
} as const;

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface NsfwCheckResult {
  isNsfw: boolean;
  blocked: boolean;
}

export type SeriesModeLike = "anime" | "manga";

// ─── SETTINGS READ ────────────────────────────────────────────────────────────

/**
 * Reads the user's Adult Content preference from persistent settings.
 * Defaults to false (safe) if the setting has never been saved.
 */
export function isNsfwEnabled(): boolean {
  const raw = SettingsStorage.load();
  const enabled = raw.adultContent ?? false;
  debugLog(`isNsfwEnabled() -> stored=${raw.adultContent} resolved=${enabled}`);
  return enabled;
}

// ─── LOCAL FETCH UTILITY ──────────────────────────────────────────────────────
// Kept local/minimal instead of importing listSeries' fetchJson, so this
// module has zero dependency on listSeries.ts (dependency only flows
// listSeries -> nsfwChecker, never the other way).

async function fetchJson(
  url: string,
  timeout = CONFIG.TIMEOUTS.fetchJson,
): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutHandle);

    if (!response.ok) {
      debugLog(`Fetch failed with status ${response.status}: ${url}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    debugLog(`Fetch error for ${url}`, error);
    return null;
  }
}

// ─── Adult Content FLAG RESOLUTION ──────────────────────────────────────────────────────

/**
 * Determines whether a single sub-unit (episode/chapter) is flagged Adult Content,
 * based on its own information.json data. Used for per-card skipping.
 * Adjust field names below if the actual schema differs.
 */
export function isSubUnitNsfw(subData: any): boolean {
  return subData?.adultContent === true || subData?.meta?.age === "18+";
}

/**
 * Determines whether an entire series is flagged Adult Content, either from
 * pre-fetched info (if the caller already fetched it) or by fetching the
 * series root's own information.json.
 * Adjust field names below if the actual schema differs.
 */
export async function isSeriesNsfw(
  root: string,
  preFetchedInfo?: any,
): Promise<boolean> {
  const seriesInfo =
    preFetchedInfo ?? (await fetchJson(`${root}/${CONFIG.PATHS.infoFile}`));

  const flagged =
    seriesInfo?.adultContent === true ||
    seriesInfo?.series?.adultContent === true ||
    seriesInfo?.meta?.age === "18+";

  debugLog(`isSeriesNsfw(${root}) -> ${flagged}`);
  return flagged;
}

// ─── BLOCKED STATE RENDERER ────────────────────────────────────────────────────

/**
 * Renders a hard error state into the given wrapper instead of series
 * content. Dispatches a scoped "listSeriesError" event so calling pages
 * can react (hide skeleton loaders, show a link to settings, etc).
 */
export function renderNsfwBlockedState(
  wrapper: HTMLElement,
  mode: SeriesModeLike,
): void {
  wrapper.innerHTML = "";

  const errorEl = document.createElement("div");
  errorEl.id = CONFIG.SELECTORS.blockedStateId;
  errorEl.className =
    "flex flex-col items-center justify-center w-full py-12 text-center gap-2";
  errorEl.innerHTML = `
    <p class="text-LT_Primary dark:text-DT_Primary font-semibold">
      This ${mode === "manga" ? "manga" : "anime"} could not be loaded.
    </p>
    <p class="text-LT_Secondary dark:text-DT_Secondary text-sm">
      Adult content is currently disabled in your settings.
    </p>
  `;
  wrapper.appendChild(errorEl);

  document.dispatchEvent(
    new CustomEvent("listSeriesError", {
      detail: { reason: "adultContent-disabled", mode },
    }),
  );

  debugLog(`Blocked state rendered (mode: ${mode})`);
}

// ─── COMBINED GATE CHECK ───────────────────────────────────────────────────────

/**
 * Convenience wrapper: checks whether a series should be blocked (Adult Content
 * flagged + adult content disabled) and, if blocked, renders the blocked
 * state directly into `wrapper`. Caller uses the returned `blocked` flag
 * to decide whether to bail out of further rendering.
 */
export async function checkAndGateSeries(
  root: string,
  wrapper: HTMLElement,
  mode: SeriesModeLike,
  preFetchedInfo?: any,
): Promise<NsfwCheckResult> {
  const flagged = await isSeriesNsfw(root, preFetchedInfo);
  const blocked = flagged && !isNsfwEnabled();

  if (blocked) {
    renderNsfwBlockedState(wrapper, mode);
  }

  return { isNsfw: flagged, blocked };
}
