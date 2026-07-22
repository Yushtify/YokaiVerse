// ─── Configuration ────────────────────────────────────────────────────────────

// Default language used as fallback when no match is found or on first visit.
const DEFAULT_LANG = "en_us" as const;

// All supported language codes. Add new entries here to extend support.
const SUPPORTED_LANGS = ["az", "de", "en_us", "en_uk", "es", "fr", "ru", "tr", "jp"] as const;

// Human-readable display names used in the "Automatic - {Name}" button label.
const LANG_NAMES: Record<Language, string> = {
  az: "Azərbaycan",
  de: "Deutsch",
  en_us: "English (US)",
  en_uk: "English (UK)",
  es: "Español",
  fr: "Français",
  ru: "Русский",
  tr: "Türkçe",
  jp: "日本語",
};

// localStorage keys used to persist language preferences across sessions.
const STORAGE_KEYS = {
  lang: "user_lang",
  auto: "user_lang_auto",
} as const;

// UPDATED: Broadened selector to target any element containing a data-lang attribute
const RADIO_SELECTOR = `[data-lang]`;

// Base path where translation JSON files are served from.
const LOCALES_PATH = "/locales";

// ─── Types ────────────────────────────────────────────────────────────────────

type Language = (typeof SUPPORTED_LANGS)[number];
type Translations = Record<string, any>;

// ─── Language Utilities ───────────────────────────────────────────────────────

/**
 * Checks whether a raw string is a recognized Language code.
 */
function isSupportedLang(raw: string): raw is Language {
  return SUPPORTED_LANGS.includes(raw as Language);
}

/**
 * Coerces an arbitrary string to a Language, falling back to DEFAULT_LANG
 * when the value is null, undefined, or unrecognized.
 */
function resolveLanguage(raw: string | null | undefined): Language {
  if (raw && isSupportedLang(raw)) return raw;
  return DEFAULT_LANG;
}

/**
 * Reads the browser's preferred locale and maps it to a supported Language.
 */
function detectBrowserLanguage(): Language {
  const raw = navigator.language.toLowerCase();
  const normalized = raw.replace("-", "_");

  const exact = SUPPORTED_LANGS.find((l) => l === normalized);
  const prefix = SUPPORTED_LANGS.find((l) => l.startsWith(raw.split("-")[0]));

  return exact ?? prefix ?? DEFAULT_LANG;
}

/**
 * Resolves a dot-separated i18n key against a translations object.
 */
function resolveKey(
  key: string,
  translations: Translations,
): string | undefined {
  const value = key.split(".").reduce((obj: any, k) => obj?.[k], translations);
  return typeof value === "string" ? value : undefined;
}

// ─── Translation Fetcher ──────────────────────────────────────────────────────

async function fetchTranslations(lang: Language): Promise<Translations> {
  const res = await fetch(`${LOCALES_PATH}/${lang}.json`);
  if (!res.ok)
    throw new Error(`Translation file not found: ${LOCALES_PATH}/${lang}.json`);
  return res.json();
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

function translateElement(el: HTMLElement, translations: Translations): void {
  if (el.getAttribute("data-translate") === "false") return;

  const key = el.getAttribute("data-i18n");
  if (!key) return;

  const text = resolveKey(key, translations);
  if (!text) return;

  if (el instanceof HTMLInputElement) {
    el.placeholder = text;
  } else {
    el.innerText = text;
  }
}

function translateSubtree(
  translations: Translations,
  root: Element | Document = document,
): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    translateElement(el, translations);
  });
}

/**
 * Updates the language indicator badge text if the element exists on the page.
 */
function updateLangBadge(lang: Language): void {
  const badge = document.getElementById("languageSwitch_Text");
  if (badge) badge.innerText = lang.toUpperCase();
}

// ─── MutationObserver ─────────────────────────────────────────────────────────

/**
 * Creates and starts a MutationObserver that watches for newly added DOM nodes.
 * Now also automatically wires up clicking mechanics if new language triggers are added.
 */
function createI18nObserver(
  getTranslations: () => Translations | null,
  bindClickToElement: (el: HTMLElement) => void,
): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    const translations = getTranslations();
    if (!translations) return;

    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (!(node instanceof Element)) continue;

        if (node.hasAttribute("data-i18n")) {
          translateElement(node as HTMLElement, translations);
        }
        translateSubtree(translations, node);

        // Dynamic addition safety: bind interaction logic if elements containing data-lang appear
        if (node.hasAttribute("data-lang")) {
          bindClickToElement(node as HTMLElement);
        }
        node.querySelectorAll<HTMLElement>("[data-lang]").forEach((el) => {
          bindClickToElement(el);
        });
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

// ─── Persistence Helpers ──────────────────────────────────────────────────────

function saveManualLang(lang: Language): void {
  localStorage.setItem(STORAGE_KEYS.lang, lang);
  localStorage.setItem(STORAGE_KEYS.auto, "false");
}

