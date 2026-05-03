type Language = "en_us" | "en_uk" | "tr" | "az";

// All supported language codes. Add new languages here to extend support.
const SUPPORTED_LANGS: Language[] = ["en_us", "en_uk", "tr", "az"];

// Human-readable display names for each supported language.
// Used in the "Automatic - {Lang Name}" label on the auto-detect button.
const LANG_NAMES: Record<Language, string> = {
  en_us: "English (US)",
  en_uk: "English (UK)",
  tr: "Türkçe",
  az: "Azərbaycan",
};

// Validates an arbitrary string against the supported language list.
// Falls back to "en_us" if the value is null, undefined, or unrecognized.
function resolveLanguage(raw: string | null | undefined): Language {
  if (raw && SUPPORTED_LANGS.includes(raw as Language)) {
    return raw as Language;
  }
  // Unknown or missing value — default to American English.
  return "en_us";
}

// Reads the browser's preferred language and maps it to a supported Language.
// Matching priority:
//   1. Exact match after normalizing separators (e.g. "en-US" → "en_us")
//   2. Prefix match on the base language tag (e.g. "az-AZ" → "az")
//   3. Fallback to "en_us" if nothing matches.
function detectBrowserLanguage(): Language {
  const browserRaw = navigator.language.toLowerCase();

  // Normalize BCP-47 hyphen to underscore so "en-US" becomes "en_us".
  const normalized = browserRaw.replace("-", "_");

  // Step 1 — try an exact match against a supported code.
  const exactMatch = SUPPORTED_LANGS.find((l) => l === normalized);

  // Step 2 — fall back to the base language tag (the part before the hyphen).
  const prefixMatch = SUPPORTED_LANGS.find((l) =>
    l.startsWith(browserRaw.split("-")[0]),
  );

  return exactMatch ?? prefixMatch ?? "en_us";
}

class LanguageManager {
  // The language currently applied to the page.
  private currentLang: Language = "en_us";

  // When true the active language is derived from the browser rather than
  // a manual selection. This state is persisted in localStorage so it
  // survives page reloads.
  private isAuto: boolean = false;

  constructor() {
    this.init();
  }

  // ─── Initialization ───────────────────────────────────────────────────────

