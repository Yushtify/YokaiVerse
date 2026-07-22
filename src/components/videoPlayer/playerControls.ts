import { registerToggleAction } from "../../scripts/toggleButtonHandler";

// ─── Storage Configuration ──────────────────────────────────────────────────
// Toggle to completely enable/disable the saving system
const ENABLE_SAVING: boolean = true;
// true = localStorage (persistent across browser restarts)
// false = sessionStorage (clears when the tab is closed)
const USE_LOCAL_STORAGE: boolean = false;
const PLAYER_STORAGE_KEY: string = "epPlayerStorage";

interface PlayerSettings {
  volume?: number;
  lastVolume?: number;
  subtitles?: boolean;
  loop?: boolean;
  autoPlay?: boolean;
  cinemaLights?: boolean;
  playbackRate?: number;
  gestures?: boolean;
  keybinds?: boolean;
  // Note: Add future settings here (e.g., playbackRate?: number, subtitles?: boolean)
}

// Modular Storage System - Renamed to PlayerStorage to avoid TS global scope collisions
const PlayerStorage = {
  getStorage(): Storage | null {
    if (!ENABLE_SAVING) return null;
    return USE_LOCAL_STORAGE ? window.localStorage : window.sessionStorage;
  },

  save(settings: Partial<PlayerSettings>): void {
    const storage = this.getStorage();
    if (!storage) return;

    // Load existing settings to avoid overwriting other saved properties
    const existingSettings = this.load();
    const updatedSettings = { ...existingSettings, ...settings };

    storage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(updatedSettings));
  },

  load(): PlayerSettings {
    const storage = this.getStorage();
    if (!storage) return {};

    const data = storage.getItem(PLAYER_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  },
};

// ─── Player Configuration ──────────────────────────────────────────────────
interface ButtonConfig {
  id: string;
  symbols: {
    active: string;
    deactive: string;
  };
}

interface PlayerConfig {
  epPlayercontainerID: string;
  episodePlayerID: string;
  GoogleMaterialSymbol: string;
  buttons: {
    play: ButtonConfig;
    mute: ButtonConfig;
    subtitles: ButtonConfig;
    settings: ButtonConfig;
    fullscreen: ButtonConfig;
    loop: ButtonConfig;
    autoPlay: ButtonConfig;
    cinemaLightsButton: ButtonConfig;
    gesturesButton: ButtonConfig;
    keybindsButton: ButtonConfig;
  };
  volumeSliderID: string;
  subtitleBarID: string;
  cinemaLightsID: string;
  playbackSpeedSliderID: string;
  currentPlaybackSpeedTxtID: string;
  epControlContainerID: string;
}

const config: PlayerConfig = {
  epPlayercontainerID: "epPlayerContainer",
  episodePlayerID: "episodePlayer",
  GoogleMaterialSymbol: "#googleSymbol",
  buttons: {
    play: {
      id: "epPlayButton",
      symbols: { active: "pause", deactive: "play_arrow" },
    },
    mute: {
      id: "epMuteButton",
      symbols: { active: "volume_off", deactive: "volume_up" },
    },
    subtitles: {
      id: "epSubtitlesButton",
      symbols: { active: "subtitles", deactive: "subtitles_off" },
    },
    settings: {
      id: "epSettingsButton",
      symbols: { active: "settings", deactive: "settings" },
    },
    fullscreen: {
      id: "epFullscreenButton",
      symbols: { active: "collapse_content", deactive: "expand_content" },
    },
    loop: {
      id: "epLoopToggleButton",
      symbols: { active: "repeat_one", deactive: "repeat" },
    },
    autoPlay: {
      id: "epAutoPlayToggleButton",
      symbols: { active: "autoplay", deactive: "autopause" },
    },
    cinemaLightsButton: {
      id: "epCinemaLightsToggleButton",
      symbols: { active: "cinematic_blur", deactive: "movie_off" },
    },
    gesturesButton: {
      id: "epGesturesToggleButton",
      symbols: { active: "hand_gesture", deactive: "hand_gesture_off" },
    },
    keybindsButton: {
      id: "epKeybindsToggleButton",
      symbols: { active: "keyboard", deactive: "keyboard_off" },
    },
  },
  volumeSliderID: "volumeSlider",
  subtitleBarID: "subtitleBar",
  cinemaLightsID: "epCinemaLights",
  playbackSpeedSliderID: "epPlaybackSpeedSlider",
  currentPlaybackSpeedTxtID: "epCurrentPlaybackSpeed",
  epControlContainerID: "epControlContainer",
};

const episodePlayer = document.getElementById(
  config.episodePlayerID,
) as HTMLVideoElement;
const epPlayerContainer = document.getElementById(
  config.epPlayercontainerID,
) as HTMLDivElement;

