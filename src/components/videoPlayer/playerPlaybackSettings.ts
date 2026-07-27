import { config, episodePlayer } from "./playerConfig";
import { PlayerStorage } from "./playerStorage";

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

// ─── Quality Switching (Auto network-adaptive + Manual 144p-1080p) ───────────
// Design constraint: the master video is only ever encoded/stored at 1080p
// once — renditions (144p/240p/360p/480p/720p/1080p) are pre-generated on
// disk by an ffmpeg batch job (see generate_renditions.sh) so we never
// duplicate the source at authoring time, we just point <video> at the
// rendition file that fits the current network condition.
//
// Convention: the <video> element carries a data-video-base attribute
// pointing at the folder containing "{height}p.webm" files, e.g.
//   <video id="episodePlayer" data-video-base="/videos/some-slug">
// Adjust buildQualitySrc() below if your actual path convention differs.

export type QualityMode = "144" | "240" | "360" | "480" | "720" | "1080";

interface QualityState {
  mode: QualityMode;
  // The concrete rendition height ACTUALLY committed and playing right now.
  // Only updated once a switch fully completes (canplay + seeked resolved),
  // never optimistically — this is what prevents the state from claiming
  // "switched" while a request is still mid-flight or failed.
  activeHeight: number;
}

const qualityState: QualityState = {
  mode: "1080",
  activeHeight: 1080,
};

function buildQualitySrc(height: number): string {
  const base = episodePlayer.getAttribute(config.quality.videoBaseAttr);
  if (!base) {
    console.error(
      `[ERROR: playerPlaybackSettings.ts] episodePlayer is missing the ${config.quality.videoBaseAttr} attribute; cannot resolve quality renditions.`,
    );
    return episodePlayer.currentSrc;
  }
  return `${base.replace(/\/$/, "")}/${height}p.webm`;
}

function updateQualityLabel(height: number, mode: QualityMode): void {
  const txtEl = document.getElementById(
    config.quality.currentQualityTextID,
  ) as HTMLElement | null;
  if (!txtEl) return;
  txtEl.innerText = `${height}p`;
}

// ── Switch state machine ─────────────────────────────────────────────────
// isSwitchingQuality: true while a rendition swap is actually in flight.
// pendingQuality: the most recent request that arrived WHILE a switch was
//   in flight. Only ever holds the latest request (later clicks overwrite
//   earlier ones), so rapid clicking naturally debounces down to a single
//   final switch instead of queueing every intermediate click.
let isSwitchingQuality = false;
let pendingQuality: { height: number; mode: QualityMode } | null = null;
let qualitySwitchTimeoutHandle: number | null = null;

// Safety net in case canplay/seeked never fire (broken rendition file,
// dropped connection, etc). Without this a failed switch would leave
// isSwitchingQuality stuck at true forever, permanently freezing the
// quality switcher.
const QUALITY_SWITCH_TIMEOUT_MS = 15000;

function clearQualitySwitchTimeout(): void {
  if (qualitySwitchTimeoutHandle !== null) {
    window.clearTimeout(qualitySwitchTimeoutHandle);
    qualitySwitchTimeoutHandle = null;
  }
}

// Called whenever an in-flight switch ends, whether it succeeded, errored,
// or timed out. Unlocks the switcher and immediately fires off any queued
// request so the video never ends up "stuck" out of sync with whichever
// radio button the user last clicked.
function finishQualitySwitch(): void {
  isSwitchingQuality = false;
  clearQualitySwitchTimeout();

  if (pendingQuality) {
    const next = pendingQuality;
    pendingQuality = null;
    applyQualityRendition(next.height, next.mode);
  }
}

