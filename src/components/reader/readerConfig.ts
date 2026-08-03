// ─── Reader Configuration ────────────────────────────────────────────
// Shared config and cross-cutting helpers used by every reader module
// (readerPages, readerControls, readerStorage). Kept
// dependency-free on purpose, same reasoning as playerConfig.ts.

export interface ButtonConfig {
  id: string;
  symbols: {
    active: string;
    deactive: string;
  };
}

export interface MangaReaderConfig {
  GoogleMaterialSymbol: string; // "#googleSymbol" — the Google Material symbol element <span></span>
  containerID: string; // "chReaderContainer" — where cloned pages get appended
  templateID: string; // "chReaderTemplate" — the <template> to clone per page
  readerID: string; // "chReader" — root element inside the template
  imageBgID: string; // "chImage_BG"
  imageID: string; // "chImage"
  // Page files live at {chapterRoot}/{pageFilePrefix}{n}.{pageFileExtension},
  // e.g. /some/chapter/root/pg_1.webp, pg_2.webp, ...
  pageFilePrefix: string;
  pageFileExtension: string;
  // Necesarry buttons
  chGrayScaleSliderID: string; // "chGrayScaleSlider"
  // Discovery stops probing once a page fails to load, capped at this limit
  // as a safety net against runaway loops if something's misconfigured.
  maxPages: number;
  buttons: {
    cinemaLightsButton: ButtonConfig;
  };
}

export const config: MangaReaderConfig = {
  GoogleMaterialSymbol: "#googleSymbol",
  containerID: "chReaderContainer",
  templateID: "chReaderTemplate",
  readerID: "chReader",
  imageBgID: "chImage_BG",
  imageID: "chImage",
  pageFilePrefix: "pg_",
  pageFileExtension: "webp",
  chGrayScaleSliderID: "chGrayScaleSlider",
  maxPages: 500,
  buttons: {
    cinemaLightsButton: {
      id: "chCinemaLightsToggleButton",
      symbols: { active: "cinematic_blur", deactive: "movie_off" },
    },
  },
};

// Same [ERROR/WARN: filename] logging convention as playerConfig.ts's
// debugHandler, so every reader module logs under its own file name.
export function debugHandler(
  Priority: "E" | "W" | "L",
  Name: string,
  fileTag: string,
): void {
  if (Priority === "E") {
    console.error(`[ERROR: ${fileTag}] ${Name} not found.`);
  } else if (Priority === "W") {
    console.warn(`[WARN: ${fileTag}] ${Name}`);
  } else {
    console.log(`[DEBUG: ${fileTag}] ${Name}`);
  }
}
