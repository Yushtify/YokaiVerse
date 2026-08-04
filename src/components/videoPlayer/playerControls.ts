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
import { SettingsStorage } from "../pageComponents/settings/scripts/settingsStorage.ts";

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
  if (!buttonEl || !svgEl)
    return debugHandler("E", "Pause", "playerControls.ts");

  if (episodePlayer.paused === false) {
    // The video is playing
    episodePlayer.pause();
    svgEl.textContent = config.buttons.play.symbols.deactive;
  } else {
    // The video is paused
    episodePlayer.play();
    svgEl.textContent = config.buttons.play.symbols.active;
  }
};

// ─── Cinema Lights Frame Canvas ──────────────────────────────────────────────
// Draws the current video frame onto a canvas element (config.cinemaLightsID)
// on every animation frame while the video is playing. Drawing stops the
// instant the video is paused/ended — the canvas simply keeps its last frame.
let cinemaLightsRAF: number | null = null;

function drawCinemaLightsFrame(): void {
  const canvas = document.getElementById(
    config.cinemaLightsID,
  ) as HTMLCanvasElement | null;

  if (canvas) {
    // Skip drawing if the canvas is hidden via opacity (e.g., 'opacity-0')
    const computedStyle = window.getComputedStyle(canvas);
    if (computedStyle.opacity !== "0") {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(episodePlayer, 0, 0, canvas.width, canvas.height);
      }
    }
  }

  // Only keep scheduling frames while the video is actually playing
  if (!episodePlayer.paused && !episodePlayer.ended) {
    cinemaLightsRAF = requestAnimationFrame(drawCinemaLightsFrame);
  } else {
    cinemaLightsRAF = null;
  }
}

// Helper to draw a single frame immediately when scrubbing while paused
function drawSingleCinemaLightsFrame(): void {
  const canvas = document.getElementById(
    config.cinemaLightsID,
  ) as HTMLCanvasElement | null;

  if (canvas) {
    // Skip drawing if the canvas is hidden via opacity (e.g., 'opacity-0')
    const computedStyle = window.getComputedStyle(canvas);
    if (computedStyle.opacity !== "0") {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(episodePlayer, 0, 0, canvas.width, canvas.height);
      }
    }
  }
}

function startCinemaLightsLoop(): void {
  // Avoid stacking multiple loops if "play" fires more than once
  if (cinemaLightsRAF !== null) return;
  cinemaLightsRAF = requestAnimationFrame(drawCinemaLightsFrame);
}

function stopCinemaLightsLoop(): void {
  if (cinemaLightsRAF !== null) {
    cancelAnimationFrame(cinemaLightsRAF);
    cinemaLightsRAF = null;
  }
}

episodePlayer.addEventListener("play", startCinemaLightsLoop);
episodePlayer.addEventListener("pause", stopCinemaLightsLoop);
episodePlayer.addEventListener("ended", stopCinemaLightsLoop);

// Update canvas instantly when scrubbing/seeking while paused, respecting opacity-0
episodePlayer.addEventListener("seeked", () => {
  if (episodePlayer.paused) {
    drawSingleCinemaLightsFrame();
  }
});

// If the video is already playing when this script runs (e.g. autoplay),
// start the loop immediately instead of waiting for a "play" event.
if (!episodePlayer.paused) {
  startCinemaLightsLoop();
}

