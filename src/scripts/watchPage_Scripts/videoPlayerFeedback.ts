// Video Player Feedback UI Controller
// Bu dosya feedback mesajlarının görüntülenmesini yönetir

interface FeedbackConfig {
  feedbackElementId: string;
  defaultDuration: number;
}

const feedbackConfig: FeedbackConfig = {
  feedbackElementId: "videoFeedbackContainer",
  defaultDuration: 750, // milliseconds
};

function getFeedbackElement(): HTMLDivElement | null {
  return document.getElementById(
    feedbackConfig.feedbackElementId,
  ) as HTMLDivElement | null;
}

function getFeedbackTextElement(): HTMLParagraphElement | null {
  const feedbackElement = getFeedbackElement();
  return feedbackElement?.querySelector("p") as HTMLParagraphElement | null;
}

function getFeedbackIconElement(): HTMLElement | null {
  const feedbackElement = getFeedbackElement();
  return feedbackElement?.querySelector("#googleSymbol") as HTMLElement | null;
}

function showTextFeedback(
  message: string,
  duration: number = feedbackConfig.defaultDuration,
): void {
  const feedbackText = getFeedbackTextElement();
  if (!feedbackText) {
    console.warn(
      `Feedback text element not found in #${feedbackConfig.feedbackElementId}`,
    );
    return;
  }
  feedbackText.innerText = message;
  displayFeedback(duration);
}

function showIconFeedback(
  iconName: string,
  duration: number = feedbackConfig.defaultDuration,
): void {
  const feedbackIcon = getFeedbackIconElement();
  if (!feedbackIcon) {
    console.warn(
      `Feedback icon element not found in #${feedbackConfig.feedbackElementId}`,
    );
    return;
  }
  feedbackIcon.innerText = iconName;
  displayFeedback(duration);
}

function displayFeedback(duration: number): void {
  const feedbackElement = getFeedbackElement();
  if (!feedbackElement) {
    console.warn(
      `Feedback element #${feedbackConfig.feedbackElementId} not found`,
    );
    return;
  }

  const existingTimeout = (feedbackElement as any).feedbackTimeout;
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  feedbackElement.classList.replace("opacity-0", "opacity-100");

  (feedbackElement as any).feedbackTimeout = setTimeout(() => {
    feedbackElement.classList.replace("opacity-100", "opacity-0");
    delete (feedbackElement as any).feedbackTimeout;
  }, duration);
}

function showTextFeedbackForElement(
  elementId: string,
  message: string,
  duration: number,
): void {
  const feedbackElement = document.getElementById(
    elementId,
  ) as HTMLElement | null;
  if (!feedbackElement) {
    console.warn(`Feedback element #${elementId} not found`);
    return;
  }
  const feedbackText = feedbackElement.querySelector(
    "p",
  ) as HTMLParagraphElement | null;
  if (!feedbackText) {
    console.warn(`Feedback text in #${elementId} not found`);
    return;
  }
  feedbackText.innerText = message;
  displayFeedbackElement(elementId, duration);
}

function showIconFeedbackForElement(
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

function displayFeedbackElement(elementId: string, duration: number): void {
  const feedbackElement = document.getElementById(
    elementId,
  ) as HTMLElement | null;
  if (!feedbackElement) {
    console.warn(`Feedback element #${elementId} not found`);
    return;
  }

  const existingTimeout = (feedbackElement as any).feedbackTimeout;
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  feedbackElement.classList.replace("opacity-0", "opacity-100");

  (feedbackElement as any).feedbackTimeout = setTimeout(() => {
    feedbackElement.classList.replace("opacity-100", "opacity-0");
    delete (feedbackElement as any).feedbackTimeout;
  }, duration);
}

// Export functions
(window as any).showTextFeedback = showTextFeedback;
(window as any).showIconFeedback = showIconFeedback;
(window as any).displayFeedback = displayFeedback;
(window as any).showTextFeedbackForElement = showTextFeedbackForElement;
(window as any).showIconFeedbackForElement = showIconFeedbackForElement;
(window as any).displayFeedbackElement = displayFeedbackElement;