function saveAutoMode(): void {
  localStorage.setItem(STORAGE_KEYS.auto, "true");
  localStorage.removeItem(STORAGE_KEYS.lang);
}

function loadPersistedPreference(): { lang: Language; isAuto: boolean } {
  const saved = localStorage.getItem(STORAGE_KEYS.lang);
  const savedAuto = localStorage.getItem(STORAGE_KEYS.auto);

  if (savedAuto === "true" || !saved) {
    return { lang: detectBrowserLanguage(), isAuto: true };
  }

  return { lang: resolveLanguage(saved), isAuto: false };
}

// ─── Radio Button Helpers ─────────────────────────────────────────────────────

// UPDATED: Now queries elements dynamically without locking down strict button tag limits
function getAllRadioButtons(): NodeListOf<HTMLElement> {
  return document.querySelectorAll<HTMLElement>(RADIO_SELECTOR);
}

function updateAutoButtonLabel(btn: HTMLElement, lang: Language): void {
  const title = btn.querySelector<HTMLElement>("#title");
  if (title) title.innerText = `Automatic - ${LANG_NAMES[lang]}`;
}

function resetAutoButtonLabel(): void {
  const autoBtn = document.getElementById("autoLanguage");
  const title = autoBtn?.querySelector<HTMLElement>("#title");
  if (title) title.innerText = "Automatic";
}

/**
 * Visually activates the selector option matching the current state.
 */
function syncRadioButtons(currentLang: Language, isAuto: boolean): void {
  getAllRadioButtons().forEach((btn) => {
    const lang = btn.getAttribute("data-lang");

    if (isAuto && lang === "auto") {
      (window as any).switchTheFilter?.(btn);
      updateAutoButtonLabel(btn, currentLang);
    } else if (!isAuto && lang === currentLang) {
      (window as any).switchTheFilter?.(btn);
    }
  });
}

// ─── Language Manager ─────────────────────────────────────────────────────────

class LanguageManager {
  private currentLang: Language;
  private isAuto: boolean;
  private translations: Translations | null = null;
  private observer: MutationObserver | null = null;

  constructor() {
    const pref = loadPersistedPreference();
    this.currentLang = pref.lang;
    this.isAuto = pref.isAuto;
    this.boot();
  }

  // ─── Boot ──────────────────────────────────────────────────────────────────

  private async boot() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.onReady());
    } else {
      await this.onReady();
    }
  }

  private async onReady() {
    await this.applyLanguage();
    syncRadioButtons(this.currentLang, this.isAuto);
    this.attachRadioListeners();

    // Pass the click binder handler to the mutation observer ecosystem
    this.observer = createI18nObserver(
      () => this.translations,
      (el) => this.bindLanguageTrigger(el),
    );
  }

  // ─── Radio Listeners ───────────────────────────────────────────────────────

  /**
   * Scans existing DOM matching elements and registers the translation interaction.
   */
  private attachRadioListeners() {
    getAllRadioButtons().forEach((btn) => {
      this.bindLanguageTrigger(btn);
    });
  }

  /**
   * Safely adds event actions into the elements without wiping out external onclick modifications.
   */
  private bindLanguageTrigger(btn: HTMLElement) {
    // Check to ensure we don't bind duplicate listeners if mutation observer triggers twice
    if (btn.dataset.i18nBound === "true") return;
    btn.dataset.i18nBound = "true";

    btn.addEventListener("click", async () => {
      const raw = btn.getAttribute("data-lang");

      if (raw === "auto") {
        this.isAuto = true;
        saveAutoMode();
        this.currentLang = detectBrowserLanguage();
        updateAutoButtonLabel(btn, this.currentLang);
        await this.applyLanguage();
        this.dispatchChange();
        return;
      }

      const resolved = resolveLanguage(raw);
      if (!this.isAuto && resolved === this.currentLang) return;

      this.isAuto = false;
      resetAutoButtonLabel();
      await this.setLanguage(resolved);
    });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  public async setLanguage(lang: Language) {
    this.currentLang = lang;
    saveManualLang(lang);
    console.log(`Switching language to: ${lang}`);
    await this.applyLanguage();
    this.dispatchChange();
  }

  public async toggleLanguage() {
    await this.setLanguage(
      this.currentLang === DEFAULT_LANG ? "tr" : DEFAULT_LANG,
    );
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async applyLanguage() {
    try {
      this.translations = await fetchTranslations(this.currentLang);
      updateLangBadge(this.currentLang);
      translateSubtree(this.translations);
    } catch (err) {
      console.error("Failed to load translations:", err);
    }
  }

  private dispatchChange() {
    window.dispatchEvent(
      new CustomEvent("langChanged", { detail: this.currentLang }),
    );
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const langManager = new LanguageManager();
(window as any).switchLanguage = () => langManager.toggleLanguage();
