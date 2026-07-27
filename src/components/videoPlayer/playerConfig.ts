// ─── Player Configuration ──────────────────────────────────────────────────
// Shared config, DOM refs, and cross-cutting state used by every player
// module (playerStorage, playerBehaviour, playerAppearance,
// playerPlaybackSettings, playerSubtitles, playerControls). Kept dependency
// free on purpose so none of the other modules end up in an import cycle.

export interface ButtonConfig {
  id: string;
  symbols: {
    active: string;
    deactive: string;
  };
}

export interface PlayerConfig {
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
  quality: {
    radGroup: string;
    currentQualityTextID: string;
    buttonIDs: {
      p144: string;
      p240: string;
      p360: string;
      p480: string;
      p720: string;
      p1080: string;
    };
    // data-video-base attribute on the <video> element should hold the
    // folder path containing {height}p.webm renditions, e.g.
    // <video id="episodePlayer" data-video-base="/videos/some-slug">
    videoBaseAttr: string;
    // Safety margin applied to measured downlink before matching a
    // rendition (guards against overshooting a shaky connection).
    bandwidthSafetyFactor: number;
  };
}

export const config: PlayerConfig = {
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
  quality: {
    radGroup: "quality",
    currentQualityTextID: "epCurrentQuality",
    buttonIDs: {
      p144: "quality144p",
      p240: "quality240p",
      p360: "quality360p",
      p480: "quality480p",
      p720: "quality720p",
      p1080: "quality1080p",
    },
    videoBaseAttr: "data-video-base",
    bandwidthSafetyFactor: 0.8,
  },
};

export const episodePlayer = document.getElementById(
  config.episodePlayerID,
) as HTMLVideoElement;

export const epPlayerContainer = document.getElementById(
  config.epPlayercontainerID,
) as HTMLDivElement;

export interface ConfigVariablesValidator {
  LastVolume: number;
  FullScreenValue: boolean;
}

// Quick Variables
export let configVariables: ConfigVariablesValidator = {
  LastVolume: 0,
  FullScreenValue: false,
};

// NOTE: fileTag was added so every module using this shared handler logs
// under its OWN filename (per the [ERROR: filename] logging convention)
// instead of everything being hardcoded to "playerControls.ts" like before
// the split. Each caller passes its own file name explicitly.
export function debugHandler(
  Priority: "E" | "W" | "L",
  Name: string,
  fileTag: string,
) {
  if (Priority === "E") {
    console.error(
      `[ERROR: ${fileTag}] The ${Name} button and it's symbol not found.`,
    );
  }
}
