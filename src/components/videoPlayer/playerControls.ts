import {
  config,
  episodePlayer,
  epPlayerContainer,
  configVariables,
  debugHandler,
} from "./playerConfig";
import { PlayerStorage } from "./playerStorage";
import { toggleSubtitles } from "./playerSubtitles";
import { setQualityMode, type QualityMode } from "./playerPlaybackSettings";

// Side-effect imports: these register window.* handlers and toggle actions
// (loop/autoPlay/gestures/keybinds, cinema lights). They must run so those
// bindings exist before DOMContentLoaded fires the init logic below.
import "./playerBehaviour";
import "./playerAppearance";

// ─── Play & Pause ────────────────────────────────────────────────────────────
(window as any).playEp = function playEp() {
  const buttonEl = document.getElementById(
    config.buttons.play.id,
  ) as HTMLButtonElement;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement;
  if (!buttonEl || !svgEl) return debugHandler("E", "Pause", "playerControls.ts");

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

// ─── Fullscreen ──────────────────────────────────────────────────────────────
(window as any).epFullscreenToggle = function epFullscreenToggle() {
  const buttonEl = document.getElementById(
    config.buttons.fullscreen.id,
  ) as HTMLButtonElement;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement;
  if (!buttonEl || !svgEl) return debugHandler("E", "Fullscreen", "playerControls.ts");

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
  if (!buttonEl || !svgEl) return debugHandler("E", "Fullscreen", "playerControls.ts");

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
  if (!buttonEl || !svgEl) return debugHandler("E", "Mute", "playerControls.ts");

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

  // Apply saved Quality mode if it exists, otherwise default to Auto.
  const initialQualityMode: QualityMode = savedSettings.quality ?? "1080";

  setTimeout(() => {
    const targetButtonID =
      initialQualityMode === "144"
        ? config.quality.buttonIDs.p144
        : initialQualityMode === "240"
          ? config.quality.buttonIDs.p240
          : initialQualityMode === "360"
            ? config.quality.buttonIDs.p360
            : initialQualityMode === "480"
              ? config.quality.buttonIDs.p480
              : initialQualityMode === "720"
                ? config.quality.buttonIDs.p720
                : config.quality.buttonIDs.p1080;

    const buttonEl = document.getElementById(targetButtonID) as HTMLButtonElement | null;

    if (buttonEl) {
      const isAlreadyActive = buttonEl.getAttribute("data-radstate") === "true";
      if (!isAlreadyActive) {
        buttonEl.click();
      } else {
        setQualityMode(initialQualityMode);
      }
    } else {
      setQualityMode(initialQualityMode);
    }
  }, 50);

  syncVolumeSlider();
});