interface configVariablesValidator {
  LastVolume: number;
  FullScreenValue: boolean;
}

// Quick Variables
let configVariables: configVariablesValidator = {
  LastVolume: 0,
  FullScreenValue: false,
};

function debugHandler(Priority: "E" | "W" | "L", Name: string) {
  if (Priority === "E") {
    console.error(
      "[ERROR: playerControls.ts] " +
        "The " +
        Name +
        " button and it's symbol not found.",
    );
  }
}

// ─── Play & Pause ────────────────────────────────────────────────────────────
(window as any).playEp = function playEp() {
  const buttonEl = document.getElementById(
    config.buttons.play.id,
  ) as HTMLButtonElement;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement;
  if (!buttonEl || !svgEl) return debugHandler("E", "Pause");

  if (episodePlayer.paused === false) {
    // The video is playing
    episodePlayer.pause();
    svgEl.innerHTML = config.buttons.play.symbols.deactive;
  } else {
    // The video is paused
    episodePlayer.play();
    svgEl.innerHTML = config.buttons.play.symbols.active;
  }
};

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

  if (!buttonEl) return debugHandler("E", "Loop");

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

  if (!buttonEl) return debugHandler("E", "Auto Play");

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

  if (!buttonEl || !svgEl || !cinemaLightsEl) return debugHandler("E", "Cinema Lights");

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

  if (!buttonEl || !svgEl) return debugHandler("E", "Gestures");

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
  console.log(`[DEBUG: playerControls.ts] toggleGesturesEp -> forceState received: ${newState}`);

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
  console.log(`[DEBUG: playerControls.ts] toggleGesturesEp -> window.enablePlayerGestures is now: ${(window as any).enablePlayerGestures}`);
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

  if (!buttonEl || !svgEl) return debugHandler("E", "Keybinds");

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

// ─── Playback Speed ──────────────────────────────────────────────────────────
(window as any).playbackSpeedEp = function playbackSpeedEp(value: string): void {
  let speed = parseFloat(value);

  // Validation: If it's not a number, below 0.1, or above 7.0, fallback to 1.0x
  if (isNaN(speed) || speed < 0.1 || speed > 7) {
    speed = 1.0;
  }

  // CRITICAL FIX: Set both defaultPlaybackRate and playbackRate to prevent browser resets
  episodePlayer.defaultPlaybackRate = speed;
  episodePlayer.playbackRate = speed;

  // Sync the speed slider input value
  const slider = document.getElementById(
    config.playbackSpeedSliderID,
  ) as HTMLInputElement | null;
  if (slider) {
    slider.value = String(speed);
  }

  // Sync the text display (e.g., "1x", "1.5x", etc.)
  const txtEl = document.getElementById(
    config.currentPlaybackSpeedTxtID,
  ) as HTMLElement | null;
  if (txtEl) {
    txtEl.innerText = `${speed}x`;
  }

  // Save the synchronized speed state to local/session storage
  PlayerStorage.save({
    playbackRate: speed,
  });
};

// ─── Fullscreen ──────────────────────────────────────────────────────────────
(window as any).epFullscreenToggle = function epFullscreenToggle() {
  const buttonEl = document.getElementById(
    config.buttons.fullscreen.id,
  ) as HTMLButtonElement;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement;
  if (!buttonEl || !svgEl) return debugHandler("E", "Fullscreen");

  if (configVariables.FullScreenValue === true) {
    document.exitFullscreen();
  } else {
    epPlayerContainer.requestFullscreen();
  }
};

// fullscreenchange: single source of truth — all UI updates happen here
window.document.addEventListener("fullscreenchange", () => {
  const buttonEl = document.getElementById(
    config.buttons.fullscreen.id,
  ) as HTMLButtonElement;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement;
  if (!buttonEl || !svgEl) return debugHandler("E", "Fullscreen");

  const isFullscreen = !!window.document.fullscreenElement;

  configVariables.FullScreenValue = isFullscreen;

  svgEl.innerHTML = isFullscreen
    ? config.buttons.fullscreen.symbols.active
    : config.buttons.fullscreen.symbols.deactive;

  epPlayerContainer.classList.toggle("rounded-3xl", !isFullscreen);
  episodePlayer.classList.toggle("rounded-3xl", !isFullscreen);
});

// ─── Mute & Unmute ───────────────────────────────────────────────────────────
function getVolumeIcon(volume: number): string {
  if (volume === 0) return "volume_off";
  if (volume <= 0.33) return "volume_mute";
  if (volume <= 0.66) return "volume_down";
  return "volume_up";
}

