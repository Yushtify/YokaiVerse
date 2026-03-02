// To Do:
// 1. Add List that will contain more than one episode and will cycle through them auto.

interface Values {
  forwardAmount: number;
  backwardAmount: number;
  feebackDuration: number;

  timePlayed: number;
  volume: number;
  loop: boolean;

  videoPlayerID: string;
  videoPlayer_ContainerID: string;
}

let values: Values = {
  forwardAmount: 15, // seconds
  backwardAmount: 5, // seconds
  feebackDuration: 750, // milliseconds

  timePlayed: 0, // seconds
  volume: 1, // 0 - 1
  loop: false, //

  videoPlayerID: "videoPlayer",
  videoPlayer_ContainerID: "videoPlayer_Container",
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const videoPlayer_Container = document.getElementById(
  values.videoPlayer_ContainerID,
) as HTMLDivElement;
const videoPlayer = document.getElementById(
  values.videoPlayerID,
) as HTMLVideoElement;

const feedbackTimers: { [key: string]: any } = {};
// Global counts to handle cumulative increments across multiple function calls
const feedbackCounts: { [key: string]: number } = {
  videoForwardFeedback: 0,
  videoBackwardFeedback: 0,
};

function SendFeedback(type: string, state: number | string, duration: number) {
  if (!type) return console.error("The type must be valid!");
  if (!duration) return console.error("The duration must be valid");

  let FeedbackElement: HTMLDivElement | null = null;
  let elementId: string = "";

  let ForwardedSecond: number = 15;
  let BackwardedSecond: number = 5;

  // Use the global videoPlayer variable to get the hard limit
  const maxDuration = videoPlayer ? Math.floor(videoPlayer.duration) : Infinity;

  // video pause feedback
  if (type === "videoPause") {
    elementId = "videoPauseFeedback";
    FeedbackElement = document.getElementById(elementId) as HTMLDivElement;
    const FeedbackElementSVG = FeedbackElement?.querySelector("#googleSymbol");

    if (FeedbackElementSVG) {
      // changing icons accordingly to the state
      if (state === "paused") {
        FeedbackElementSVG.innerHTML = "pause";
      } else {
        FeedbackElementSVG.innerHTML = "play_arrow";
      }
    }
  } else if (type === "timeLine") {
    // turning the feedback on or off according to the state
    elementId =
      state === "Forwarded" ? "videoForwardFeedback" : "videoBackwardFeedback";
    FeedbackElement = document.getElementById(elementId) as HTMLDivElement;

    // address the stacking
    const feedbackText = FeedbackElement?.querySelector("p");

    if (feedbackText) {
      if (state === "Forwarded") {
        // Logic to stack values but keep it under global videoPlayer.duration
        const nextValue = feedbackCounts[elementId] + ForwardedSecond;
        feedbackCounts[elementId] = Math.min(nextValue, maxDuration);

        feedbackText.innerText = "+" + feedbackCounts[elementId].toString();
      } else {
        // Stack for backward and ensure it doesn't show more than video's total length
        const nextValue = feedbackCounts[elementId] + BackwardedSecond;
        feedbackCounts[elementId] = Math.min(nextValue, maxDuration);

        feedbackText.innerText = "-" + feedbackCounts[elementId].toString();
      }
    }
  }
  // Video loop feedback must be change of only text
  else if (type === "videoLoop") {
    elementId = "videoLoopFeedback";
    FeedbackElement = document.getElementById(elementId) as HTMLDivElement;

    // Find the paragraph element in the DOM content and address
    const feedbackText = FeedbackElement?.querySelector("p");

    if (feedbackText) {
      if (state === "enabled") {
        feedbackText.innerText = "enabled";
      } else {
        feedbackText.innerText = "disabled";
      }
    }
  }

  // Killswitch
  if (elementId && feedbackTimers[elementId]) {
    clearTimeout(feedbackTimers[elementId]);
  }

  if (FeedbackElement) {
    FeedbackElement.classList.replace("opacity-0", "opacity-100");

    feedbackTimers[elementId] = setTimeout(() => {
      FeedbackElement?.classList.replace("opacity-100", "opacity-0");

      // Reset cumulative counts when the UI feedback disappears
      if (feedbackCounts[elementId] !== undefined) {
        feedbackCounts[elementId] = 0;
      }

      delete feedbackTimers[elementId];
    }, duration);
  } else {
    console.warn(`Feedback element with ID "${elementId}" not found.`);
  }
}

function skipVideo() {
  if (document.fullscreenEnabled) document.exitFullscreen();
  window.history.back();
}
(window as any).skipVideo = skipVideo;

function sliderEnter(ID: string) {
  const TimeBar = document.getElementById(ID) as HTMLDivElement;
  if (!TimeBar) return;

  TimeBar.classList.replace("h-[0.2rem]", "h-[1rem]");
}
(window as any).sliderEnter = sliderEnter;
function sliderLeave(ID: string) {
  const TimeBar = document.getElementById(ID) as HTMLDivElement;
  if (!TimeBar) return;

  TimeBar.classList.replace("h-[1rem]", "h-[0.2rem]");
}
(window as any).sliderLeave = sliderLeave;

function resizeVideo() {
  const b = document.getElementById("fullscreen_Button") as HTMLButtonElement;

  let svg = b.querySelector("#googleSymbol") as HTMLElement;

  if (!document.fullscreenElement) {
    svg.classList.replace("fa-expand", "fa-compress");
    videoPlayer_Container.requestFullscreen().catch((err) => {
      console.log("Fullscreen error:", err);
      if (svg.innerHTML == "expand_content") svg.innerHTML = "collapse_content";
    });
  } else {
    document.exitFullscreen();
    svg.innerHTML = "expand_content";
  }
}
(window as any).resizeVideo = resizeVideo;

function pauseVideo() {
  const b = document.getElementById("pauseButton_TimeBar") as HTMLButtonElement;
  const svg = b.querySelector("#googleSymbol") as HTMLElement;

  if (!svg) return console.error("svg cannot be found on pauseVideo function.");
  if (!videoPlayer)
    return console.error("pauseVideo Function couldn't find div's");
  if (videoPlayer.paused) {
    videoPlayer.play();

    svg.innerHTML = "pause";
    SendFeedback("videoPause", "paused", values.feebackDuration);
  } else {
    videoPlayer.pause();
    svg.innerHTML = "play_arrow";
    SendFeedback("videoPause", "Playing", values.feebackDuration);
  }
}
(window as any).pauseVideo = pauseVideo;

function updateCurrentTime(e: HTMLInputElement) {
  if (!videoPlayer) return;
  e.max = videoPlayer.duration.toString();

  videoPlayer.addEventListener("timeupdate", function () {
    e.value = videoPlayer.currentTime.toString();
    e.max = videoPlayer.duration.toString();
  });
}
(window as any).updateCurrentTime = updateCurrentTime;

function loopVideo() {
  const b = document.getElementById("videoLoop_Button") as HTMLButtonElement;
  if (!videoPlayer)
    return console.error("loopVideo Function couldn't find div's");

  if (videoPlayer.loop == false) {
    b.classList.remove("text-Light_Text_Secondary/64");
    b.classList.remove("dark:text-Dark_Text_Secondary/64");
    b.classList.add("text-Accent");
    videoPlayer.loop = true;
    SendFeedback("videoLoop", "enabled", values.feebackDuration);
  } else {
    b.classList.remove("text-Accent");
    b.classList.add("text-Light_Text_Secondary/64");
    b.classList.add("dark:text-Dark_Text_Secondary/64");
    videoPlayer.loop = false;
    SendFeedback("videoLoop", "disabled", values.feebackDuration);
  }
}
(window as any).loopVideo = loopVideo;

function forwardVideo() {
  // forward the Video
  const ForwardAmount: number = values.forwardAmount;

  if (!videoPlayer)
    return console.error("forwardVideo Function couldn't find div's");
  videoPlayer.currentTime += ForwardAmount;
  SendFeedback("timeLine", "Forwarded", values.feebackDuration);
}
(window as any).forwardVideo = forwardVideo;

function backwardVideo() {
  // backward the videoPlayer
  const BackwardAmount: number = values.backwardAmount;

  if (!videoPlayer)
    return console.error("backwardVideo Function couldn't find div's");
  videoPlayer.currentTime -= BackwardAmount;
  SendFeedback("timeLine", "Backward", values.feebackDuration);
}
(window as any).backwardVideo = backwardVideo;

function calculateCurrentTime(seconds: number): string {
  // Calculate hours, minutes and remaining seconds
  const hours: number = Math.floor(seconds / 3600);
  const minutes: number = Math.floor((seconds % 3600) / 60);
  const remainingSeconds: number = Math.floor(seconds % 60);

  // Format values to always have at least two digits where necessary
  const formattedMinutes = minutes.toString().padStart(2, "0");
  const formattedSeconds = remainingSeconds.toString().padStart(2, "0");

  // Return H:MM:SS if duration is over an hour, otherwise return MM:SS
  if (hours > 0) {
    return `${hours}:${formattedMinutes}:${formattedSeconds}`;
  } else {
    // For minutes, we can keep it single digit if it's less than 10,
    // or use formattedMinutes for a consistent 00:00 style.
    return `${minutes}:${formattedSeconds}`;
  }
}
(window as any).calculateCurrentTime = calculateCurrentTime;

function updateSoundIcons(value: number) {
  let b = document.getElementById("volumeButton") as HTMLButtonElement;
  let svg = b.querySelector("#googleSymbol") as HTMLElement;
  if (!b || !svg)
    return console.error("updateSoundIcons Function couldn't find div's");
  if (value === 0) {
    // No Volume
    svg.innerHTML = "volume_off";
  } else if (value > 0 && value < 0.2) {
    // Half Volume
    svg.innerHTML = "volume_mute";
  } else if (value <= 0.5) {
    // Half Volume
    svg.innerHTML = "volume_down";
  } else {
    // Max Volume
    svg.innerHTML = "volume_up";
  }
}

let lastRecordedVolume: number = 0.5; // default 0.5
function muteVideo() {
  if (!videoPlayer)
    return console.error("muteVideo Function couldn't find div's");
  if (videoPlayer.volume !== 0) {
    applyVolume(0, videoPlayer, videoPlayer.volume);
  } else {
    applyVolume(lastRecordedVolume, videoPlayer, lastRecordedVolume);
  }
}
(window as any).muteVideo = muteVideo;

function updateVolumeSlider(value: number, save: number) {
  const slider = document.getElementById("volumeSlider") as HTMLInputElement;
  if (!videoPlayer || !slider) return;
  slider.value = value.toString();
  applyVolume(value, videoPlayer, save);
}
(window as any).updateVolumeSlider = updateVolumeSlider;

function applyVolume(
  value: number,
  videoPlayer: HTMLVideoElement,
  save: number,
) {
  lastRecordedVolume = save;
  videoPlayer.volume = value;
  updateSoundIcons(videoPlayer.volume);
}

function addListeners() {
  // add every listener possible
  videoPlayer.addEventListener("mouseenter", function () {
    enable_VideoControls();
  });
  videoPlayer.addEventListener("mousemove", function () {
    enable_VideoControls();
  });
  videoPlayer.addEventListener("mouseleave", function () {
    disable_VideoControls();
  });
  videoPlayer_Container.addEventListener("mouseenter", function () {
    enable_VideoControls();
  });
  videoPlayer_Container.addEventListener("mouseleave", function () {
    disable_VideoControls();
  });

  window.addEventListener("keyup", (event: KeyboardEvent): void => {
    // This section is preventing hold and repeat action
    if (videoPlayer_Container.classList.contains("hidden")) return;
    else {
      if (event.code === "Space" || event.key === "k") {
        pauseVideo();
      }
      if (event.key === "m") {
        muteVideo();
      }
      if (event.key === "f") {
        resizeVideo();
      }
    }
  });
  window.addEventListener("keydown", (event: KeyboardEvent): void => {
    // This section is encouring hold and repeat and press.
    if (videoPlayer_Container.classList.contains("hidden")) return;
    else {
      if (event.code === "ArrowRight" || event.key === "l") {
        forwardVideo();
      }
      if (event.code === "ArrowLeft" || event.key === "j") {
        backwardVideo();
      }
    }
  });

  videoPlayer.addEventListener("timeupdate", function () {
    const TimeStamp_Slider = document.getElementById(
      "timeStamp_Slider",
    ) as HTMLInputElement;
    const timeStampText = document.getElementById(
      "timeStamp",
    ) as HTMLParagraphElement;
    const timeStampText_Second = document.getElementById(
      "timeStamp_Second",
    ) as HTMLParagraphElement;
    if (
      !TimeStamp_Slider ||
      !timeStampText ||
      !timeStampText_Second ||
      !videoPlayer
    )
      return;

    function calculateCurrentTime(seconds: number) {
      const current_minutes: number = Math.floor(seconds / 60);
      const current_seconds: number = Math.floor(seconds % 60);
      return `${current_minutes}:${current_seconds.toString().padStart(2, "0")}`;
    }

    const currentTime = calculateCurrentTime(videoPlayer.currentTime);
    const duration = calculateCurrentTime(videoPlayer.duration || 0);

    const currentTimeStamp_Text = document.getElementById(
      "current_TimeStamp",
    ) as HTMLParagraphElement;
    const durationTimeStamp_Text = document.getElementById(
      "duration_TimeStamp",
    ) as HTMLParagraphElement;

    const currentTimeStamp_Text_Second = document.getElementById(
      "current_TimeStamp_Second",
    ) as HTMLParagraphElement;
    const durationTimeStamp_Text_Second = document.getElementById(
      "duration_TimeStamp_Second",
    ) as HTMLParagraphElement;

    if (currentTimeStamp_Text) {
      currentTimeStamp_Text.innerHTML = currentTime;
      currentTimeStamp_Text_Second.innerHTML = currentTime;
    }
    if (durationTimeStamp_Text) {
      durationTimeStamp_Text.innerHTML = " / " + duration;
      durationTimeStamp_Text_Second.innerHTML = " / " + duration;
    }

    if (TimeStamp_Slider && videoPlayer.duration) {
      TimeStamp_Slider.max = videoPlayer.duration.toString();
      TimeStamp_Slider.value = videoPlayer.currentTime.toString();
    }
  });

  videoPlayer.addEventListener("play", () => {
    // the canvas (Cinema Lighs) behind the video player
    canvas.width = 64;
    canvas.height = 36;
    step();
  });
}
(window as any).addListeners = addListeners;

async function enable_VideoControls() {
  // enabling the video contols via opacity as it has transition it will make a smooth animation via TailwindCSS
  const VideoControls = document.getElementById(
    "videoControls",
  ) as HTMLDivElement;
  const Video_TopInformation = document.getElementById(
    "video_TopInformation",
  ) as HTMLDivElement;
  if (!VideoControls || !Video_TopInformation) return;

  VideoControls.classList.replace("opacity-0", "opacity-100");
  Video_TopInformation.classList.replace("opacity-0", "opacity-100");
}
(window as any).enable_VideoControls = enable_VideoControls;

function disable_VideoControls() {
  // disabling the video contols via opacity as it has transition it will make a smooth animation via TailwindCSS
  const VideoControls = document.getElementById(
    "videoControls",
  ) as HTMLDivElement;
  const Video_TopInformation = document.getElementById(
    "video_TopInformation",
  ) as HTMLDivElement;
  if (!VideoControls || !Video_TopInformation) return;

  Video_TopInformation.classList.replace("opacity-100", "opacity-0");
  VideoControls.classList.replace("opacity-100", "opacity-0");
}
(window as any).disable_VideoControls = disable_VideoControls;

// The background Canvas:
const canvas = document.getElementById("glow-canvas") as HTMLCanvasElement;
let ctx: any;
if (canvas) {
  ctx = canvas.getContext("2d", { alpha: false }) as any; // For performance disable alpha
}
function step() {
  if (!videoPlayer.paused && !videoPlayer.ended) {
    // Videonun o anki karesini canvas'a çiz
    ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
  }
  // Wait until the next frame that the browser is rendering
  requestAnimationFrame(step);
}

function toggleCinemaLights() {
  const b = document.getElementById(
    "videoCinemaLight_Button",
  ) as HTMLButtonElement;
  const svg = b.querySelector("#googleSymbol") as HTMLSpanElement;

  // if video player doesn't exist then also CinemaLights
  if (!videoPlayer)
    return console.error("loopVideo Function couldn't find div's");

  // toggle it
  if (canvas.classList.contains("hidden")) {
    b.classList.remove("text-Light_Text_Secondary/64");
    b.classList.remove("dark:text-Dark_Text_Secondary/64");
    b.classList.add("text-Accent");
    canvas.classList.remove("hidden");
    fillSvg(svg, "");
  } else {
    b.classList.remove("text-Accent");
    b.classList.add("text-Light_Text_Secondary/64");
    b.classList.add("dark:text-Dark_Text_Secondary/64");
    canvas.classList.add("hidden");
    fillSvg(svg, "");
  }
}
(window as any).toggleCinemaLights = toggleCinemaLights;
