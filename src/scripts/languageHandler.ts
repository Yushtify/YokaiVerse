type Language = "en" | "tr";

class LanguageManager {
  private currentLang: Language = "en";

  constructor() {
    this.init();
  }

  private async init() {
    // 1. Kayıtlı dili veya tarayıcı dilini al
    const saved = localStorage.getItem("user_lang") as Language;
    this.currentLang =
      saved || (navigator.language.startsWith("tr") ? "tr" : "en");

    // 2. DOM hazır olduğunda veya hemen uygula
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.applyLanguage());
    } else {
      await this.applyLanguage();
    }
  }

  public async toggleLanguage() {
    this.currentLang = this.currentLang === "en" ? "tr" : "en";
    localStorage.setItem("user_lang", this.currentLang);

    console.log(`Switching language to: ${this.currentLang}`); // Debug için
    await this.applyLanguage();

    window.dispatchEvent(
      new CustomEvent("langChanged", { detail: this.currentLang }),
    );
  }

  private async applyLanguage() {
    try {
      const response = await fetch(`/locales/${this.currentLang}.json`);
      if (!response.ok)
        throw new Error(`Dosya bulunamadı: /locales/${this.currentLang}.json`);

      const translations = await response.json();

      const langText = document.getElementById("languageSwitch_Text");
      if (langText) langText.innerText = this.currentLang.toUpperCase();

      const elements = document.querySelectorAll("[data-i18n]");
      elements.forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (key) {
          // Nested keyleri çöz (örn: "Landing.login_placeholder")
          const text = key
            .split(".")
            .reduce((obj, i) => obj?.[i], translations);

          if (text) {
            // EĞER element bir INPUT ise placeholder'ı değiştir
            if (el instanceof HTMLInputElement) {
              el.placeholder = text;
            } else {
              // DEĞİLSE normal metni değiştir
              (el as HTMLElement).innerText = text;
            }
          }
        }
      });
    } catch (err) {
      console.error("Çeviri yüklenirken hata oluştu:", err);
    }
  }
}

// Global instance oluştur
const langManager = new LanguageManager();

// Astro scriptleri global scope'ta olmadığı için window'a açıkça bağlıyoruz
(window as any).switchLanguage = () => langManager.toggleLanguage();
