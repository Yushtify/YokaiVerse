// videoPlayerSettings.ts

import { registerToggleAction } from "../../scripts/toggleButtonHandler";
import { PlayerStorage } from "../../components/videoPlayer/playerStorage";

// ─── Gestures ───────────────────────────────────────────────────────
registerToggleAction("toggleGesturesEp", (el, isActive) => {
  (window as any).enablePlayerGestures = isActive;
  PlayerStorage.save({ gestures: isActive });
  // icon senkronu istersen: el üzerinden, config'e hiç gerek yok
  const svgEl = el.querySelector("#googleSymbol") as HTMLSpanElement | null;
  if (svgEl) svgEl.innerHTML = isActive ? "hand_gesture" : "hand_gesture_off";
});

// ─── Keybinds ───────────────────────────────────────────────────────
registerToggleAction("toggleKeybindsEp", (el, isActive) => {
  (window as any).enablePlayerKeybinds = isActive;
  PlayerStorage.save({ keybinds: isActive });
  const svgEl = el.querySelector("#googleSymbol") as HTMLSpanElement | null;
  if (svgEl) svgEl.innerHTML = isActive ? "keyboard" : "keyboard_off";
});

// ─── Init: sayfa açılınca kayıtlı state'i UI'ya yansıt ───────────────
document.addEventListener("DOMContentLoaded", () => {
  const saved = PlayerStorage.load();

  setTimeout(() => {
    if (saved.gestures !== undefined) {
      const btn = document.getElementById("settingsGesturesToggle") as HTMLButtonElement | null;
      if (btn && btn.getAttribute("data-togglestate") !== String(saved.gestures)) btn.click();
    }
    if (saved.keybinds !== undefined) {
      const btn = document.getElementById("settingsKeybindsToggle") as HTMLButtonElement | null;
      if (btn && btn.getAttribute("data-togglestate") !== String(saved.keybinds)) btn.click();
    }
  }, 50);
});
