interface Values {
  forwardAmount: number;
  backwardAmount: number;
  feedbackDuration: number;
  timePlayed: number;
  volume: number;
  loop: boolean;
  videoPlayerID: string;
  videoPlayer_ContainerID: string;
}

const values: Values = {
  forwardAmount: 15,
  backwardAmount: 5,
  feedbackDuration: 750,
  timePlayed: 0,
  volume: 1,
  loop: false,
  videoPlayerID: "episodePlayer",
  videoPlayer_ContainerID: "epPlayerContainer",
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const videoPlayer_Container = document.getElementById(
  values.videoPlayer_ContainerID,
) as HTMLDivElement;
let videoPlayer = document.getElementById(
  values.videoPlayerID,
) as HTMLVideoElement;
let TimelineSlider = document.getElementById(
  "timelineSlider",
) as HTMLInputElement;

const feedbackTimers: { [key: string]: any } = {};
const feedbackCounts: { [key: string]: number } = {
  videoForwardFeedback: 0,
  videoBackwardFeedback: 0,
};

const canvas = document.getElementById("epCinemaLights") as HTMLCanvasElement;
const ctx = canvas?.getContext("2d", { alpha: false });
let lastRecordedVolume = 0.5;

// Smart controls visibility management
let controlsVisibilityTimer: any = null;
let controlsVisible = true;
let isFullscreen = false;
const CONTROLS_HIDE_DELAY = 3000; // 3 seconds idle

// Helper functions
function getElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function getSVG(btn: HTMLElement): HTMLElement | null {
  return btn.querySelector("#googleSymbol") as HTMLSpanElement | null;
}

function toggleClass(element: HTMLElement, remove: string, add: string): void {
  element.classList.remove(remove);
  element.classList.add(add);
}

// Time calculation utility
function calculateCurrentTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// Feedback system
function SendFeedback(type: string, state: string | number, duration: number) {
  if (!type || !duration) {
    console.error("Invalid feedback parameters");
    return;
  }

  const maxDuration = videoPlayer?.duration || Infinity;
  let elementId = "";
  let isIcon = false;
  let feedbackMessage = "";

  if (type === "videoPause") {
    elementId = "videoPauseFeedback";
    feedbackMessage = state === "paused" ? "play_arrow" : "pause";
    isIcon = true;
  } else if (type === "timeLine") {
    elementId =
      state === "Forwarded" ? "videoForwardFeedback" : "videoBackwardFeedback";
    if (state === "Forwarded") {
      const nextValue =
        feedbackCounts["videoForwardFeedback"] + values.forwardAmount;
      feedbackCounts["videoForwardFeedback"] = Math.min(nextValue, maxDuration);
      feedbackMessage = "+" + feedbackCounts["videoForwardFeedback"];
    } else {
      const nextValue =
        feedbackCounts["videoBackwardFeedback"] + values.backwardAmount;
      feedbackCounts["videoBackwardFeedback"] = Math.min(
        nextValue,
        maxDuration,
      );
      feedbackMessage = "-" + feedbackCounts["videoBackwardFeedback"];
    }
  } else if (type === "videoLoop") {
    elementId = "videoFeedbackContainer"; // Ortadaki ikon container ID'n
    feedbackMessage = state === "enabled" ? "repeat" : "repeat";
    isIcon = true;
  } else if (type === "volumeChange") {
    elementId = "videoFeedbackContainer";
    feedbackMessage = `${state}`;
  }

  if (
    isIcon &&
    (elementId.includes("videoForwardFeedback") ||
      elementId.includes("videoBackwardFeedback"))
  ) {
    displayTextFeedbackElement(elementId, feedbackMessage, duration);
  } else {
    if (isIcon) {
      displayIconFeedbackElement(elementId, feedbackMessage, duration);
    } else {
      displayTextFeedbackElement(elementId, feedbackMessage, duration);
    }
  }
}

function displayTextFeedbackElement(
  elementId: string,
  message: string,
  duration: number,
): void {
  const feedbackElement = document.getElementById(elementId) as HTMLElement;
  if (!feedbackElement) {
    console.warn(`Feedback element #${elementId} not found`);
    return;
  }
  const feedbackText = feedbackElement.querySelector(
    "p",
  ) as HTMLParagraphElement;
  if (!feedbackText) {
    console.warn(`Feedback text in #${elementId} not found`);
    return;
  }
  feedbackText.innerText = message;
  displayFeedbackElement(elementId, duration);
}

function displayIconFeedbackElement(
  elementId: string,
  iconName: string,
  duration: number,
): void {
  const feedbackElement = document.getElementById(
    elementId,
  ) as HTMLElement | null;
  if (!feedbackElement) {
    console.warn(`Feedback element #${elementId} not found`);
    return;
  }
  const feedbackIcon = feedbackElement.querySelector(
    "#googleSymbol",
  ) as HTMLElement | null;
  if (!feedbackIcon) {
    console.warn(`Icon in #${elementId} not found`);
    return;
  }
  feedbackIcon.innerText = iconName;
  displayFeedbackElement(elementId, duration);
}

function showFeedback(message: string, duration: number) {
  // Legacy function for backward compatibility
  showTextFeedback(message, duration);
}

function updateCurrentTime(value: string) {
  if (!videoPlayer)
    videoPlayer = getElement<HTMLVideoElement>(
      "videoPlayer",
    ) as HTMLVideoElement;
  if (!TimelineSlider) return;
  TimelineSlider.max = videoPlayer.duration.toString();
  videoPlayer.currentTime = parseFloat(value);
}

function loopVideo() {
  if (!videoPlayer) return console.error("Video player not found");

  const btn = getElement<HTMLButtonElement>("videoLoop_Button");
  if (!btn) return;

  videoPlayer.loop = !videoPlayer.loop;
  const isEnabled = videoPlayer.loop;

  if (isEnabled) {
    btn.classList.remove("text-LT_Secondary/64", "dark:text-DT_Secondary/64");
    btn.classList.add("text-Accent");
  } else {
    btn.classList.remove("text-Accent");
    btn.classList.add("text-LT_Secondary/64", "dark:text-DT_Secondary/64");
  }

  SendFeedback(
    "videoLoop",
    isEnabled ? "enabled" : "disabled",
    values.feedbackDuration,
  );
}

function forwardVideo() {
  if (!videoPlayer) return console.error("Video player not found");
  videoPlayer.currentTime += values.forwardAmount;
  SendFeedback("timeLine", "Forwarded", values.feedbackDuration);
}

function backwardVideo() {
  if (!videoPlayer) return console.error("Video player not found");
  videoPlayer.currentTime -= values.backwardAmount;
  SendFeedback("timeLine", "Backward", values.feedbackDuration);
}

function updateSoundIcons(value: number) {
  const btn = getElement<HTMLButtonElement>("volumeButton");
  if (!btn) return console.error("Button not found");

  const svg = getSVG(btn);
  if (!svg) return;

  if (value === 0) {
    svg.innerHTML = "volume_off";
  } else if (value < 0.2) {
    svg.innerHTML = "volume_mute";
  } else if (value <= 0.5) {
    svg.innerHTML = "volume_down";
  } else {
    svg.innerHTML = "volume_up";
  }
}

// Canvas animation
function step() {
  if (ctx && videoPlayer && !videoPlayer.paused && !videoPlayer.ended) {
    ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(step);
}

async function downloadVideo(videoElementId: string): Promise<void> {
  const videoElement = document.getElementById(
    videoElementId,
  ) as HTMLVideoElement;

  if (!videoElement || videoElement.tagName !== "VIDEO") {
    throw new Error(`Video element with id "${videoElementId}" not found`);
  }

  const videoUrl =
    videoElement.src ||
    (videoElement.querySelector("source") as HTMLSourceElement)?.src;

  if (!videoUrl) {
    throw new Error("Video URL not found");
  }

  try {
    const response = await fetch(videoUrl);
    const blob = await response.blob();

    const filename = videoUrl.split("/").pop() || "video.mp4";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    URL.revokeObjectURL(link.href);
  } catch (error) {
    throw new Error(`Failed to download video: ${error}`);
  }
}

function toggleCinemaLights() {
  if (!videoPlayer || !canvas)
    return console.error("Missing required elements");

  const btn = getElement<HTMLButtonElement>("videoCinemaLight_Button");
  if (!btn) return console.error("Button not found");

  const svg = getSVG(btn);
  if (!svg) return;

  const isHidden = canvas.classList.contains("hidden");

  if (isHidden) {
    canvas.classList.remove("hidden");
    btn.classList.remove("text-LT_Secondary/64", "dark:text-DT_Secondary/64");
    btn.classList.add("text-Accent");
  } else {
    canvas.classList.add("hidden");
    btn.classList.remove("text-Accent");
    btn.classList.add("text-LT_Secondary/64", "dark:text-DT_Secondary/64");
  }
}

// Event listeners
function addListeners() {
  if (!videoPlayer || !videoPlayer_Container) {
    console.error("Video player or container not found");
    return;
  }

  // Smart controls management - YouTube style
  videoPlayer_Container.addEventListener("mouseenter", resetControlsIdleTimer);
  videoPlayer_Container.addEventListener("mousemove", resetControlsIdleTimer);
  videoPlayer_Container.addEventListener("mouseleave", () => {
    if (controlsVisibilityTimer) {
      clearTimeout(controlsVisibilityTimer);
    }
    // Hide immediately when mouse leaves (but only in fullscreen)
    if (videoPlayer && !videoPlayer.paused && isFullscreen) {
      disable_VideoControls();
      controlsVisible = false;
    }
  });

  // Timeline updates
  videoPlayer.addEventListener("timeupdate", () => {
    if (TimelineSlider) {
      TimelineSlider.value = videoPlayer.currentTime.toString();
      TimelineSlider.max = videoPlayer.duration.toString();
    }

    const currentTime = calculateCurrentTime(videoPlayer.currentTime);
    const duration = calculateCurrentTime(videoPlayer.duration || 0);

    getElement<HTMLParagraphElement>("current_TimeStamp")!.innerHTML =
      currentTime;
    getElement<HTMLParagraphElement>("duration_TimeStamp")!.innerHTML =
      ` / ${duration}`;
  });

  // Canvas animation on play
  videoPlayer.addEventListener("play", () => {
    canvas.width = 64;
    canvas.height = 36;
    step();
    // Reset idle timer when video plays
    resetControlsIdleTimer();
  });

  videoPlayer.addEventListener("pause", () => {
    // Show controls when paused and clear timer
    if (controlsVisibilityTimer) {
      clearTimeout(controlsVisibilityTimer);
    }
    enable_VideoControls();
    controlsVisible = true;
  });
}

function enable_VideoControls() {
  const controls = getElement<HTMLDivElement>("videoControls");
  const topInfo = getElement<HTMLDivElement>("video_TopInformation");

  controls?.classList.replace("opacity-0", "opacity-100");
  topInfo?.classList.replace("opacity-0", "opacity-100");
  controlsVisible = true;

  // Show cursor in fullscreen
  if (isFullscreen) {
    videoPlayer_Container.classList.replace("cursor-none", "cursor-default");
  }
}

function disable_VideoControls() {
  getElement<HTMLDivElement>("videoControls")?.classList.replace(
    "opacity-100",
    "opacity-0",
  );
  getElement<HTMLDivElement>("video_TopInformation")?.classList.replace(
    "opacity-100",
    "opacity-0",
  );
  controlsVisible = false;

  // Hide cursor in fullscreen
  if (isFullscreen) {
    videoPlayer_Container.classList.replace("cursor-default", "cursor-none");
  }
}

function resetControlsIdleTimer() {
  // Clear existing timer
  if (controlsVisibilityTimer) {
    clearTimeout(controlsVisibilityTimer);
    controlsVisibilityTimer = null;
  }

  // Show controls
  enable_VideoControls();

  // Set new timer to hide controls after idle (only in fullscreen when playing)
  if (isFullscreen && videoPlayer && !videoPlayer.paused) {
    controlsVisibilityTimer = setTimeout(() => {
      if (
        controlsVisible &&
        videoPlayer &&
        !videoPlayer.paused &&
        isFullscreen
      ) {
        disable_VideoControls();
      }
    }, CONTROLS_HIDE_DELAY);
  }
}

function smartControlsHandler(event: MouseEvent) {
  resetControlsIdleTimer();
}

// Export functions for global scope
(window as any).updateCurrentTime = updateCurrentTime;
(window as any).loopVideo = loopVideo;
(window as any).forwardVideo = forwardVideo;
(window as any).backwardVideo = backwardVideo;
(window as any).downloadVideo = downloadVideo;
(window as any).toggleCinemaLights = toggleCinemaLights;
(window as any).enable_VideoControls = enable_VideoControls;
(window as any).disable_VideoControls = disable_VideoControls;
(window as any).resetControlsIdleTimer = resetControlsIdleTimer;
(window as any).smartControlsHandler = smartControlsHandler;

// Initialize
addListeners();
