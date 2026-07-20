/**
 * playerGesturesAndMouse.ts
 *
 * Advanced interaction handler for the video player container ('epControlContainer'):
 * 1. Mouse & UI Auto-Hiding (Strict UX Rules):
 * - Automatically hides the cursor, #controlBar, and #titleBar after 2.5s.
 * - ONLY hides when the player is in FULLSCREEN mode.
 * - NEVER hides if the user is hovering over either #controlBar or #titleBar.
 * 2. Adaptive Double-Click:
 * - Mobile/Tablet (<= 1024px): Double-click left/right to seek backward/forward.
 * - Desktop (> 1024px): Double-click triggers fullscreen toggle.
 * 3. Vertical Swipes (Mobile/Tablet only): Swipe up enters fullscreen, swipe down exits fullscreen. Prevents default page scroll.
 * 4. Toggleable Gestures: Can be enabled/disabled globally via 'window.enablePlayerGestures'.
 *
 * Requirements:
 * - English comments only.
 * - Comprehensive debugging and event logging.
 */

interface CustomWindow extends Window {
  playEp?: () => void;
  epFullscreenToggle?: () => void;
  enablePlayerGestures?: boolean; // Dynamically toggleable by user settings
}

const customWindow = window as unknown as CustomWindow;

// Initialize global gesture setting if not already defined
if (customWindow.enablePlayerGestures === undefined) {
  customWindow.enablePlayerGestures = true;
}

// Target Element IDs matching playerControls.ts config
const CONTROL_CONTAINER_ID = "epControlContainer";
const VIDEO_PLAYER_ID = "episodePlayer";
const PLAYER_CONTAINER_ID = "epPlayerContainer";

// Target UI IDs for hiding/showing elements during inactivity
const CONTROL_BAR_ID = "controlBar";
const TITLE_BAR_ID = "titleBar";

// Configuration limits
const CURSOR_INACTIVITY_TIMEOUT_MS = 2500; // Time in ms before hiding UI
const DOUBLE_CLICK_DELAY_MS = 250;         // Max duration between clicks for double-click
const SWIPE_THRESHOLD_PX = 50;             // Minimum swipe distance to trigger fullscreen

// Debug helper
function logGestureDebug(action: string, detail: string = "") {
  console.log(`[DEBUG: playerGesturesAndMouse.ts] ${action} ${detail ? `-> ${detail}` : ""}`);
}

function logGestureWarning(message: string) {
  console.warn(`[WARN: playerGesturesAndMouse.ts] ${message}`);
}

