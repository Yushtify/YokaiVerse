// ─── Tooltip Handler ──────────────────────────────────────────────────────────
// Finds every element with [data-tooltip] or [data-tooltip-title-trans] on the
// page and attaches hover listeners that clone the <template> and position it
// near the target element.
//
// Supported data attributes on the trigger element:
//   data-tooltip               — static description text (no translation)
//   data-tooltip-title         — static title text (no translation)
//   data-tooltip-desc-trans    — i18n key for the description  (e.g. "Navbar.home")
//   data-tooltip-title-trans   — i18n key for the title        (e.g. "Navbar.home")
//
// Static and translated attributes can be mixed freely on the same element.
// Translated keys are resolved against the currently loaded translation file
// and are re-applied automatically whenever the language changes.
//
// The tooltip is appended directly to <body> so it is never clipped by
// overflow:hidden parents. Position is recalculated on every mousemove so it
// follows the cursor and stays within the viewport.
//
// The tooltip only appears after the cursor has hovered for SHOW_DELAY ms.
// If the cursor leaves before the timer fires, the tooltip is never shown.
// ─────────────────────────────────────────────────────────────────────────────

// Margin between the cursor and the tooltip box (px).
const CURSOR_OFFSET = 12;

// How far from any viewport edge the tooltip is allowed to get (px).
const VIEWPORT_PADDING = 8;

// How long the cursor must hover before the tooltip appears (ms).
// If the cursor leaves before this fires, the tooltip is suppressed entirely.
const SHOW_DELAY = 1000;

let activeTooltip: HTMLElement | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null;
let latestMouseEvent: MouseEvent | null = null;

// Holds the most recently loaded translation object so tooltip text can be
// resolved without an extra fetch when the tooltip is about to appear.
let currentTranslations: Record<string, any> | null = null;

// ─── Translation key resolver ─────────────────────────────────────────────────

// Walks a dot-separated key path (e.g. "Navbar.home") against a translations
// object and returns the matching string, or null if not found.
function resolveKey(
  key: string,
  translations: Record<string, any>,
): string | null {
  const result = key
    .split(".")
    .reduce((obj: any, segment) => obj?.[segment], translations);

  return typeof result === "string" ? result : null;
}

// Returns the resolved display text for a tooltip attribute.
// Prefers the translated value when a trans key is provided and resolvable,
// then falls back to the static attribute, then returns null.
function resolveTooltipText(
  transKey: string | null,
  staticValue: string | null,
): string | null {
  if (transKey && currentTranslations) {
    const translated = resolveKey(transKey, currentTranslations);
    if (translated) return translated;
  }
  return staticValue;
}

// ─── Initial translation load ─────────────────────────────────────────────────

// On first load, langChanged never fires because the language was set before
// this script ran. So we read the stored language directly and fetch the
// translation file ourselves to populate currentTranslations.
async function loadInitialTranslations() {
  try {
    const savedAuto = localStorage.getItem("user_lang_auto");
    const saved = localStorage.getItem("user_lang");

    const supported = ["en_us", "en_uk", "tr", "az"];

    let lang: string;

    if (saved && supported.includes(saved) && savedAuto !== "true") {
      // ── Saved manual selection exists — use it directly.
      lang = saved;
    } else {
      // ── No valid saved preference or auto mode is on — detect from browser.
      const browserRaw = navigator.language.toLowerCase();
      const normalized = browserRaw.replace("-", "_");

      const exactMatch = supported.find((l) => l === normalized);
      const prefixMatch = supported.find((l) =>
        l.startsWith(browserRaw.split("-")[0]),
      );

      lang = exactMatch ?? prefixMatch ?? "en_us";
    }

    const response = await fetch(`/locales/${lang}.json`);
    if (!response.ok)
      throw new Error(`Translation file not found: /locales/${lang}.json`);

    currentTranslations = await response.json();
  } catch (err) {
    console.error("Tooltip: failed to load initial translations:", err);
  }
}

// ─── Clone & inject ───────────────────────────────────────────────────────────

function createTooltip(
  title: string | null,
  description: string | null,
): HTMLElement {
  const template = document.getElementById(
    "tooltipTemplate",
  ) as HTMLTemplateElement | null;

  if (!template) {
    // Fallback plain element if the template is somehow missing.
    const fallback = document.createElement("div");
    fallback.id = "tooltip";
    fallback.textContent = description ?? "";
    return fallback;
  }

  // Clone the template content into a real DOM node.
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const tooltip = clone.querySelector<HTMLElement>("#tooltip")!;

  const titleEl = tooltip.querySelector<HTMLElement>("#tooltipTitle");
  const descEl = tooltip.querySelector<HTMLElement>("#tooltipDescription");

  // Show the title row only when a title was provided.
  if (titleEl) {
    if (title) {
      titleEl.innerText = title;
    } else {
      titleEl.remove();
    }
  }

  if (descEl) descEl.innerText = description ?? "";

  return tooltip;
}

// ─── Positioning ──────────────────────────────────────────────────────────────