// Swaps the <video> src to the target rendition while preserving
// playback position and play/pause state, so switching is invisible
// to the user beyond a brief re-buffer.
function applyQualityRendition(height: number, mode: QualityMode): void {
  // Already showing this exact rendition and nothing else is queued -> no-op
  if (
    !isSwitchingQuality &&
    !pendingQuality &&
    qualityState.activeHeight === height &&
    qualityState.mode === mode
  ) {
    return;
  }

  if (isSwitchingQuality) {
    // CRITICAL FIX: previously this just `return`ed here, silently dropping
    // the click. The radio button UI had already flipped to the new
    // selection (radioButtonCore manages that independently), so the video
    // would stay on whatever rendition was mid-switch while the UI claimed
    // something else was active. Now we queue it and it gets applied the
    // instant the current switch finishes.
    pendingQuality = { height, mode };
    // Reflect the latest requested quality in the label right away so the
    // UI feels responsive even while the actual swap is still buffering.
    updateQualityLabel(height, mode);
    console.log(
      `[DEBUG: playerPlaybackSettings.ts] Quality switch in progress, queued request -> mode: ${mode}, height: ${height}p`,
    );
    return;
  }

  isSwitchingQuality = true;
  updateQualityLabel(height, mode);

  const wasPlaying = !episodePlayer.paused;
  const resumeAt = episodePlayer.currentTime;
  const newSrc = buildQualitySrc(height);

  episodePlayer.src = newSrc;
  episodePlayer.load();

  clearQualitySwitchTimeout();
  qualitySwitchTimeoutHandle = window.setTimeout(() => {
    console.warn(
      `[WARN: playerPlaybackSettings.ts] Quality switch to ${height}p timed out after ${QUALITY_SWITCH_TIMEOUT_MS}ms, unlocking switcher.`,
    );
    finishQualitySwitch();
  }, QUALITY_SWITCH_TIMEOUT_MS);

  const onError = () => {
    episodePlayer.removeEventListener("canplay", onCanPlay);
    console.error(
      `[ERROR: playerPlaybackSettings.ts] Failed to load rendition ${height}p from ${newSrc}`,
    );
    finishQualitySwitch();
  };

  const onCanPlay = () => {
    episodePlayer.removeEventListener("error", onError);
    episodePlayer.currentTime = resumeAt;

    episodePlayer.addEventListener(
      "seeked",
      async () => {
        if (wasPlaying) {
          try {
            await episodePlayer.play();
          } catch {}
        }

        // Only commit the state once the switch has actually succeeded.
        qualityState.activeHeight = height;
        qualityState.mode = mode;

        console.log(
          `[DEBUG: playerPlaybackSettings.ts] Quality switched -> mode: ${mode}, height: ${height}p, src: ${newSrc}`,
        );

        finishQualitySwitch();
      },
      { once: true },
    );
  };

  episodePlayer.addEventListener("canplay", onCanPlay, { once: true });
  episodePlayer.addEventListener("error", onError, { once: true });
}

// Entry point wired to the quality radio group. Handles all rendition
// modes ("144" through "1080"). Exported so playerControls.ts can call it
// directly during the saved-settings init sequence.
export function setQualityMode(mode: QualityMode): void {
  applyQualityRendition(parseInt(mode, 10), mode);
  PlayerStorage.save({ quality: mode });
}

// Maps a quality radio button's DOM id back to its QualityMode.
function qualityModeFromButtonID(id: string): QualityMode | null {
  if (id === config.quality.buttonIDs.p144) return "144";
  if (id === config.quality.buttonIDs.p240) return "240";
  if (id === config.quality.buttonIDs.p360) return "360";
  if (id === config.quality.buttonIDs.p480) return "480";
  if (id === config.quality.buttonIDs.p720) return "720";
  if (id === config.quality.buttonIDs.p1080) return "1080";
  return null;
}

// radioButtonHandler.ts dispatches a bubbling "radChanged" CustomEvent
// (detail: { group, id }) on click — there's no registry to hook into
// like registerToggleAction, so we listen for the event directly and
// filter by our quality radio group.
document.addEventListener("radChanged", (event: Event) => {
  const detail = (event as CustomEvent<{ group: string; id: string }>).detail;
  if (!detail || detail.group !== config.quality.radGroup) return;

  const mode = qualityModeFromButtonID(detail.id);
  if (!mode) {
    console.warn(
      `[WARN: playerPlaybackSettings.ts] radChanged fired for quality group with unrecognized button id: ${detail.id}`,
    );
    return;
  }

  setQualityMode(mode);
});