document.addEventListener("DOMContentLoaded", () => {
  const controlContainer = document.getElementById(CONTROL_CONTAINER_ID) as HTMLDivElement | null;
  const episodePlayer = document.getElementById(VIDEO_PLAYER_ID) as HTMLVideoElement | null;
  const playerContainer = document.getElementById(PLAYER_CONTAINER_ID) as HTMLDivElement | null;

  const controlBar = document.getElementById(CONTROL_BAR_ID);
  const titleBar = document.getElementById(TITLE_BAR_ID);

  if (!controlContainer || !episodePlayer) {
    console.error(
      `[ERROR: playerGesturesAndMouse.ts] Initialization failed. Control Container ('${CONTROL_CONTAINER_ID}') or Video Player ('${VIDEO_PLAYER_ID}') not found.`
    );
    return;
  }

  logGestureDebug("Initialization", "Gestures and adaptive mouse handler registered successfully.");

  // Helper to detect mobile or tablet screens (<= 1024px)
  const isMobileOrTablet = (): boolean => window.innerWidth <= 1024;

  // ─── 1. Cursor & UI Hiding Logic (With Strict Hover and Fullscreen Rules) ───
  let idleTimer: number | null = null;
  let isUIVisible = true;
  let isHoveringControlBar = false;
  let isHoveringTitleBar = false;

  const getUIElements = (): HTMLElement[] => {
    const elements: HTMLElement[] = [];
    if (controlBar) elements.push(controlBar);
    if (titleBar) elements.push(titleBar);
    return elements;
  };

  const showUI = () => {
    if (!isUIVisible) {
      controlContainer.style.cursor = "default";

      getUIElements().forEach((el) => {
        el.classList.remove("opacity-0", "pointer-events-none");
        el.classList.add("opacity-100");
      });

      isUIVisible = true;
      logGestureDebug("UI State", "Visible");
    }
  };

  const hideUI = () => {
    const isCurrentlyFullscreen = !!document.fullscreenElement;

    // STRICT UX CHECKS:
    // 1. Must be in Fullscreen.
    // 2. Video must be actively playing.
    // 3. User must NOT be hovering over the Control Bar or Title Bar.
    if (
      isCurrentlyFullscreen &&
      !episodePlayer.paused &&
      !isHoveringControlBar &&
      !isHoveringTitleBar &&
      isUIVisible
    ) {
      controlContainer.style.cursor = "none";

      getUIElements().forEach((el) => {
        el.classList.remove("opacity-100");
        el.classList.add("opacity-0", "pointer-events-none");
      });

      isUIVisible = false;
      logGestureDebug("UI State", "Hidden (Fullscreen inactivity)");
    }
  };

  const resetIdleTimer = () => {
    showUI();

    if (idleTimer !== null) {
      clearTimeout(idleTimer);
    }

    // Only set timer to hide if we are actually in fullscreen mode
    if (!!document.fullscreenElement) {
      idleTimer = window.setTimeout(() => {
        hideUI();
      }, CURSOR_INACTIVITY_TIMEOUT_MS);
    }
  };

  // Track hover status on the Control Bar
  if (controlBar) {
    controlBar.addEventListener("mouseenter", () => {
      isHoveringControlBar = true;
      showUI(); // Keep visible
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
      }
      logGestureDebug("Control Bar Hover", "Hover started. UI forced visible.");
    });

    controlBar.addEventListener("mouseleave", () => {
      isHoveringControlBar = false;
      resetIdleTimer();
      logGestureDebug("Control Bar Hover", "Hover ended.");
    });
  }

  // Track hover status on the Title Bar
  if (titleBar) {
    titleBar.addEventListener("mouseenter", () => {
      isHoveringTitleBar = true;
      showUI(); // Keep visible
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
      }
      logGestureDebug("Title Bar Hover", "Hover started. UI forced visible.");
    });

    titleBar.addEventListener("mouseleave", () => {
      isHoveringTitleBar = false;
      resetIdleTimer();
      logGestureDebug("Title Bar Hover", "Hover ended.");
    });
  }

  // Global mouse movement listener inside the container
  controlContainer.addEventListener("mousemove", () => {
    // If hovering UI elements, don't restart the idle-hide timer
    if (!isHoveringControlBar && !isHoveringTitleBar) {
      resetIdleTimer();
    } else {
      showUI();
    }
  });

  controlContainer.addEventListener("mouseleave", () => {
    showUI();
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    logGestureDebug("UI State", "Forced visible (mouse left container)");
  });

  // Watch for fullscreen change events to instantly restore or reset
  document.addEventListener("fullscreenchange", () => {
    const isCurrentlyFullscreen = !!document.fullscreenElement;
    logGestureDebug("Fullscreen State Change Detected", isCurrentlyFullscreen ? "Entered Fullscreen" : "Exited Fullscreen");

    // Reset state flags and instantly show elements
    isHoveringControlBar = false;
    isHoveringTitleBar = false;
    showUI();
    resetIdleTimer();
  });

  // Run immediately on page load
  resetIdleTimer();


  // ─── 2. Click & Double-Click Mechanics ───────────────────────────────────
  let clickTimeout: number | null = null;

  controlContainer.addEventListener("click", (event: MouseEvent) => {
    if (!customWindow.enablePlayerGestures) return;

    const target = event.target as HTMLElement;

    // Ignore gestures if clicking direct interactive overlays (buttons, inputs, menus)
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("[role='button']")
    ) {
      logGestureDebug("Click Ignored", "Interactive control element clicked.");
      return;
    }

    if (clickTimeout !== null) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
      handleDoubleClick(event);
    } else {
      clickTimeout = window.setTimeout(() => {
        handleSingleClick();
        clickTimeout = null;
      }, DOUBLE_CLICK_DELAY_MS);
    }
  });

  const handleSingleClick = () => {
    if (customWindow.playEp) {
      customWindow.playEp();
      logGestureDebug("Single Click Action", "Triggered Play/Pause");
    } else {
      logGestureWarning("playEp function is not registered on window scope");
    }
  };

  const handleDoubleClick = (event: MouseEvent) => {
    // 1. Desktop Behavior: Toggle Fullscreen
    if (!isMobileOrTablet()) {
      logGestureDebug("Desktop Double Click", "Triggering Fullscreen Toggle");
      if (customWindow.epFullscreenToggle) {
        customWindow.epFullscreenToggle();
      } else {
        logGestureWarning("epFullscreenToggle function is not registered on window scope");
      }
      return;
    }

    // 2. Tablet & Mobile Behavior: Seeking (Rewind / Fast Forward)
    const rect = controlContainer.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const containerWidth = rect.width;

    if (clickX < containerWidth / 2) {
      const targetTime = Math.max(0, episodePlayer.currentTime - 5);
      episodePlayer.currentTime = targetTime;
      logGestureDebug("Tablet Double Click Left", `Seeking backward to ${Math.round(targetTime)}s`);
    } else {
      const targetTime = Math.min(episodePlayer.duration, episodePlayer.currentTime + 5);
      episodePlayer.currentTime = targetTime;
      logGestureDebug("Tablet Double Click Right", `Seeking forward to ${Math.round(targetTime)}s`);
    }
  };


  // ─── 3. Swipe Gesture Detection (Tablet & Mobile Swipe-to-Fullscreen) ─────
  let touchStartX = 0;
  let touchStartY = 0;
  let isVerticalSwipe = false;

  controlContainer.addEventListener("touchstart", (event: TouchEvent) => {
    if (!customWindow.enablePlayerGestures) return;

    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    isVerticalSwipe = false;
  }, { passive: true });

  controlContainer.addEventListener("touchmove", (event: TouchEvent) => {
    if (!customWindow.enablePlayerGestures || !isMobileOrTablet()) return;

    const currentY = event.touches[0].clientY;
    const currentX = event.touches[0].clientX;

    const deltaY = currentY - touchStartY;
    const deltaX = currentX - touchStartX;

    // Check if movement is primarily vertical
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      isVerticalSwipe = true;
      if (event.cancelable) {
        event.preventDefault(); // Lock browser scrolling so fullscreen swipe behaves smoothly
      }
    }
  }, { passive: false });

  controlContainer.addEventListener("touchend", (event: TouchEvent) => {
    if (!customWindow.enablePlayerGestures || !isMobileOrTablet() || !isVerticalSwipe) return;

    const touchEndY = event.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY;

    const isCurrentlyFullscreen = !!document.fullscreenElement;

    if (Math.abs(deltaY) > SWIPE_THRESHOLD_PX) {
      if (deltaY < 0) {
        // Swipe Up -> Enter Fullscreen
        if (!isCurrentlyFullscreen) {
          logGestureDebug("Swipe Up Detected", "Attempting Fullscreen Entry");
          if (playerContainer) {
            playerContainer.requestFullscreen().catch((err) => {
              console.error("[ERROR: playerGesturesAndMouse.ts] Fullscreen request failed:", err);
            });
          } else {
            logGestureWarning("Player container 'epPlayerContainer' element was not found");
          }
        }
      } else {
        // Swipe Down -> Exit Fullscreen
        if (isCurrentlyFullscreen) {
          logGestureDebug("Swipe Down Detected", "Attempting Fullscreen Exit");
          document.exitFullscreen().catch((err) => {
            console.error("[ERROR: playerGesturesAndMouse.ts] Fullscreen exit failed:", err);
          });
        }
      }
    }
  }, { passive: true });
});
