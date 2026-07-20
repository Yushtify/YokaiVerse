// ============================================================
// toggleButtonHandler.ts (logic-only, no styling decisions here)
// Mirrors toggleButtonHandler.ts but for INDEPENDENT toggle buttons:
// - no groups, no mutual exclusivity — each button flips its own
//   state on click.
// - "multiple actions" is handled via a small action registry:
//   whichever module owns a behavior (player controls, language
//   switch, etc.) registers a named handler, and the button just
//   references that name via data-toggleaction. Core never knows
//   what the action actually does.
// ============================================================

const TOGGLE_BUTTON_CONFIG = {
  selectors: {
    allButtons: "button",
  },
  dataset: {
    toggleState: "togglestate",
    toggleActive: "toggleactive",
    toggleInitialized: "toggleinitialized",
    toggleAction: "toggleaction",
  },
  events: {
    toggleChanged: "toggleChanged",
  },
} as const;

// action name -> handler function, registered by whichever module
// owns that behavior. Handler receives the button and its NEW state.
type ToggleActionHandler = (element: HTMLElement, newState: boolean) => void;
const toggleActionRegistry = new Map<string, ToggleActionHandler>();

// Call this once from any module that wants to own a toggle action,
// e.g. registerToggleAction("muteToggle", (el, isActive) => { ... }).
function registerToggleAction(name: string, handler: ToggleActionHandler): void {
  if (toggleActionRegistry.has(name)) {
    console.warn(
      `[toggleButtonCore] Action "${name}" is already registered. Overwriting previous handler.`,
    );
  }
  toggleActionRegistry.set(name, handler);
}

function getActiveClasses(el: HTMLElement): string[] {
  const raw = el.dataset[TOGGLE_BUTTON_CONFIG.dataset.toggleActive];
  return raw ? raw.split(" ").filter(Boolean) : [];
}

// Toggles data-toggleactive classes on the element itself AND any
// descendant that declares its own data-toggleactive (e.g. the icon
// container), since each can have a different active style.
function setActiveState(root: HTMLElement, isActive: boolean): void {
  const targets: HTMLElement[] = [
    root,
    ...Array.from(
      root.querySelectorAll<HTMLElement>(
        `[data-${TOGGLE_BUTTON_CONFIG.dataset.toggleActive}]`,
      ),
    ),
  ];

  targets.forEach((el) => {
    const classes = getActiveClasses(el);
    if (classes.length === 0) return;
    if (isActive) el.classList.add(...classes);
    else el.classList.remove(...classes);
  });
}

function isTrue(el: HTMLElement, key: string): boolean {
  return el.dataset[key] === "true";
}

function handleToggleClick(event: Event): void {
  const element = event.currentTarget as HTMLElement;

  const currentState = isTrue(element, TOGGLE_BUTTON_CONFIG.dataset.toggleState);
  const newState = !currentState;

  element.dataset[TOGGLE_BUTTON_CONFIG.dataset.toggleState] = String(newState);
  setActiveState(element, newState);

  const actionName = element.dataset[TOGGLE_BUTTON_CONFIG.dataset.toggleAction];
  if (actionName) {
    const handler = toggleActionRegistry.get(actionName);
    if (handler) {
      handler(element, newState);
    } else {
      console.warn(
        `[toggleButtonCore] No handler registered for action "${actionName}" ` +
          `(button id: ${element.id || "(no id)"}). Falling back to visual toggle only.`,
      );
    }
  }

  element.dispatchEvent(
    new CustomEvent(TOGGLE_BUTTON_CONFIG.events.toggleChanged, {
      bubbles: true,
      detail: { id: element.id, action: actionName ?? null, state: newState },
    }),
  );
}

// A button counts as a toggle button if it declares data-togglestate
// at all (even "false"), so presence of the attribute is the marker —
// not its value.
function collectToggleButtons(): HTMLElement[] {
  const buttons = document.querySelectorAll<HTMLElement>(
    TOGGLE_BUTTON_CONFIG.selectors.allButtons,
  );

  return Array.from(buttons).filter(
    (button) =>
      button.dataset[TOGGLE_BUTTON_CONFIG.dataset.toggleState] !== undefined,
  );
}

function initToggleButtons(event: Event): void {
  const buttons = collectToggleButtons();

  buttons.forEach((button) => {
    // Apply visual state on every init (fresh DOM after Astro
    // View Transitions may need re-applied classes even if the
    // dataset value itself survived).
    const initialState = isTrue(button, TOGGLE_BUTTON_CONFIG.dataset.toggleState);
    setActiveState(button, initialState);

    // Guard against double-binding on repeated init calls
    // (double DOMContentLoaded under View Transitions).
    if (button.dataset[TOGGLE_BUTTON_CONFIG.dataset.toggleInitialized] === "true")
      return;
    button.dataset[TOGGLE_BUTTON_CONFIG.dataset.toggleInitialized] = "true";

    button.addEventListener("click", handleToggleClick);
  });
}

document.addEventListener("DOMContentLoaded", initToggleButtons);
document.addEventListener("astro:after-swap", initToggleButtons);
document.addEventListener("initToggleButtons", initToggleButtons);

export { registerToggleAction };
