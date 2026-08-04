import { config, debugHandler } from "./playerConfig";
import { PlayerStorage } from "./playerStorage";

// ─── Subtitles ──────────────────────────────────────────────────────────
// Exported (not just window-bound) so playerControls.ts can call it directly
// during the saved-settings init sequence, same as the original single-file
// version did.
export function toggleSubtitles(forceState?: boolean) {
  const buttonEl = document.getElementById(
    config.buttons.subtitles.id,
  ) as HTMLButtonElement;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement;
  const subtitleBar = document.getElementById(
    config.subtitleBarID,
  ) as HTMLDivElement;

  if (!buttonEl || !svgEl || !subtitleBar)
    return debugHandler("E", "Subtitles", "playerSubtitles.ts");

  // Determine current visibility via class check
  const isCurrentlyVisible = subtitleBar.classList.contains("opacity-100");

  // Use forced state if provided (from storage init), otherwise flip current state
  const showSubtitles =
    forceState !== undefined ? forceState : !isCurrentlyVisible;

  if (showSubtitles) {
    subtitleBar.classList.remove("opacity-0");
    subtitleBar.classList.add("opacity-100");
    svgEl.textContent = config.buttons.subtitles.symbols.active;
    console.log("[DEBUG: playerSubtitles.ts] subs on");
  } else {
    subtitleBar.classList.remove("opacity-100");
    subtitleBar.classList.add("opacity-0");
    svgEl.textContent = config.buttons.subtitles.symbols.deactive;
    console.log("[DEBUG: playerSubtitles.ts] subs off");
  }

  PlayerStorage.save({ subtitles: showSubtitles });
}

// Bind to window scope so HTML elements can target it
(window as any).toggleSubtitles = toggleSubtitles;
