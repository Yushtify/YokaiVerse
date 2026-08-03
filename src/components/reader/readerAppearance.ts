import { config, debugHandler } from "./readerConfig.ts"; // Config
import { MangaReaderStorage } from "./readerStorage.ts"; // Storage
import { registerToggleAction } from "../../scripts/toggleButtonHandler"; // Toggle Button Handler

let lastGrayScale = 0;
let cinemaObserver: MutationObserver | null = null;

// ─── Gray Scale Filter ────────────────────────────────────────────────────────
(window as any).grayScaleSlider = function grayScaleSlider() {
  const PgContainer = document.getElementById(config.containerID);
  const grayScaleEl = document.getElementById(
    config.chGrayScaleSliderID,
  ) as HTMLInputElement | null;

  if (!PgContainer || !grayScaleEl) {
    return debugHandler(
      "E",
      "grayScaleSlider",
      "PgContainer or grayScaleEl is undefined",
    );
  }

  const grayScale = parseFloat(grayScaleEl.value);

  if (Number.isNaN(grayScale)) {
    return debugHandler("E", "grayScaleSlider", "grayScale value is invalid");
  }

  PgContainer.style.filter = `grayscale(${grayScale}%)`;
  lastGrayScale = grayScale;

  MangaReaderStorage.save({
    grayScale,
    lastGrayScale,
  });
};

// ─── Cinema Lights Core Logic ──────────────────────────────────────────────────
// Utility to update data-toggleactive classes on the button & its children
function applyToggleActiveState(rootEl: HTMLElement, isActive: boolean) {
  const targets: HTMLElement[] = [
    rootEl,
    ...Array.from(rootEl.querySelectorAll<HTMLElement>("[data-toggleactive]")),
  ];

  targets.forEach((el) => {
    const raw = el.dataset.toggleactive;
    const classes = raw ? raw.split(" ").filter(Boolean) : [];
    if (classes.length === 0) return;

    if (isActive) {
      el.classList.add(...classes);
    } else {
      el.classList.remove(...classes);
    }
  });
}

// Registers the toggle action callback
registerToggleAction("cinemaLightCh", (el, isActive) => {
  (window as any).cinemaLightCh(isActive);
});

// Main Cinema Light function
(window as any).cinemaLightCh = function cinemaLightCh(forceState?: boolean) {
  const buttonEl = document.getElementById(
    config.buttons.cinemaLightsButton.id,
  ) as HTMLButtonElement | null;

  const svgEl = buttonEl?.querySelector(
    config.GoogleMaterialSymbol,
  ) as HTMLSpanElement | null;

  const imageBackgrounds = document.querySelectorAll(
    ".chImage_BG",
  ) as NodeListOf<HTMLDivElement>;

  // If called directly without parameters (e.g., standard onClick), trigger a native click
  // to let toggleButtonHandler dispatch events naturally.
  if (forceState === undefined) {
    if (buttonEl) buttonEl.click();
    return;
  }

  const newState = forceState;

  // 1. Sync Image Overlays Opacity
  if (imageBackgrounds.length > 0) {
    imageBackgrounds.forEach((el) => {
      if (newState) {
        el.classList.remove("opacity-0", "pointer-events-none");
        el.classList.add("opacity-100");
      } else {
        el.classList.add("opacity-0", "pointer-events-none");
        el.classList.remove("opacity-100");
      }
    });
  }

  // 2. Sync Button's internal state & attributes
  if (buttonEl) {
    buttonEl.dataset.togglestate = String(newState);
    applyToggleActiveState(buttonEl, newState);

    if (svgEl) {
      svgEl.textContent = newState
        ? config.buttons.cinemaLightsButton.symbols.active
        : config.buttons.cinemaLightsButton.symbols.deactive;
    }
  }

  // 3. Save State
  MangaReaderStorage.save({
    cinemaLights: newState,
  });
};

// ─── DOM Observer for Dynamic Images ──────────────────────────────────────────
function observeCinemaLights(savedState: boolean) {
  const container =
    document.getElementById(config.containerID) || document.body;

  if (cinemaObserver) {
    cinemaObserver.disconnect();
    cinemaObserver = null;
  }

  cinemaObserver = new MutationObserver(() => {
    const imageBackgrounds = document.querySelectorAll(".chImage_BG");

    if (imageBackgrounds.length > 0) {
      (window as any).cinemaLightCh(savedState);
    }
  });

  cinemaObserver.observe(container, {
    childList: true,
    subtree: true,
  });
}

// ─── Initialize Reader Controls ───────────────────────────────────────────────
export function initReaderControls() {
  const MangaStorage = MangaReaderStorage.load();

  // Gray Scale initialize
  const grayScaleEl = document.getElementById(
    config.chGrayScaleSliderID,
  ) as HTMLInputElement | null;

  if (grayScaleEl) {
    const grayScale = MangaStorage.grayScale ?? 0;
    lastGrayScale = grayScale;
    grayScaleEl.value = grayScale.toString();

    (window as any).grayScaleSlider();
  }

  // Cinema Lights initialize
  if (MangaStorage.cinemaLights !== undefined) {
    const savedState = MangaStorage.cinemaLights;

    // Sync whatever images already exist
    (window as any).cinemaLightCh(savedState);

    // Keep watching so images added later (lazy-load, pagination, etc.) get synced too
    observeCinemaLights(savedState);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  initReaderControls();
});
document.addEventListener("astro:page-load", function () {
  initReaderControls();
});
