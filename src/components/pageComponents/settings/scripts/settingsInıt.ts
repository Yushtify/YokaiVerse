// settings controls
// This script will pull every setting including the init and handle.

import { config } from "./settingsConfig";
import { SettingsStorage } from "./settingsStorage";
import "./generalSettings"; // Side-effect: registers toggleNSFW / toggleAnimations on window
import "./experimentalSettings"; // Side-effect: registers toggleTimelineSegments on window
import "./privacySettings"; // Side-effect: registers deleteAccData on window

// ─── Toggle Restore Config ──────────────────────────────────────────────────
// Zero hardcoding: every restorable toggle is described here once.
// Add a new setting by adding one entry to this array.

interface ToggleRestoreEntry {
  storageKey: keyof ReturnType<typeof SettingsStorage.load>;
  buttonId: string;
  callback: string;
}

const TOGGLE_RESTORE_ENTRIES: ToggleRestoreEntry[] = [
  {
    storageKey: "adultContent",
    buttonId: config.buttons.nsfwButton.id,
    callback: "toggleNSFW",
  },
  {
    storageKey: "animations",
    buttonId: config.buttons.animationsToggleButton.id,
    callback: "toggleAnimations",
  },
  {
    storageKey: "timelineSegments",
    buttonId: config.buttons.timelineSegmentsButton.id,
    callback: "toggleTimelineSegments",
  },
];

// ─── Toggle Restore ──────────────────────────────────────────────────────────
// IMPORTANT: this handler runs globally, on every page — not just /settings.
// The button element only exists on /settings, but the underlying effect
// (e.g. reduce-motion class) must still be applied everywhere. So the
// callback must always fire; missing button is only relevant for DOM sync.

function restoreToggle(entry: ToggleRestoreEntry): void {
  const savedState = SettingsStorage.load()[entry.storageKey] ?? false;
  const buttonEl = document.getElementById(
    entry.buttonId,
  ) as HTMLButtonElement | null;

  if (!buttonEl) {
    console.log(
      `[DEBUG: settingsInit] Button not found for storageKey "${entry.storageKey}" (id: ${entry.buttonId}); applying effect without DOM sync.`,
    );
  } else {
    // Keep the DOM state synchronized before notifying the handler.
    buttonEl.setAttribute("data-togglestate", String(savedState));
  }

  // Apply the state through the shared toggle handler.
  // This must run regardless of whether the button exists on this page,
  // since the actual effect (e.g. reduce-motion) is global.
  (window as any)[entry.callback](savedState);
}

// ─── Init / Handle ───────────────────────────────────────────────────────────

function initAllSettings(): void {
  for (const entry of TOGGLE_RESTORE_ENTRIES) {
    restoreToggle(entry);
  }

  // Re-sync toggle visuals after all states have been restored.
  document.dispatchEvent(new Event("initToggleButtons"));
}

// ─── Lifecycle Hooks ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", initAllSettings);
document.addEventListener("astro:after-swap", initAllSettings);