// ─── Fullscreen ──────────────────────────────────────────────────────────────
(window as any).epFullscreenToggle = function epFullscreenToggle() {
  const buttonEl = document.getElementById(
    config.buttons.fullscreen.id,
  ) as HTMLButtonElement;
  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement;
  if (!buttonEl || !svgEl)
    return debugHandler("E", "Fullscreen", "playerControls.ts");

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
  if (!buttonEl || !svgEl)
    return debugHandler("E", "Fullscreen", "playerControls.ts");

  const isFullscreen = !!window.document.fullscreenElement;

  configVariables.FullScreenValue = isFullscreen;

  svgEl.textContent = isFullscreen
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
  if (!buttonEl || !svgEl)
    return debugHandler("E", "Mute", "playerControls.ts");

  if (episodePlayer.volume > 0) {
    // The video is unmuted
    configVariables.LastVolume = episodePlayer.volume;
    episodePlayer.volume = 0;
    svgEl.textContent = config.buttons.mute.symbols.active;
  } else {
    // The video is muted
    // Check if the LastVolume is 0 or not. If it is, make it 100%, if not, assign it.
    if (configVariables.LastVolume !== 0) {
      episodePlayer.volume = configVariables.LastVolume;
      svgEl.textContent = getVolumeIcon(configVariables.LastVolume);
    } else {
      episodePlayer.volume = 1;
      svgEl.textContent = getVolumeIcon(episodePlayer.volume);
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
    svgEl.textContent = getVolumeIcon(volume);
  }

  // Save the new volume state to storage
  PlayerStorage.save({ volume: volume });
};

// ─── Timeline / Timestamp Sync ───────────────────────────────────────────────
// NOTE: the shared range-slider component only exposes an `oninput` prop, and
// its wheel handler only ever dispatches a synthetic "input" event (never
// "change"). So commit-on-release can't rely on "change" alone — a wheel
// scrub would never get committed. Instead we debounce the seek commit off
// of "input" itself (covers drag, wheel, and click-to-seek uniformly), and
// additionally flush immediately on native "change" (mouseup/keyup release)
// for a snappier feel when the user drags and lets go.

let isScrubbingTimeline = false;
let scrubCommitTimer: ReturnType<typeof setTimeout> | null = null;

// How long to wait after the last "input" event before committing a seek.
// Short enough to feel responsive, long enough to coalesce rapid wheel ticks
// into a single seek instead of one per tick.
const SCRUB_COMMIT_DELAY_MS = 150;

function formatTimestamp(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ss = String(s).padStart(2, "0");

  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function getTimelineElements(): {
  currentEl: HTMLElement | null;
  durationEl: HTMLElement | null;
  sliderEl: HTMLInputElement | null;
} {
  return {
    currentEl: document.getElementById(config.currentTimeID),
    durationEl: document.getElementById(config.durationTimeID),
    sliderEl: document.getElementById(
      config.timelineSliderID,
    ) as HTMLInputElement | null,
  };
}

// Keeps current_TimeStamp text + slider position in sync with playback.
// Skips slider updates while the user is actively scrubbing to avoid jitter
// (the slider's own value setter already re-renders the track gradient, so
// we don't need to call updateSliderTrack ourselves here).
function syncTimelineUI(): void {
  const { currentEl, durationEl, sliderEl } = getTimelineElements();
  if (!currentEl && !durationEl && !sliderEl) return;

  const current = episodePlayer.currentTime;
  const duration = episodePlayer.duration;

  if (currentEl) currentEl.textContent = formatTimestamp(current);
  if (durationEl && isFinite(duration)) {
    durationEl.textContent = formatTimestamp(duration);
  }

  if (sliderEl && !isScrubbingTimeline && isFinite(duration) && duration > 0) {
    sliderEl.value = String(current);

    // 1. Dispatch a synthetic 'input' event for the standard slider component (refreshes the gradient/purple bar)
    sliderEl.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // 2. Automatically notify the custom YokaiTimeline (or YouTubeTimeline) component of the current time
  const customTimelineEl = document.getElementById(
    config.timelineSliderID,
  ) as HTMLElement & {
    yokaiTimeline?: { setTime: (time: number) => void };
  };

  if (customTimelineEl && !isScrubbingTimeline) {
    // If the instance is directly accessible, call setTime
    if (
      customTimelineEl.yokaiTimeline &&
      typeof customTimelineEl.yokaiTimeline.setTime === "function"
    ) {
      customTimelineEl.yokaiTimeline.setTime(current);
    }

    // Otherwise, dispatch an event the timeline can listen for
    customTimelineEl.dispatchEvent(
      new CustomEvent("yokai:timeupdate", {
        detail: {
          time: current,
          percentage: duration > 0 ? (current / duration) * 100 : 0,
        },
        bubbles: true,
      }),
    );
  }
}

// 1. Function that handles duration change and updates the timeline
function handleDurationChange(): void {
  const duration = episodePlayer.duration;

  // If the duration is a valid number and greater than 0, proceed
  if (isFinite(duration) && duration > 0) {
    const { sliderEl, durationEl } = getTimelineElements();

    // Update the duration text
    if (durationEl) {
      durationEl.textContent = formatTimestamp(duration);
    }

    // Update the slider's max value
    if (sliderEl) {
      sliderEl.max = String(duration);
    }

    const settings = SettingsStorage.load();

    if (typeof (window as any).setSliderSections === "function") {
      if (settings.timelineSegments === false) {
        (window as any).setSliderSections(config.timelineSliderID, [
          { start: 0, end: duration, label: "Timeline" },
        ]);
      } else {
        // Split the video into Intro (first 90s), Main Part, and Outro (last 100s)
        const introEnd = Math.min(90, duration);
        const outroStart = Math.max(introEnd, duration - 100);

        (window as any).setSliderSections(config.timelineSliderID, [
          { start: 0, end: introEnd, label: "Intro" },
          { start: introEnd, end: outroStart, label: "Main" },
          { start: outroStart, end: duration, label: "Outro" },
        ]);
      }
    }
  }

  syncTimelineUI();
}

// 2. Add event listeners (for dynamic changes)
episodePlayer.addEventListener("loadedmetadata", handleDurationChange);
episodePlayer.addEventListener("durationchange", handleDurationChange);
episodePlayer.addEventListener("loadeddata", handleDurationChange);
episodePlayer.addEventListener("timeupdate", syncTimelineUI);

// 3. MOST IMPORTANT PART: if metadata is already loaded when the code runs, trigger immediately
if (episodePlayer.readyState >= 1) {
  // readyState >= 1 (HAVE_METADATA) means the duration is already known
  handleDurationChange();
}

function commitSeek(seconds: number): void {
  const duration = episodePlayer.duration;
  isScrubbingTimeline = false;
  if (scrubCommitTimer) {
    clearTimeout(scrubCommitTimer);
    scrubCommitTimer = null;
  }
  if (!isFinite(duration)) return;

  episodePlayer.currentTime = Math.min(Math.max(seconds, 0), duration);
}

// Called from the slider's oninput (drag, wheel-tick, or click-to-seek all
// funnel through here since it's a native input[type=range]). Updates the
// live timestamp label immediately, and debounces the actual seek so rapid
// wheel ticks or in-progress drags don't hammer episodePlayer.currentTime.
(window as any).scrubTimeline = function scrubTimeline(value: string): void {
  const seconds = parseFloat(value);
  if (isNaN(seconds)) return;

  isScrubbingTimeline = true;

  const { currentEl } = getTimelineElements();
  if (currentEl) currentEl.textContent = formatTimestamp(seconds);

  if (scrubCommitTimer) clearTimeout(scrubCommitTimer);
  scrubCommitTimer = setTimeout(
    () => commitSeek(seconds),
    SCRUB_COMMIT_DELAY_MS,
  );
};

// Timeline sürükleme esnasında videoyu durdurup, bırakılınca devam ettirme (Scrub-Pause-Resume)
let wasPlayingBeforeScrub = false;

document.addEventListener("DOMContentLoaded", () => {
  const { sliderEl } = getTimelineElements();
  sliderEl?.addEventListener("change", () => {
    commitSeek(parseFloat(sliderEl.value));
  });

  // Listen for the mobile/desktop drag event coming from YokaiTimeline
  const customTimelineEl = document.getElementById(config.timelineSliderID);
  if (customTimelineEl) {
    customTimelineEl.addEventListener("yokai:seek", ((e: CustomEvent) => {
      const { time, phase } = e.detail;

      // Instantly update the on-screen time/duration text while dragging
      const { currentEl } = getTimelineElements();
      if (currentEl) {
        currentEl.textContent = formatTimestamp(time);
      }

      if (phase === "start") {
        // Check if the video was playing when scrubbing started, and pause it immediately
        wasPlayingBeforeScrub = !episodePlayer.paused;
        if (wasPlayingBeforeScrub) {
          episodePlayer.pause();
        }
        episodePlayer.currentTime = time;
      } else if (phase === "move") {
        // Show live frames while dragging
        episodePlayer.currentTime = time;
      } else if (phase === "end") {
        // Finalize the time when scrubbing ends, and resume playback if it was playing before
        episodePlayer.currentTime = time;
        if (wasPlayingBeforeScrub) {
          episodePlayer.play();
        }
      } else {
        // If no phase is specified (e.g. when using the wheel), seek directly
        episodePlayer.currentTime = time;
      }
    }) as EventListener);
  }
});

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
      svgEl.textContent = getVolumeIcon(savedSettings.volume);
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
      const buttonEl = document.getElementById(
        config.buttons.loop.id,
      ) as HTMLButtonElement;
      if (buttonEl) {
        // Read the actual initial state rendered by the Astro component
        const currentToggleState =
          buttonEl.getAttribute("data-togglestate") === "true";

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
      const buttonEl = document.getElementById(
        config.buttons.autoPlay.id,
      ) as HTMLButtonElement;
      if (buttonEl) {
        // Read the actual initial state rendered by the Astro component
        const currentToggleState =
          buttonEl.getAttribute("data-togglestate") === "true";

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
      const buttonEl = document.getElementById(
        config.buttons.cinemaLightsButton.id,
      ) as HTMLButtonElement;
      if (buttonEl) {
        // Read the actual initial state rendered by the Astro component
        const currentToggleState =
          buttonEl.getAttribute("data-togglestate") === "true";

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
    console.log(
      `[DEBUG: playerControls.ts] Init -> loaded gestures state from storage: ${savedSettings.gestures}`,
    );

    // Set the global flag immediately so gesture handlers respect it even before the button syncs
    (window as any).enablePlayerGestures = savedSettings.gestures;

    // Use a tiny timeout to ensure the Astro ToggleButton component script is initialized
    setTimeout(() => {
      const buttonEl = document.getElementById(
        config.buttons.gesturesButton.id,
      ) as HTMLButtonElement;
      if (buttonEl) {
        // Read the actual initial state rendered by the Astro component
        const currentToggleState =
          buttonEl.getAttribute("data-togglestate") === "true";

        // If the saved storage state does not match the UI state, trigger a click to sync
        if (savedSettings.gestures !== currentToggleState) {
          buttonEl.click();
        } else {
          // If they already match, just trigger the function to ensure icons/flag are fully synced
          (window as any).toggleGesturesEp(savedSettings.gestures);
        }
      } else {
        // DEBUG: Warn if the gestures toggle button couldn't be found during init sync
        console.warn(
          "[WARN: playerControls.ts] Init -> epGesturesToggleButton element not found, skipping UI sync.",
        );
      }
    }, 50);
  }

  // Apply saved Keybinds state if it exists
  if (savedSettings.keybinds !== undefined) {
    // Set the global flag immediately so shortcut handlers respect it early on
    (window as any).enablePlayerKeybinds = savedSettings.keybinds;

    // Use a tiny timeout to ensure the Astro ToggleButton component script is initialized
    setTimeout(() => {
      const buttonEl = document.getElementById(
        config.buttons.keybindsButton.id,
      ) as HTMLButtonElement;
      if (buttonEl) {
        // Read the actual initial state rendered by the Astro component
        const currentToggleState =
          buttonEl.getAttribute("data-togglestate") === "true";

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
  const initialSpeed =
    savedSettings.playbackRate !== undefined
      ? String(savedSettings.playbackRate)
      : "1.0";
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

    const buttonEl = document.getElementById(
      targetButtonID,
    ) as HTMLButtonElement | null;

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
