// ============================================================
// radioButtonCore.ts (logic-only, no styling decisions here)
// If you already have a core in radioButton.ts, move this there
// instead of keeping it inline — this file should own it once.
// ============================================================

const RADIO_BUTTON_CONFIG = {
  selectors: {
    allButtons: "button",
  },
  dataset: {
    radGroup: "radgroup",
    radState: "radstate",
    radActive: "radactive",
    radInitialized: "radinitialized",
    canDisabled: "candisabled",
  },
  events: {
    radChanged: "radChanged",
  },
} as const;

// group name -> currently active element
let activeElements = new Map<string, HTMLElement>();

function getActiveClasses(el: HTMLElement): string[] {
  const raw = el.dataset[RADIO_BUTTON_CONFIG.dataset.radActive];
  return raw ? raw.split(" ").filter(Boolean) : [];
}

// Toggles data-radActive classes on the element itself AND any
// descendant that declares its own data-radActive (e.g. the icon
// container), since each can have a different active style.
function setActiveState(root: HTMLElement, isActive: boolean): void {
  const targets: HTMLElement[] = [
    root,
    ...Array.from(
      root.querySelectorAll<HTMLElement>(
        `[data-${RADIO_BUTTON_CONFIG.dataset.radActive}]`,
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

function handleRadioClick(event: Event): void {
  const element = event.currentTarget as HTMLElement;
  const group = element.dataset[RADIO_BUTTON_CONFIG.dataset.radGroup];
  if (!group) {
    console.warn(
      `[radioButtonCore] Clicked element missing data-${RADIO_BUTTON_CONFIG.dataset.radGroup} attribute.`,
      element,
    );
    return;
  }

  const currentActive = activeElements.get(group);
  if (currentActive === element) return;

  if (currentActive) setActiveState(currentActive, false);
  setActiveState(element, true);
  activeElements.set(group, element);

  element.dispatchEvent(
    new CustomEvent(RADIO_BUTTON_CONFIG.events.radChanged, {
      bubbles: true,
      detail: { group, id: element.id },
    }),
  );
}

// Resolves the actual "radio element" for a given button: itself
// if it carries data-radgroup, otherwise its parent (covers custom
// structures where the group attribute lives one level up).
function resolveRadioTarget(button: HTMLElement): HTMLElement | null {
  if (button.dataset[RADIO_BUTTON_CONFIG.dataset.radGroup]) return button;
  const parent = button.parentElement;
  if (parent && parent.dataset[RADIO_BUTTON_CONFIG.dataset.radGroup])
    return parent;
  return null;
}

function isTrue(el: HTMLElement, key: string): boolean {
  return el.dataset[key] === "true";
}

// Groups every resolved radio target by its data-radgroup value.
function collectGroups(): Map<string, HTMLElement[]> {
  const groups = new Map<string, HTMLElement[]>();

  const buttons = document.querySelectorAll<HTMLElement>(
    RADIO_BUTTON_CONFIG.selectors.allButtons,
  );

  buttons.forEach((button) => {
    const target = resolveRadioTarget(button);
    if (!target) return;

    const group = target.dataset[RADIO_BUTTON_CONFIG.dataset.radGroup];
    if (!group) return;

    const existing = groups.get(group);
    if (existing) {
      // Same element can't be resolved twice into one group
      // (guards against a button + its parent both matching).
      if (!existing.includes(target)) existing.push(target);
    } else {
      groups.set(group, [target]);
    }
  });

  return groups;
}

// Validates a single group's initial data-radstate values and
// returns the element that should end up active, or null.
// - More than one "true": logs an error, treats the group as invalid.
// - data-candisabled="false" on ANY member forces the group to always
//   have an active element, so an invalid/empty result falls back
//   to the first button instead of staying empty.
function resolveInitialActive(
  group: string,
  members: HTMLElement[],
): HTMLElement | null {
  const trueStates = members.filter((el) =>
    isTrue(el, RADIO_BUTTON_CONFIG.dataset.radState),
  );
  const forced = members.some(
    (el) => el.dataset[RADIO_BUTTON_CONFIG.dataset.canDisabled] === "false",
  );

  if (trueStates.length > 1) {
    console.error(
      `[radioButtonCore] Group "${group}" has ${trueStates.length} buttons with data-radstate="true". ` +
        `Only one is allowed. IDs: ${trueStates.map((el) => el.id || "(no id)").join(", ")}`,
    );

    if (forced) {
      console.warn(
        `[radioButtonCore] Group "${group}" forces active element (canDisabled="false"). Falling back to first member: ${members[0].id || "(no id)"}`,
      );
    }
    return forced ? members[0] : null;
  }

  if (trueStates.length === 1) return trueStates[0];

  // No explicit active state.
  return forced ? members[0] : null;
}

function initRadioButtons(event: Event): void {
  // Fresh map every init — Astro View Transitions swap the DOM,
  // so stale element references must not survive navigation.
  activeElements = new Map();

  const groups = collectGroups();

  groups.forEach((members, group) => {
    const initialActive = resolveInitialActive(group, members);
    if (initialActive) {
      activeElements.set(group, initialActive);
    }

    members.forEach((target) => {
      // Guard against double-binding on repeated init calls
      // (double DOMContentLoaded under View Transitions).
      if (target.dataset[RADIO_BUTTON_CONFIG.dataset.radInitialized] === "true")
        return;
      target.dataset[RADIO_BUTTON_CONFIG.dataset.radInitialized] = "true";

      target.addEventListener("click", handleRadioClick);
    });

    if (initialActive) setActiveState(initialActive, true);
  });
}

document.addEventListener("DOMContentLoaded", initRadioButtons);
document.addEventListener("astro:after-swap", initRadioButtons);
document.addEventListener("initRadioButtons", initRadioButtons);