(window as any).muteEp = function muteEp() {
  const buttonEl = document.getElementById(
    config.buttons.mute.id,
  ) as HTMLButtonElement;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement;
  if (!buttonEl || !svgEl) return debugHandler("E", "Mute");

  if (episodePlayer.volume > 0) {
    // The video is unmuted
    configVariables.LastVolume = episodePlayer.volume;
    episodePlayer.volume = 0;
    svgEl.innerHTML = config.buttons.mute.symbols.active;
  } else {
    // The video is muted
    // Check if the LastVolume is 0 or not. If it is, make it 100%, if not, assign it.
    if (configVariables.LastVolume !== 0) {
      episodePlayer.volume = configVariables.LastVolume;
      svgEl.innerHTML = getVolumeIcon(configVariables.LastVolume);
    } else {
      episodePlayer.volume = 1;
      svgEl.innerHTML = getVolumeIcon(episodePlayer.volume);
    }
  }

  syncVolumeSlider();

  // Save the new volume states to storage
  PlayerStorage.save({
    volume: episodePlayer.volume,
    lastVolume: configVariables.LastVolume,
  });
};

// ─── Volume Slider ───────────────────────────────────────────────────────────
function syncVolumeSlider(): void {
  const slider = document.getElementById(
    config.volumeSliderID,
  ) as HTMLInputElement | null;
  if (!slider) return;
  slider.value = String(episodePlayer.volume);
}

(window as any).updateVolume = function updateVolume(value: string): void {
  const volume = parseFloat(value);
  if (isNaN(volume)) return;

  const buttonEl = document.getElementById(
    config.buttons.mute.id,
  ) as HTMLButtonElement;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement;

  episodePlayer.volume = volume;

  if (svgEl) {
    svgEl.innerHTML = getVolumeIcon(volume);
  }

  // Save the new volume state to storage
  PlayerStorage.save({ volume: volume });
};

// ─── Subtitles ──────────────────────────────────────────────────────────
function toggleSubtitles(forceState?: boolean) {
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
    return debugHandler("E", "Subtitles");

  // Determine current visibility via class check
  const isCurrentlyVisible = subtitleBar.classList.contains("opacity-100");

  // Use forced state if provided (from storage init), otherwise flip current state
  const showSubtitles =
    forceState !== undefined ? forceState : !isCurrentlyVisible;

  if (showSubtitles) {
    subtitleBar.classList.remove("opacity-0");
    subtitleBar.classList.add("opacity-100");
    svgEl.innerHTML = config.buttons.subtitles.symbols.active;
    console.log("subs on");
  } else {
    subtitleBar.classList.remove("opacity-100");
    subtitleBar.classList.add("opacity-0");
    svgEl.innerHTML = config.buttons.subtitles.symbols.deactive;
    console.log("subs off");
  }

  PlayerStorage.save({ subtitles: showSubtitles });
}

// Bind to window scope so HTML elements can target it
(window as any).toggleSubtitles = toggleSubtitles;

