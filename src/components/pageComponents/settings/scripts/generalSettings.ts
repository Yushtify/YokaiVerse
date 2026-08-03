import { config } from "./settingsConfig";
import { SettingsStorage } from "./settingsStorage";
import { registerToggleAction } from "../../../../scripts/toggleButtonHandler.ts"; // Registers toggle actions for the settings page

// ─── Animations Toggle ─────────────────────────────────────────────────────

registerToggleAction("toggleAnimations", (_el, isActive) => {
  (window as any).toggleAnimations(isActive);
});

(window as any).toggleAnimations = function toggleAnimations(
  forceState?: boolean,
) {
  const buttonEl = document.getElementById(
    config.buttons.animationsToggleButton.id,
  ) as HTMLButtonElement | null;

  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement | null;

  if (forceState === undefined) {
    buttonEl?.click();
    return;
  }

  const newState = forceState;

  // Sync button visuals only if the button exists on this page.
  if (buttonEl) {
    if (svgEl) {
      svgEl.textContent = newState
        ? config.buttons.animationsToggleButton.symbols.active
        : config.buttons.animationsToggleButton.symbols.deactive;
    }
    buttonEl.setAttribute("data-togglestate", String(newState));
  }

  // Apply the actual effect globally, regardless of button presence.
  document.documentElement.classList.toggle("reduce-motion", !newState);

  SettingsStorage.save({
    animations: newState,
  });
};

// ─── Adult Content Toggle ────────────────────────────────────────────────────────────

registerToggleAction("toggleNSFW", (_el, isActive) => {
  // Forward the toggle state directly to the shared handler.
  (window as any).toggleNSFW(isActive);
});

// Bind to the window scope for standard button onClick access
// and expose a forceState parameter so the custom toggle
// component can synchronize a specific state.
(window as any).toggleNSFW = function toggleNSFW(forceState?: boolean) {
  const buttonEl = document.getElementById(
    config.buttons.nsfwButton.id,
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
        ? config.buttons.nsfwButton.symbols.active
        : config.buttons.nsfwButton.symbols.deactive;
    }
    buttonEl.setAttribute("data-togglestate", String(newState));
  }

  // Persist the updated setting. Reading it back (e.g. featuredHandler's
  // isNsfwEnabled()) works globally regardless of button presence.
  SettingsStorage.save({
    adultContent: newState,
  });
};