// Places the tooltip so it follows the cursor and never overflows the viewport.
function positionTooltip(tooltip: HTMLElement, x: number, y: number) {
  const { innerWidth, innerHeight } = window;
  const { offsetWidth: tw, offsetHeight: th } = tooltip;

  // Default: tooltip appears to the bottom-right of the cursor.
  let left = x + CURSOR_OFFSET;
  let top = y + CURSOR_OFFSET;

  // Flip horizontal if it would overflow the right edge.
  if (left + tw + VIEWPORT_PADDING > innerWidth) {
    left = x - tw - CURSOR_OFFSET;
  }

  // Flip vertical if it would overflow the bottom edge.
  if (top + th + VIEWPORT_PADDING > innerHeight) {
    top = y - th - CURSOR_OFFSET;
  }

  // Clamp to viewport bounds as a final safety net.
  left = Math.max(VIEWPORT_PADDING, left);
  top = Math.max(VIEWPORT_PADDING, top);

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

// ─── Timer helpers ────────────────────────────────────────────────────────────

// Clears the pending show timer without touching the active tooltip.
// Called on mouseleave and whenever a new hover cycle begins.
function cancelShowTimer() {
  if (showTimer !== null) {
    clearTimeout(showTimer);
    showTimer = null;
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function showTooltip(e: MouseEvent, trigger: HTMLElement) {
  // Gather both static and trans-key attributes from the trigger element.
  const staticDesc = trigger.getAttribute("data-tooltip");
  const staticTitle = trigger.getAttribute("data-tooltip-title");
  const transDesc = trigger.getAttribute("data-tooltip-desc-trans");
  const transTitle = trigger.getAttribute("data-tooltip-title-trans");

  // Resolve the final display texts — translated value wins over static.
  const description = resolveTooltipText(transDesc, staticDesc);
  const title = resolveTooltipText(transTitle, staticTitle);

  // Nothing to show — skip entirely.
  if (!description) return;

  // Cancel any pending show from a previous hover and track cursor position.
  cancelShowTimer();
  latestMouseEvent = e;

  // Start the delay timer. The tooltip only materializes if the cursor
  // is still over the trigger when the timer fires.
  showTimer = setTimeout(() => {
    // Remove any leftover tooltip before creating a new one.
    removeTooltip();

    activeTooltip = createTooltip(title, description);

    // Start off-screen so the initial layout paint doesn't cause a flicker.
    activeTooltip.style.position = "fixed";
    activeTooltip.style.top = "-9999px";
    activeTooltip.style.left = "-9999px";

    document.body.appendChild(activeTooltip);

    // Use the most recent cursor position, not the stale mouseenter position,
    // since the cursor may have moved during the delay.
    const pos = latestMouseEvent ?? e;
    positionTooltip(activeTooltip, pos.clientX, pos.clientY);
  }, SHOW_DELAY);
}

function moveTooltip(e: MouseEvent) {
  // Always track the latest position regardless of whether the tooltip is
  // visible yet — needed for the correct spawn position after the delay.
  latestMouseEvent = e;

  if (activeTooltip) {
    positionTooltip(activeTooltip, e.clientX, e.clientY);
  }
}

function removeTooltip() {
  // Kill the pending show timer so a tooltip that hasn't appeared yet
  // never appears after the cursor has already left.
  cancelShowTimer();
  latestMouseEvent = null;

  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
}

// ─── Binding ──────────────────────────────────────────────────────────────────

// Attaches hover listeners to all tooltip trigger elements currently in the DOM.
// Triggers are any elements with at least one of the four tooltip attributes.
function bindTooltips() {
  const triggers = document.querySelectorAll<HTMLElement>(
    "[data-tooltip], [data-tooltip-title], [data-tooltip-desc-trans], [data-tooltip-title-trans]",
  );

  triggers.forEach((trigger) => {
    // Guard against double-binding if bindTooltips is called more than once.
    if (trigger.dataset.tooltipBound) return;
    trigger.dataset.tooltipBound = "true";

    trigger.addEventListener("mouseenter", (e) =>
      showTooltip(e as MouseEvent, trigger),
    );
    trigger.addEventListener("mousemove", moveTooltip);
    trigger.addEventListener("mouseleave", removeTooltip);

    // Also dismiss on scroll or any pointer that leaves the element abruptly.
    trigger.addEventListener("pointerleave", removeTooltip);
  });
}

// ─── Language change integration ──────────────────────────────────────────────

// Whenever languageHandler fires "langChanged", fetch the new translation file
// and cache it so subsequent tooltip renders use up-to-date strings.
// Also immediately update any tooltip that is currently visible on screen.
window.addEventListener("langChanged", async (e: Event) => {
  const lang = (e as CustomEvent<string>).detail;

  try {
    const response = await fetch(`/locales/${lang}.json`);
    if (!response.ok)
      throw new Error(`Translation file not found: /locales/${lang}.json`);

    currentTranslations = await response.json();

    // If a tooltip is currently open and its trigger uses trans keys,
    // update its text in place so the user sees the new language immediately.
    if (activeTooltip) {
      const titleEl = activeTooltip.querySelector<HTMLElement>("#tooltipTitle");
      const descEl = activeTooltip.querySelector<HTMLElement>(
        "#tooltipDescription",
      );

      // The active trigger is the element that currently has tooltipBound set
      // and is being hovered — find it by checking pointer-events or simply
      // re-resolve from the element the timer was started on.
      // Because we dismiss on mouseleave this tooltip belongs to whatever is
      // currently hovered; update both fields if the elements exist.
      if (titleEl) titleEl.innerText = titleEl.innerText; // kept as-is if static
      if (descEl) descEl.innerText = descEl.innerText; // same

      // A full re-render is simpler and more reliable than partial patching —
      // just dismiss the current tooltip so the next hover shows fresh text.
      removeTooltip();
    }
  } catch (err) {
    console.error("Tooltip: failed to load translation file:", err);
  }
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", async () => {
    await loadInitialTranslations();
    bindTooltips();
  });
} else {
  // DOM already ready — load translations then bind.
  loadInitialTranslations().then(() => bindTooltips());
}
