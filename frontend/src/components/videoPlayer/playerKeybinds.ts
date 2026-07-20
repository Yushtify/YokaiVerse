/**
 * playerKeybinds.ts
 *
 * This module listens to keyboard events and maps them to the video player actions
 * defined globally (on the window object) inside playerControls.ts.
 *
 * Requirements:
 * 1. English comments only.
 * 2. Robust debugging logs and error boundaries.
 */

// Define typed window interface to avoid TypeScript compilations errors
interface CustomWindow extends Window {
  playEp?: () => void;
  muteEp?: () => void;
  loopEp?: (forceState?: boolean) => void;
  autoPlayEp?: (forceState?: boolean) => void;
  cinemaLightEp?: (forceState?: boolean) => void;
  playbackSpeedEp?: (value: string) => void;
  epFullscreenToggle?: () => void;
  toggleSubtitles?: (forceState?: boolean) => void;
  updateVolume?: (value: string) => void;
  toggleGesturesEp?: (forceState?: boolean) => void;
  toggleKeybindsEp?: (forceState?: boolean) => void;
  enablePlayerKeybinds?: boolean;
}

const customWindow = window as unknown as CustomWindow;

// Configuration for Keybindings
const KEY_CONFIG = {
  PLAY_PAUSE: ["Space", "KeyK"],
  MUTE: ["KeyM"],
  FULLSCREEN: ["KeyF"],
  LOOP: ["KeyL"],
  AUTOPLAY: ["KeyA"],
  CINEMA_MODE: ["KeyC"],
  SUBTITLES: ["KeyS"],
  VOLUME_UP: ["ArrowUp"],
  VOLUME_DOWN: ["ArrowDown"],
  SEEK_FORWARD: ["ArrowRight"],
  SEEK_BACKWARD: ["ArrowLeft"],
  SPEED_UP: ["BracketRight", "Period"], // ']' or '.'
  SPEED_DOWN: ["BracketLeft", "Comma"], // '[' or ','
  GESTURES: ["KeyG"],
  KEYBINDS: ["KeyB"],
};

// Target IDs matching playerControls.ts
const EP_PLAYER_ID = "episodePlayer";
const VOLUME_SLIDER_ID = "volumeSlider";

// Debug helper for logging keystroke events
function logDebug(action: string, detail: string = "") {
  console.log(`[DEBUG: playerKeybinds.ts] Action executed: ${action} ${detail ? `(${detail})` : ""}`);
}

// Debug helper for reporting missing resources or window methods
function logWarning(methodName: string) {
  console.warn(`[WARN: playerKeybinds.ts] Attempted to call 'window.${methodName}', but it is not defined!`);
}