// ─── Initialization ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Load saved settings when the player starts
  const savedSettings = PlayerStorage.load();

  // Apply saved volume if it exists
  if (savedSettings.volume !== undefined) {
    episodePlayer.volume = savedSettings.volume;

    // Update the volume icon UI based on the loaded volume
    const buttonEl = document.getElementById(
      config.buttons.mute.id,
    ) as HTMLButtonElement;
    const svgEl = buttonEl?.querySelector(
      config.GoogleMaterialSymbol,
    ) as HTMLSpanElement;
    if (svgEl) {
      svgEl.innerHTML = getVolumeIcon(savedSettings.volume);
    }
  }

  // Safely passes saved boolean state to toggleSubtitles
  if (savedSettings.subtitles !== undefined) {
    toggleSubtitles(savedSettings.subtitles);
  }

  // Apply saved LastVolume if it exists
  if (savedSettings.lastVolume !== undefined) {
    configVariables.LastVolume = savedSettings.lastVolume;
  }

  // Apply saved Loop if it exists
    if (savedSettings.loop !== undefined) {
      // Set the initial video loop property immediately
      episodePlayer.loop = savedSettings.loop;

      // Use a tiny timeout to ensure the Astro ToggleButton component script is initialized
      setTimeout(() => {
        const buttonEl = document.getElementById(config.buttons.loop.id) as HTMLButtonElement;
        if (buttonEl) {
          // Read the actual initial state rendered by the Astro component
          const currentToggleState = buttonEl.getAttribute("data-togglestate") === "true";

          // If the saved storage state (e.g., false) does not match the UI state (e.g., true),
          // trigger a programmatic click to let the component safely toggle its internal state & UI.
          if (savedSettings.loop !== currentToggleState) {
            buttonEl.click();
          } else {
            // If they already match, just trigger the function to ensure icons/attributes are fully synced
            (window as any).loopEp(savedSettings.loop);
          }
        }
      }, 50);
    }

  // Apply saved AutoPlay if it exists
    if (savedSettings.autoPlay !== undefined) {
      // Set the initial video autoplay property immediately
      episodePlayer.autoplay = savedSettings.autoPlay;

      // Use a tiny timeout to ensure the Astro ToggleButton component script is initialized
      setTimeout(() => {
        const buttonEl = document.getElementById(config.buttons.autoPlay.id) as HTMLButtonElement;
        if (buttonEl) {
          // Read the actual initial state rendered by the Astro component
          const currentToggleState = buttonEl.getAttribute("data-togglestate") === "true";

          // If the saved storage state (e.g., false) does not match the UI state (e.g., true),
          // trigger a programmatic click to let the component safely toggle its internal state & UI.
          if (savedSettings.autoPlay !== currentToggleState) {
            buttonEl.click();
          } else {
            // If they already match, just trigger the function to ensure icons are fully synced
            (window as any).autoPlayEp(savedSettings.autoPlay);
          }
        }
      }, 50);
    }

  // Apply saved Cinema Lights if it exists
  if (savedSettings.cinemaLights !== undefined) {
        // Use a tiny timeout to ensure the Astro ToggleButton component script is initialized
        setTimeout(() => {
          const buttonEl = document.getElementById(config.buttons.cinemaLightsButton.id) as HTMLButtonElement;
          if (buttonEl) {
            // Read the actual initial state rendered by the Astro component
            const currentToggleState = buttonEl.getAttribute("data-togglestate") === "true";

            // If the saved storage state does not match the UI state, trigger a click to sync
            if (savedSettings.cinemaLights !== currentToggleState) {
              buttonEl.click();
            } else {
              // If they already match, just trigger the function to ensure the overlay and icons are fully synced
              (window as any).cinemaLightEp(savedSettings.cinemaLights);
            }
          }
        }, 50);
  }

  // Apply saved Gestures state if it exists
  if (savedSettings.gestures !== undefined) {
    // DEBUG: Log the loaded gestures state before applying it
    console.log(`[DEBUG: playerControls.ts] Init -> loaded gestures state from storage: ${savedSettings.gestures}`);

    // Set the global flag immediately so gesture handlers respect it even before the button syncs
    (window as any).enablePlayerGestures = savedSettings.gestures;

    // Use a tiny timeout to ensure the Astro ToggleButton component script is initialized
    setTimeout(() => {
      const buttonEl = document.getElementById(config.buttons.gesturesButton.id) as HTMLButtonElement;
      if (buttonEl) {
        // Read the actual initial state rendered by the Astro component
        const currentToggleState = buttonEl.getAttribute("data-togglestate") === "true";

        // If the saved storage state does not match the UI state, trigger a click to sync
        if (savedSettings.gestures !== currentToggleState) {
          buttonEl.click();
        } else {
          // If they already match, just trigger the function to ensure icons/flag are fully synced
          (window as any).toggleGesturesEp(savedSettings.gestures);
        }
      } else {
        // DEBUG: Warn if the gestures toggle button couldn't be found during init sync
        console.warn("[WARN: playerControls.ts] Init -> epGesturesToggleButton element not found, skipping UI sync.");
      }
    }, 50);
  }

  // Apply saved Keybinds state if it exists
  if (savedSettings.keybinds !== undefined) {
      // Set the global flag immediately so shortcut handlers respect it early on
      (window as any).enablePlayerKeybinds = savedSettings.keybinds;

      // Use a tiny timeout to ensure the Astro ToggleButton component script is initialized
      setTimeout(() => {
        const buttonEl = document.getElementById(config.buttons.keybindsButton.id) as HTMLButtonElement;
        if (buttonEl) {
          // Read the actual initial state rendered by the Astro component
          const currentToggleState = buttonEl.getAttribute("data-togglestate") === "true";

          // If the saved storage state does not match the UI state, trigger a click to sync
          if (savedSettings.keybinds !== currentToggleState) {
            buttonEl.click();
          } else {
            // If they already match, just trigger the function to ensure icons/flag are fully synced
            (window as any).toggleKeybindsEp(savedSettings.keybinds);
          }
        }
      }, 50);
    }

  // Apply saved Playback Speed if it exists, otherwise initialize to default 1.0x
    const initialSpeed = savedSettings.playbackRate !== undefined ? String(savedSettings.playbackRate) : "1.0";
    (window as any).playbackSpeedEp(initialSpeed);
    episodePlayer.addEventListener("loadedmetadata", () => {
      const currentSettings = PlayerStorage.load();
      if (currentSettings.playbackRate !== undefined) {
        episodePlayer.playbackRate = currentSettings.playbackRate;
      }
    });

  syncVolumeSlider();
});
