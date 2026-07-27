import { registerToggleAction } from "../../scripts/toggleButtonHandler";
import { config, episodePlayer, debugHandler } from "./playerConfig";
import { PlayerStorage } from "./playerStorage";

// Side-effect imports: gestures and keybinds are self-initializing (their own
// DOMContentLoaded listeners), so behaviour pulls them in here rather than
// needing separate <script> tags in the HTML. Both read/write
// window.enablePlayerGestures / window.enablePlayerKeybinds, which the
// toggle functions below set.
import "./playerGesturesAndMouse";
import "./playerKeybinds";

// ─── Loop ────────────────────────────────────────────────────────────
// Registers the toggle action with a unique identifier for the Loop feature
registerToggleAction("loopEp", (el, isActive) => {
  // Pass the active/inactive state from the toggle handler directly to the function
  (window as any).loopEp(isActive);
});

// Bind to the window scope for standard button onClick access
// and introduce a forceState parameter to handle specific states.
(window as any).loopEp = function loopEp(forceState?: boolean) {
  const buttonEl = document.getElementById(
    config.buttons.loop.id, // Targets "epLoopButton"
  ) as HTMLButtonElement;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement;

  if (!buttonEl) return debugHandler("E", "Loop", "playerBehaviour.ts");

  // CRITICAL FIX: If called without a specific state (e.g., clicked from the standard button),
  // simply trigger a programmatic click on the ToggleButton component.
  // This allows the custom component's script to transition its internal state safely.
  if (forceState === undefined) {
    buttonEl.click();
    return;
  }

  // Otherwise, it means the custom toggle component itself triggered this callback with an explicit state.
  const newState = forceState;

  episodePlayer.loop = newState;

  // Sync the SVG inner HTML icon based on the active state
  if (svgEl) {
    svgEl.innerHTML = newState
      ? config.buttons.loop.symbols.active
      : config.buttons.loop.symbols.deactive;
  }

  // Explicitly keep the DOM attribute updated for custom toggle components
  buttonEl.setAttribute("data-togglestate", String(newState));

  // Save the synchronized state to local/session storage
  PlayerStorage.save({
    loop: newState,
  });
};

// ─── Auto Play ────────────────────────────────────────────────────────────
registerToggleAction("autoPlayEp", (el, isActive) => {
  // Pass the active/inactive state from the toggle handler directly to the function
  (window as any).autoPlayEp(isActive);
});

// Bind to the window scope for standard button onClick access
// and introduce a forceState parameter to handle specific states.
(window as any).autoPlayEp = function autoPlayEp(forceState?: boolean) {
  const buttonEl = document.getElementById(
    config.buttons.autoPlay.id, // Targets "epAutoPlayToggleButton"
  ) as HTMLButtonElement;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement;

  if (!buttonEl) return debugHandler("E", "Auto Play", "playerBehaviour.ts");

  // CRITICAL FIX: If called without a specific state (e.g., clicked from the standard button),
  // simply trigger a programmatic click on the ToggleButton component.
  // This allows the custom component's script to transition its internal state safely.
  if (forceState === undefined) {
    buttonEl.click();
    return;
  }

  // Otherwise, it means the custom toggle component itself triggered this callback with an explicit state.
  const newState = forceState;

  episodePlayer.autoplay = newState;

  // Sync the SVG inner HTML icon based on the active state
  if (svgEl) {
    svgEl.innerHTML = newState
      ? config.buttons.autoPlay.symbols.active
      : config.buttons.autoPlay.symbols.deactive;
  }

  // Explicitly keep the DOM attribute updated
  buttonEl.setAttribute("data-togglestate", String(newState));

  // Save the synchronized state to local/session storage
  PlayerStorage.save({
    autoPlay: newState,
  });
};

// ─── Gestures (Enable/Disable Player Gestures & Auto-Hide Mouse) ──────────────
// Registers the toggle action with a unique identifier for the Gestures feature
registerToggleAction("toggleGesturesEp", (el, isActive) => {
  // Pass the active/inactive state from the toggle handler directly to the function
  (window as any).toggleGesturesEp(isActive);
});

