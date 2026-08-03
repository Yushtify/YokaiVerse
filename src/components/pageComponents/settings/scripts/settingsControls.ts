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
  defaultValue: boolean;
}

const TOGGLE_RESTORE_ENTRIES: ToggleRestoreEntry[] = [
  {
    storageKey: "adultContent",
    buttonId: config.buttons.nsfwButton.id,
    callback: "toggleNSFW",
    defaultValue: false,
  },
  {
    storageKey: "animations",
    buttonId: config.buttons.animationsToggleButton.id,
    callback: "toggleAnimations",
    defaultValue: true,
  },
  {
    storageKey: "timelineSegments",
    buttonId: config.buttons.timelineSegmentsButton.id,
    callback: "toggleTimelineSegments",
    defaultValue: true,
  },
];

function restoreToggle(entry: ToggleRestoreEntry): void {
  const savedState =
    SettingsStorage.load()[entry.storageKey] ?? entry.defaultValue;
  const buttonEl = document.getElementById(
    entry.buttonId,
  ) as HTMLButtonElement | null;

  if (!buttonEl) {
    console.log(
      `[DEBUG: settingsInit] Button not found for storageKey "${entry.storageKey}" (id: ${entry.buttonId}); applying effect without DOM sync.`,
    );
  } else {
    buttonEl.setAttribute("data-togglestate", String(savedState));
  }

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
