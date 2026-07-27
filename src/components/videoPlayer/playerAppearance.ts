import { registerToggleAction } from "../../scripts/toggleButtonHandler";
import { config, debugHandler } from "./playerConfig";
import { PlayerStorage } from "./playerStorage";

// ─── Cinema Lights ────────────────────────────────────────────────────────────
// Registers the toggle action with a unique identifier for the Cinema Lights feature
registerToggleAction("cinemaLightEp", (el, isActive) => {
  // Pass the active/inactive state from the toggle handler directly to the function
  (window as any).cinemaLightEp(isActive);
});

// Bind to the window scope for standard button onClick access
// and introduce a forceState parameter to handle specific states.
(window as any).cinemaLightEp = function cinemaLightEp(forceState?: boolean) {
  const buttonEl = document.getElementById(
    config.buttons.cinemaLightsButton.id, // Targets "epCinemaLightsToggleButton"
  ) as HTMLButtonElement;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement;
  const cinemaLightsEl = document.getElementById(
    config.cinemaLightsID, // Targets "epCinemaLights" element
  ) as HTMLDivElement;

  if (!buttonEl || !svgEl || !cinemaLightsEl)
    return debugHandler("E", "Cinema Lights", "playerAppearance.ts");

  // CRITICAL FIX: If called without a specific state (e.g., clicked from the standard button),
  // simply trigger a programmatic click on the ToggleButton component.
  // This allows the custom component's script to transition its internal state safely.
  if (forceState === undefined) {
    buttonEl.click();
    return;
  }

  // Otherwise, it means the custom toggle component itself triggered this callback with an explicit state.
  const newState = forceState;

  // Toggle visual utility classes on your cinema lights overlay container
  if (cinemaLightsEl) {
    if (newState) {
      cinemaLightsEl.classList.remove("opacity-0", "pointer-events-none");
      cinemaLightsEl.classList.add("opacity-100");
    } else {
      cinemaLightsEl.classList.add("opacity-0", "pointer-events-none");
      cinemaLightsEl.classList.remove("opacity-100");
    }
  }

  // Sync the SVG inner HTML icon based on the active state
  if (svgEl) {
    svgEl.innerHTML = newState
      ? config.buttons.cinemaLightsButton.symbols.active
      : config.buttons.cinemaLightsButton.symbols.deactive;
  }

  // Explicitly keep the DOM attribute updated for custom toggle components
  buttonEl.setAttribute("data-togglestate", String(newState));

  // Save the synchronized state to local/session storage
  PlayerStorage.save({
    cinemaLights: newState,
  });
};
