// ============================================================
// settingsPanelHandler.ts
// Listens to radChanged events dispatched by radioButtonCore
// and toggles visibility of the matching settings panel.
// Panel IDs are derived from radio button IDs by stripping a
// configurable suffix (e.g. "generalSettings_radio" -> "generalSettings").
// ============================================================

const SETTINGS_PANEL_CONFIG = {
  targetGroup: "settingsNavigator",
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
let knownSettingsPanelIds: string[] = [];

function derivePanelId(radioId: string): string | null {
  if (!radioId.endsWith(SETTINGS_PANEL_CONFIG.radioIdSuffix)) return null;
  return radioId.slice(0, -SETTINGS_PANEL_CONFIG.radioIdSuffix.length);
}

// Finds every radio button belonging to the target group and
// derives its panel id from its element id.
function collectPanelIds(): string[] {
  const selector = `[data-${SETTINGS_PANEL_CONFIG.dataset.radGroup}="${SETTINGS_PANEL_CONFIG.targetGroup}"]`;
  const members = document.querySelectorAll<HTMLElement>(selector);
  const ids: string[] = [];

  members.forEach((el) => {
    if (!el.id) {
      console.warn(
        `[DEBUG: settingsPanelHandler] Radio element missing id, skipping.`,
        el,
      );
      return;
    }

    const panelId = derivePanelId(el.id);
    if (!panelId) {
      console.warn(
        `[DEBUG: settingsPanelHandler] Radio id "${el.id}" does not end with "${SETTINGS_PANEL_CONFIG.radioIdSuffix}", skipping.`,
      );
      return;
    }

    ids.push(panelId);
  });

  return ids;
}

// Shows the panel matching panelId, hides every other known panel.
function showPanel(panelId: string): void {
  knownSettingsPanelIds.forEach((id) => {
    const panel = document.getElementById(id);
    if (!panel) {
      console.warn(
        `[DEBUG: settingsPanelHandler] Panel "#${id}" not found in DOM.`,
      );
      return;
    }

    if (id === panelId) {
      panel.classList.remove(SETTINGS_PANEL_CONFIG.hiddenClass);
      panel.classList.add(SETTINGS_PANEL_CONFIG.visibleClass);
    } else {
      panel.classList.remove(SETTINGS_PANEL_CONFIG.visibleClass);
      panel.classList.add(SETTINGS_PANEL_CONFIG.hiddenClass);
    }
  });
}

function handleRadChanged(event: Event): void {
  const detail = (event as CustomEvent<{ group: string; id: string }>).detail;
  if (!detail || detail.group !== SETTINGS_PANEL_CONFIG.targetGroup) return;

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
  const selector = `[data-${SETTINGS_PANEL_CONFIG.dataset.radGroup}="${SETTINGS_PANEL_CONFIG.targetGroup}"][data-${SETTINGS_PANEL_CONFIG.dataset.radState}="true"]`;
  const active = document.querySelector<HTMLElement>(selector);
  return active?.id ?? null;
}

function initSettingsPanels(): void {
  knownSettingsPanelIds = collectPanelIds();

  if (knownSettingsPanelIds.length === 0) {
    console.warn(
      `[DEBUG: settingsPanelHandler] No panel ids found for group "${SETTINGS_PANEL_CONFIG.targetGroup}".`,
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
    showPanel(knownSettingsPanelIds[0]);
  }
}

// radChanged listener is registered once at module load, not inside
// initSettingsPanels, so it never gets double-bound on re-init.
document.addEventListener(
  SETTINGS_PANEL_CONFIG.events.radChanged,
  handleRadChanged,
);
document.addEventListener("DOMContentLoaded", initSettingsPanels);
document.addEventListener("astro:after-swap", initSettingsPanels);
