import { config } from "./settingsConfig";
import { SettingsStorage } from "./settingsStorage";
import { registerToggleAction } from "../../../../scripts/toggleButtonHandler.ts"; // Registers toggle actions for the settings page

// ─── Timeline Segments Toggle ───────────────────────────────────────────────

registerToggleAction("toggleTimelineSegments", (_el, isActive) => {
  // Forward the toggle state directly to the shared handler.
  (window as any).toggleTimelineSegments(isActive);
});

// Bind to the window scope for standard button onClick access
// and expose a forceState parameter so the custom toggle
// component can synchronize a specific state.
(window as any).toggleTimelineSegments = function toggleTimelineSegments(
  forceState?: boolean,
) {
  const buttonEl = document.getElementById(
    config.buttons.timelineSegmentsButton.id,
  ) as HTMLButtonElement | null;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement | null;

  // If called without an explicit state (e.g. a normal click),
  // delegate back to the ToggleButton component so it can
  // safely update its own internal state.
  if (forceState === undefined) {
    buttonEl?.click();
    return;
  }

  const newState = forceState;

  // Sync button visuals only if the button exists on this page.
  if (buttonEl) {
    if (svgEl) {
      svgEl.textContent = newState
        ? config.buttons.timelineSegmentsButton.symbols.active
        : config.buttons.timelineSegmentsButton.symbols.deactive;
    }
    buttonEl.setAttribute("data-togglestate", String(newState));
  }

  // Persist the updated setting.
  SettingsStorage.save({
    timelineSegments: newState,
  });
};
