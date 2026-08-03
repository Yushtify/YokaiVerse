// ==========================================
// CONFIGURATION
// ==========================================
const DROPDOWN_CONFIG = {
  // Data attributes
  ATTR_TRIGGER: "data-dropdown",
  ATTR_MENU_ID: "data-menu-id",
  ATTR_INITIALIZED: "data-dropdown-initialized",
  ATTR_ACTIVE_CLASSES: "data-dropdown-active", // Aktif sınıfların tutulduğu öznitelik

  // ARIA attributes
  ARIA_EXPANDED: "aria-expanded",
  ARIA_HASPOPUP: "aria-haspopup",

  // Class names
  CLASS_HIDDEN: "hidden",

  // Layout settings
  GAP_OFFSET: 8,

  // Event names
  EVENT_ASTRO_LOAD: "astro:page-load",
};

/**
 * Buton ve içindeki [data-dropdown-active] elemanlarını tarayarak
 * menünün açık/kapalı durumuna göre aktif sınıfları ekler veya çıkarır.
 */
function toggleActiveClasses(button: HTMLButtonElement, isActive: boolean) {
  // Butonun kendisini ve içindeki ilgili elemanları topla
  const targets: HTMLElement[] = [];

  if (button.hasAttribute(DROPDOWN_CONFIG.ATTR_ACTIVE_CLASSES)) {
    targets.push(button);
  }

  const childrenWithActive = button.querySelectorAll<HTMLElement>(
    `[${DROPDOWN_CONFIG.ATTR_ACTIVE_CLASSES}]`,
  );
  targets.push(...Array.from(childrenWithActive));

  // Her eleman için aktif sınıfları uygula veya kaldır
  targets.forEach((el) => {
    const rawClasses = el.getAttribute(DROPDOWN_CONFIG.ATTR_ACTIVE_CLASSES);
    if (!rawClasses) return;

    // Birden fazla sınıf varsa (ör. "bg-Accent! text-white") boşluklara göre ayır
    const classList = rawClasses.trim().split(/\s+/).filter(Boolean);
    if (classList.length === 0) return;

    if (isActive) {
      el.classList.add(...classList);
    } else {
      el.classList.remove(...classList);
    }
  });
}

/**
 * Belirtilen dropdown menüyü kapatır ve durumunu sıfırlar.
 */
function closeDropdown(button: HTMLButtonElement) {
  const menuId = button.getAttribute(DROPDOWN_CONFIG.ATTR_MENU_ID);
  if (!menuId) return;

  const menu = document.getElementById(menuId);
  if (menu && !menu.classList.contains(DROPDOWN_CONFIG.CLASS_HIDDEN)) {
    menu.classList.add(DROPDOWN_CONFIG.CLASS_HIDDEN);
    button.setAttribute(DROPDOWN_CONFIG.ARIA_EXPANDED, "false");
    toggleActiveClasses(button, false);
  }
}

function setupDropdowns() {
  // Henüz dinleyici eklenmemiş butonları seç
  const selector = `button[${DROPDOWN_CONFIG.ATTR_TRIGGER}="true"]:not([${DROPDOWN_CONFIG.ATTR_INITIALIZED}="true"])`;
  const dropdownButtons =
    document.querySelectorAll<HTMLButtonElement>(selector);

  dropdownButtons.forEach((button) => {
    const menuId = button.getAttribute(DROPDOWN_CONFIG.ATTR_MENU_ID);
    if (!menuId) return;

    const menu = document.getElementById(menuId);
    if (!menu) return;

    // Çift dinleyici eklenmesini önlemek için işaretle
    button.setAttribute(DROPDOWN_CONFIG.ATTR_INITIALIZED, "true");

    // ARIA ve başlangıç durumları
    button.setAttribute(DROPDOWN_CONFIG.ARIA_EXPANDED, "false");
    button.setAttribute(DROPDOWN_CONFIG.ARIA_HASPOPUP, "true");
    menu.classList.add(DROPDOWN_CONFIG.CLASS_HIDDEN);

    // Dinamik Pozisyonlama
    const positionMenu = () => {
      menu.style.top = "";
      menu.style.bottom = "";
      menu.style.left = "";
      menu.style.right = "";

      const buttonRect = button.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const spaceAbove = buttonRect.top;
      const spaceBelow = viewportHeight - buttonRect.bottom;

      // Dikey Konumlandırma
      if (spaceAbove < menuRect.height && spaceBelow > spaceAbove) {
        menu.style.bottom = "auto";
        menu.style.top = `calc(100% + ${DROPDOWN_CONFIG.GAP_OFFSET}px)`;
      } else {
        menu.style.top = "auto";
        menu.style.bottom = `calc(100% + ${DROPDOWN_CONFIG.GAP_OFFSET}px)`;
      }

      // Yatay Konumlandırma
      if (buttonRect.left + menuRect.width > viewportWidth) {
        menu.style.left = "auto";
        menu.style.right = "0px";
      } else {
        menu.style.right = "auto";
        menu.style.left = "0px";
      }
    };

    // Tıklama Olayı Dinleyicisi
    button.addEventListener("click", (e) => {
      e.stopPropagation();

      // Açık olan DİĞER dropdown'ları kapat
      const allButtonsSelector = `button[${DROPDOWN_CONFIG.ATTR_TRIGGER}="true"]`;
      document
        .querySelectorAll<HTMLButtonElement>(allButtonsSelector)
        .forEach((otherBtn) => {
          if (otherBtn !== button) {
            closeDropdown(otherBtn);
          }
        });

      const isExpanded =
        button.getAttribute(DROPDOWN_CONFIG.ARIA_EXPANDED) === "true";

      if (isExpanded) {
        // Menüyü kapat
        menu.classList.add(DROPDOWN_CONFIG.CLASS_HIDDEN);
        button.setAttribute(DROPDOWN_CONFIG.ARIA_EXPANDED, "false");
        toggleActiveClasses(button, false);
      } else {
        // Menüyü aç
        menu.classList.remove(DROPDOWN_CONFIG.CLASS_HIDDEN);
        button.setAttribute(DROPDOWN_CONFIG.ARIA_EXPANDED, "true");
        toggleActiveClasses(button, true);
        positionMenu();
      }
    });

    // Menü içi tıklamaların menüyü kapatmasını engelle
    menu.addEventListener("click", (e) => e.stopPropagation());
  });
}

// --- Global Dinleyiciler ---
const allButtonsSelector = `button[${DROPDOWN_CONFIG.ATTR_TRIGGER}="true"]`;

// Dışarı tıklayınca açık olan menüleri kapat
document.addEventListener("click", () => {
  document
    .querySelectorAll<HTMLButtonElement>(allButtonsSelector)
    .forEach((button) => {
      closeDropdown(button);
    });
});

// Escape tuşuna basılınca kapat
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document
      .querySelectorAll<HTMLButtonElement>(allButtonsSelector)
      .forEach((button) => {
        const isExpanded =
          button.getAttribute(DROPDOWN_CONFIG.ARIA_EXPANDED) === "true";
        if (isExpanded) {
          closeDropdown(button);
          button.focus();
        }
      });
  }
});

// İlk yükleme ve Astro View Transitions tetikleyicileri
setupDropdowns();
document.addEventListener(DROPDOWN_CONFIG.EVENT_ASTRO_LOAD, setupDropdowns);
