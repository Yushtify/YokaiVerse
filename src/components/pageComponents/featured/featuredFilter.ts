// ============================================================
// featuredFilter.ts
// Listens to radChanged events dispatched by radioButtonCore
// and toggles visibility of the matching settings panel.
// Panel IDs are derived from radio button IDs by stripping a
// configurable suffix (e.g. "generalSettings_radio" -> "generalSettings").
// ============================================================

const FEATURED_FILTER_CONFIG = {
  targetGroup: "mediaTypeFilter",
  radioIdSuffix: "_radio",
  visibleClass: "flex",
  hiddenClass: "hidden",
  events: {
    radChanged: "radChanged",
  },
  dataset: {
    radGroup: "radgroup",
    radState: "radstate",
  },
} as const;

// Populated on every init — panel ids for the current DOM, since
// Astro View Transitions swap the DOM and stale ids must not survive.
let knownPanelIds: string[] = [];

function derivePanelId(radioId: string): string | null {
  if (!radioId.endsWith(FEATURED_FILTER_CONFIG.radioIdSuffix)) return null;
  return radioId.slice(0, -FEATURED_FILTER_CONFIG.radioIdSuffix.length);
}

// Finds every radio button belonging to the target group and
// derives its panel id from its element id.
function collectPanelIds(): string[] {
  const selector = `[data-${FEATURED_FILTER_CONFIG.dataset.radGroup}="${FEATURED_FILTER_CONFIG.targetGroup}"]`;
  const members = document.querySelectorAll<HTMLElement>(selector);
  const ids: string[] = [];

  members.forEach((el) => {
    if (!el.id) {
      console.warn(
        `[DEBUG: featuredFilter] Radio element missing id, skipping.`,
        el,
      );
      return;
    }

    const panelId = derivePanelId(el.id);
    if (!panelId) {
      console.warn(
        `[DEBUG: featuredFilter] Radio id "${el.id}" does not end with "${FEATURED_FILTER_CONFIG.radioIdSuffix}", skipping.`,
      );
      return;
    }

    ids.push(panelId);
  });

  return ids;
}

// Shows the panel matching panelId, hides every other known panel.
function showPanel(panelId: string): void {
  knownPanelIds.forEach((id) => {
    const panel = document.getElementById(id);
    if (!panel) {
      console.warn(
        `[DEBUG: settingsPanelHandler] Panel "#${id}" not found in DOM.`,
      );
      return;
    }

    if (id === panelId) {
      panel.classList.remove(FEATURED_FILTER_CONFIG.hiddenClass);
      panel.classList.add(FEATURED_FILTER_CONFIG.visibleClass);
    } else {
      panel.classList.remove(FEATURED_FILTER_CONFIG.visibleClass);
      panel.classList.add(FEATURED_FILTER_CONFIG.hiddenClass);
    }
  });
}

function handleRadChanged(event: Event): void {
  const detail = (event as CustomEvent<{ group: string; id: string }>).detail;
  if (!detail || detail.group !== FEATURED_FILTER_CONFIG.targetGroup) return;

  const panelId = derivePanelId(detail.id);
  if (!panelId) {
    console.warn(
      `[DEBUG: settingsPanelHandler] Could not derive panel id from "${detail.id}".`,
    );
    return;
  }

  showPanel(panelId);
}

// Reads which radio in the group starts with data-radstate="true",
// so the correct panel is visible before any click happens.
function findInitialActiveId(): string | null {
  const selector = `[data-${FEATURED_FILTER_CONFIG.dataset.radGroup}="${FEATURED_FILTER_CONFIG.targetGroup}"][data-${FEATURED_FILTER_CONFIG.dataset.radState}="true"]`;
  const active = document.querySelector<HTMLElement>(selector);
  return active?.id ?? null;
}

function initSettingsPanels(): void {
  knownPanelIds = collectPanelIds();

  if (knownPanelIds.length === 0) {
    console.warn(
      `[DEBUG: settingsPanelHandler] No panel ids found for group "${FEATURED_FILTER_CONFIG.targetGroup}".`,
    );
    return;
  }

  const initialActiveRadioId = findInitialActiveId();
  const initialPanelId = initialActiveRadioId
    ? derivePanelId(initialActiveRadioId)
    : null;

  if (initialPanelId) {
    showPanel(initialPanelId);
  } else {
    // No explicit active state found in the DOM; fall back to the
    // first collected panel so something is always visible.
    showPanel(knownPanelIds[0]);
  }
}

// radChanged listener is registered once at module load, not inside
// initSettingsPanels, so it never gets double-bound on re-init.
document.addEventListener(
  FEATURED_FILTER_CONFIG.events.radChanged,
  handleRadChanged,
);
document.addEventListener("DOMContentLoaded", initSettingsPanels);
document.addEventListener("astro:after-swap", initSettingsPanels);