document.addEventListener("DOMContentLoaded", () => {
  const episodePlayer = document.getElementById(EP_PLAYER_ID) as HTMLVideoElement | null;

  if (!episodePlayer) {
    console.error(`[ERROR: playerKeybinds.ts] Critical Error: Video element with ID '${EP_PLAYER_ID}' was not found. Keybinds initialization failed.`);
    return;
  }

  logDebug("Initialization", "Keybind listener successfully attached to the document.");

  // Centralized keyboard event listener
  document.addEventListener("keydown", (event: KeyboardEvent) => {
    const activeElement = document.activeElement;

    // CRITICAL SECURITY CHECK: Disable hotkeys if user is actively typing in form inputs, textareas, etc.
    if (
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.isContentEditable)
    ) {
      return;
    }

    const keyCode = event.code;

    // --- KEYBINDS MASTER TOGGLE CONTROL ---
    // If the key is NOT the toggle key itself and keybinds are disabled, block all hotkeys
    if (!KEY_CONFIG.KEYBINDS.includes(keyCode) && customWindow.enablePlayerKeybinds === false) {
      return;
    }

    // --- PLAY / PAUSE ---
    if (KEY_CONFIG.PLAY_PAUSE.includes(keyCode)) {
      event.preventDefault(); // Stop spacebar from scrolling down the page
      if (customWindow.playEp) {
        customWindow.playEp();
        logDebug("Play/Pause Toggle");
      } else {
        logWarning("playEp");
      }
    }

    // --- MUTE / UNMUTE ---
    else if (KEY_CONFIG.MUTE.includes(keyCode)) {
      event.preventDefault();
      if (customWindow.muteEp) {
        customWindow.muteEp();
        logDebug("Mute/Unmute Toggle");
      } else {
        logWarning("muteEp");
      }
    }

    // --- FULLSCREEN ---
    else if (KEY_CONFIG.FULLSCREEN.includes(keyCode)) {
      event.preventDefault();
      if (customWindow.epFullscreenToggle) {
        customWindow.epFullscreenToggle();
        logDebug("Fullscreen Toggle");
      } else {
        logWarning("epFullscreenToggle");
      }
    }

    // --- LOOP ---
    else if (KEY_CONFIG.LOOP.includes(keyCode)) {
      event.preventDefault();
      if (customWindow.loopEp) {
        // Triggers programmatic click as designed in playerControls.ts (handles Astro Toggle state)
        customWindow.loopEp();
        logDebug("Loop Toggle");
      } else {
        logWarning("loopEp");
      }
    }

    // --- AUTOPLAY ---
    else if (KEY_CONFIG.AUTOPLAY.includes(keyCode)) {
      event.preventDefault();
      if (customWindow.autoPlayEp) {
        customWindow.autoPlayEp();
        logDebug("Autoplay Toggle");
      } else {
        logWarning("autoPlayEp");
      }
    }

    // --- CINEMA MODE ---
    else if (KEY_CONFIG.CINEMA_MODE.includes(keyCode)) {
      event.preventDefault();
      if (customWindow.cinemaLightEp) {
        customWindow.cinemaLightEp();
        logDebug("Cinema Mode Toggle");
      } else {
        logWarning("cinemaLightEp");
      }
    }

    // --- SUBTITLES ---
    else if (KEY_CONFIG.SUBTITLES.includes(keyCode)) {
      event.preventDefault();
      if (customWindow.toggleSubtitles) {
        customWindow.toggleSubtitles();
        logDebug("Subtitles Toggle");
      } else {
        logWarning("toggleSubtitles");
      }
    }

    // --- VOLUME UP (+10%) ---
    else if (KEY_CONFIG.VOLUME_UP.includes(keyCode)) {
      event.preventDefault(); // Stop default browser page scroll
      if (customWindow.updateVolume) {
        const newVolume = Math.min(1, episodePlayer.volume + 0.1);
        customWindow.updateVolume(newVolume.toFixed(2));

        // Update UI Volume Slider to keep visual layout synchronized
        const volumeSlider = document.getElementById(VOLUME_SLIDER_ID) as HTMLInputElement | null;
        if (volumeSlider) {
          volumeSlider.value = String(newVolume);
        }

        logDebug("Volume Increased", `${Math.round(newVolume * 100)}%`);
      } else {
        logWarning("updateVolume");
      }
    }

    // --- VOLUME DOWN (-10%) ---
    else if (KEY_CONFIG.VOLUME_DOWN.includes(keyCode)) {
      event.preventDefault();
      if (customWindow.updateVolume) {
        const newVolume = Math.max(0, episodePlayer.volume - 0.1);
        customWindow.updateVolume(newVolume.toFixed(2));

        const volumeSlider = document.getElementById(VOLUME_SLIDER_ID) as HTMLInputElement | null;
        if (volumeSlider) {
          volumeSlider.value = String(newVolume);
        }

        logDebug("Volume Decreased", `${Math.round(newVolume * 100)}%`);
      } else {
        logWarning("updateVolume");
      }
    }

    // --- SEEK FORWARD (+5 SECONDS) ---
    else if (KEY_CONFIG.SEEK_FORWARD.includes(keyCode)) {
      event.preventDefault();
      const targetTime = Math.min(episodePlayer.duration, episodePlayer.currentTime + 5);
      episodePlayer.currentTime = targetTime;
      logDebug("Seek Forward", `+5s to ${Math.round(targetTime)}s`);
    }

    // --- SEEK BACKWARD (-5 SECONDS) ---
    else if (KEY_CONFIG.SEEK_BACKWARD.includes(keyCode)) {
      event.preventDefault();
      const targetTime = Math.max(0, episodePlayer.currentTime - 5);
      episodePlayer.currentTime = targetTime;
      logDebug("Seek Backward", `-5s to ${Math.round(targetTime)}s`);
    }

    // --- PLAYBACK SPEED UP (+0.25x) ---
    else if (KEY_CONFIG.SPEED_UP.includes(keyCode)) {
      event.preventDefault();
      if (customWindow.playbackSpeedEp) {
        const currentSpeed = episodePlayer.playbackRate;
        const targetSpeed = Math.min(7.0, currentSpeed + 0.25);
        customWindow.playbackSpeedEp(targetSpeed.toFixed(2));
        logDebug("Playback Speed Increased", `${targetSpeed}x`);
      } else {
        logWarning("playbackSpeedEp");
      }
    }

    // --- PLAYBACK SPEED DOWN (-0.25x) ---
    else if (KEY_CONFIG.SPEED_DOWN.includes(keyCode)) {
      event.preventDefault();
      if (customWindow.playbackSpeedEp) {
        const currentSpeed = episodePlayer.playbackRate;
        const targetSpeed = Math.max(0.25, currentSpeed - 0.25);
        customWindow.playbackSpeedEp(targetSpeed.toFixed(2));
        logDebug("Playback Speed Decreased", `${targetSpeed}x`);
      } else {
        logWarning("playbackSpeedEp");
      }
    }

    // --- GESTURES ---
    else if (KEY_CONFIG.GESTURES.includes(keyCode)) {
      event.preventDefault();
      if (customWindow.toggleGesturesEp) {
        customWindow.toggleGesturesEp();
        logDebug("Gestures Toggle");
      } else {
        logWarning("toggleGesturesEp");
      }
    }

    // --- KEYBINDS MASTER TOGGLE ---
    else if (KEY_CONFIG.KEYBINDS.includes(keyCode)) {
      event.preventDefault();
      if (customWindow.toggleKeybindsEp) {
        customWindow.toggleKeybindsEp();
        logDebug("Keybinds Master Toggle");
      } else {
        logWarning("toggleKeybindsEp");
      }
    }
  });
});