// Bind to the window scope for standard button onClick access
// and introduce a forceState parameter to handle specific states.
(window as any).toggleGesturesEp = function toggleGesturesEp(forceState?: boolean) {
  const buttonEl = document.getElementById(
    config.buttons.gesturesButton.id, // Targets "epGesturesToggleButton"
  ) as HTMLButtonElement;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement;

  if (!buttonEl || !svgEl) return debugHandler("E", "Gestures", "playerBehaviour.ts");

  // CRITICAL FIX: If called without a specific state (e.g., clicked from the standard button),
  // simply trigger a programmatic click on the ToggleButton component.
  // This allows the custom component's script to transition its internal state safely.
  if (forceState === undefined) {
    buttonEl.click();
    return;
  }

  // Otherwise, it means the custom toggle component itself triggered this callback with an explicit state.
  const newState = forceState;

  // DEBUG: Log the incoming state transition for gestures
  console.log(`[DEBUG: playerBehaviour.ts] toggleGesturesEp -> forceState received: ${newState}`);

  // Sync the global flag that playerGesturesAndMouse.ts reads on every gesture/mouse event.
  // Cast window to 'any' here since 'enablePlayerGestures' is declared on the extended
  // CustomWindow interface inside playerGesturesAndMouse.ts, not in this file's scope.
  (window as any).enablePlayerGestures = newState;

  // Sync the SVG inner HTML icon based on the active state
  if (svgEl) {
    svgEl.innerHTML = newState
      ? config.buttons.gesturesButton.symbols.active
      : config.buttons.gesturesButton.symbols.deactive;
  }

  // Explicitly keep the DOM attribute updated for custom toggle components
  buttonEl.setAttribute("data-togglestate", String(newState));

  // Save the synchronized state to local/session storage
  PlayerStorage.save({
    gestures: newState,
  });

  // DEBUG: Confirm the final synced state after save
  console.log(`[DEBUG: playerBehaviour.ts] toggleGesturesEp -> window.enablePlayerGestures is now: ${(window as any).enablePlayerGestures}`);
};

// ─── Keybinds (Enable/Disable Player Keybinds) ──────────────────────────────
// Registers the toggle action with a unique identifier for the Keybinds feature
registerToggleAction("toggleKeybindsEp", (el, isActive) => {
  // Pass the active/inactive state from the toggle handler directly to the function
  (window as any).toggleKeybindsEp(isActive);
});

// Bind to the window scope for standard button onClick access
// and introduce a forceState parameter to handle specific states.
(window as any).toggleKeybindsEp = function toggleKeybindsEp(forceState?: boolean) {
  const buttonEl = document.getElementById(
    config.buttons.keybindsButton.id, // Targets "epKeybindsToggleButton"
  ) as HTMLButtonElement;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement;

  if (!buttonEl || !svgEl) return debugHandler("E", "Keybinds", "playerBehaviour.ts");

  // CRITICAL FIX: If called without a specific state (e.g., clicked from the standard button),
  // simply trigger a programmatic click on the ToggleButton component.
  if (forceState === undefined) {
    buttonEl.click();
    return;
  }

  // Otherwise, it means the custom toggle component itself triggered this callback with an explicit state.
  const newState = forceState;

  // Sync the global flag that your upcoming keybinds script will read.
  (window as any).enablePlayerKeybinds = newState;

  // Sync the SVG inner HTML icon based on the active state
  if (svgEl) {
    svgEl.innerHTML = newState
      ? config.buttons.keybindsButton.symbols.active
      : config.buttons.keybindsButton.symbols.deactive;
  }

  // Explicitly keep the DOM attribute updated for custom toggle components
  buttonEl.setAttribute("data-togglestate", String(newState));

  // Save the synchronized state to local/session storage
  PlayerStorage.save({
    keybinds: newState,
  });
};