  private async init() {
    const saved = localStorage.getItem("user_lang");
    const savedAuto = localStorage.getItem("user_lang_auto");

    // Auto mode is active when:
    //   • The user explicitly chose "Automatic" before (savedAuto === "true"), OR
    //   • There is no saved preference at all (first visit).
    if (savedAuto === "true" || !saved) {
      this.isAuto = true;
      this.currentLang = detectBrowserLanguage();
    } else {
      // A manual language was previously selected — restore it.
      this.isAuto = false;
      this.currentLang = resolveLanguage(saved);
    }

    // Apply translations as soon as the DOM is available.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.applyLanguage();
        this.syncRadioButtons();
        this.attachRadioListeners();
      });
    } else {
      // DOM is already ready — apply immediately.
      await this.applyLanguage();
      this.syncRadioButtons();
      this.attachRadioListeners();
    }
  }

  // ─── Radio Button Sync ────────────────────────────────────────────────────

  // Visually activates the radio button that matches the current language state.
  // Delegates the actual style toggling to the existing switchTheFilter helper
  // so radio button appearance logic stays in one place.
  private syncRadioButtons() {
    const allButtons = document.querySelectorAll<HTMLButtonElement>(
      `button[data-group="languageSwitch"]`,
    );

    allButtons.forEach((btn) => {
      const lang = btn.getAttribute("data-lang");

      if (this.isAuto && lang === "auto") {
        // Auto mode is active — highlight the Automatic button and update its label.
        (window as any).switchTheFilter?.(btn);
        this.updateAutoButtonLabel(btn);
      } else if (!this.isAuto && lang === this.currentLang) {
        // Manual mode — highlight whichever button matches the saved language.
        (window as any).switchTheFilter?.(btn);
      }
    });
  }

  // Updates the Automatic button's inner text to show the detected language,
  // e.g. "Automatic - Türkçe". Called whenever auto mode is active.
  private updateAutoButtonLabel(btn: HTMLButtonElement) {
    const titleEl = btn.querySelector<HTMLElement>("#title");
    if (titleEl) {
      titleEl.innerText = `Automatic - ${LANG_NAMES[this.currentLang]}`;
    }
  }

  // Resets the Automatic button label back to plain "Automatic".
  // Called when the user switches away from auto mode to a manual language.
  private resetAutoButtonLabel() {
    const autoBtn = document.getElementById(
      "autoLanguage",
    ) as HTMLButtonElement | null;
    const titleEl = autoBtn?.querySelector<HTMLElement>("#title");
    if (titleEl) titleEl.innerText = "Automatic";
  }

  // ─── Event Listeners ──────────────────────────────────────────────────────

  // Attaches a click listener to every radio button in the language switcher group.
  // Handles two cases:
  //   • "auto"  — enable browser-based detection.
  //   • any other data-lang value — apply that specific language manually.
  private attachRadioListeners() {
    const allButtons = document.querySelectorAll<HTMLButtonElement>(
      `button[data-group="languageSwitch"]`,
    );

    allButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const raw = btn.getAttribute("data-lang");

        // ── Auto mode selected ───────────────────────────────────────────
        if (raw === "auto") {
          this.isAuto = true;

          // Persist auto preference and clear any previous manual selection.
          localStorage.setItem("user_lang_auto", "true");
          localStorage.removeItem("user_lang");

          // Re-detect the browser language in case it changed since init.
          this.currentLang = detectBrowserLanguage();

          this.updateAutoButtonLabel(btn);
          await this.applyLanguage();

          // Notify the rest of the app about the language change.
          window.dispatchEvent(
            new CustomEvent("langChanged", { detail: this.currentLang }),
          );
          return;
        }

        // ── Manual language selected ─────────────────────────────────────
        const resolved = resolveLanguage(raw);

        // Skip if the user clicked the language that is already active.
        if (!this.isAuto && resolved === this.currentLang) return;

        // Leaving auto mode — reset auto flag and restore the button label.
        this.isAuto = false;
        localStorage.setItem("user_lang_auto", "false");
        this.resetAutoButtonLabel();

        await this.setLanguage(resolved);
      });
    });
  }

  // ─── Language Application ─────────────────────────────────────────────────

  // Persists and applies a manually chosen language.
  public async setLanguage(lang: Language) {
    this.currentLang = lang;
    localStorage.setItem("user_lang", lang);

    console.log(`Switching language to: ${lang}`);
    await this.applyLanguage();

    // Broadcast the change so other components can react (e.g. dynamic islands).
    window.dispatchEvent(new CustomEvent("langChanged", { detail: lang }));
  }

  // Legacy helper — toggles between en_us and tr.
  // Kept for backward compatibility with any external callers.
  public async toggleLanguage() {
    await this.setLanguage(this.currentLang === "en_us" ? "tr" : "en_us");
  }

  // Fetches the translation file for the current language and applies every
  // [data-i18n] binding on the page.
  //
  // Key format: "Section.subsection.key" — resolved by splitting on "."
  // and walking the translations object.
  //
  // Special handling:
  //   • <input> elements → updates placeholder instead of innerText.
  //   • All other elements → updates innerText.
  private async applyLanguage() {
    try {
      const response = await fetch(`/locales/${this.currentLang}.json`);

      if (!response.ok) {
        throw new Error(
          `Translation file not found: /locales/${this.currentLang}.json`,
        );
      }

      const translations = await response.json();

      // Update the language indicator badge if one exists on the page.
      const langText = document.getElementById("languageSwitch_Text");
      if (langText) langText.innerText = this.currentLang.toUpperCase();

      // Walk every element that declares a translation key and swap its text.
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (!key) return;

        // Resolve nested keys like "Landing.search_placeholder" by reducing
        // the dot-separated path against the translations object.
        const text = key
          .split(".")
          .reduce((obj: any, i) => obj?.[i], translations);

        if (!text) return;

        if (el instanceof HTMLInputElement) {
          // Inputs use placeholder instead of visible text content.
          el.placeholder = text;
        } else {
          (el as HTMLElement).innerText = text;
        }
      });
    } catch (err) {
      console.error("Failed to load translations:", err);
    }
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

// Create the singleton instance — kicks off init() automatically.
const langManager = new LanguageManager();

// Expose a global helper for any inline onclick attributes that need to
// trigger a language toggle without direct access to the class instance.
(window as any).switchLanguage = () => langManager.toggleLanguage();
