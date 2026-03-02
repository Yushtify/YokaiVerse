// 1. Types & State
// Tüm olasılıkları tek tipte topladık
type SloganClass =
  | "default"
  | "common"
  | "rare"
  | "mythic"
  | "mysterious"
  | "gambleCore";

const TIMER_MS = 20000;
const TEXT_SPEED = 7.5;
const STORAGE_KEY = "sloganCounterConfig";

// JSON'daki "slogan" objesinin haritası
let sloganTexts: Record<SloganClass, string[]> | null = null;
let rotationInterval: number | undefined;

const state = {
  saveEnabled: true,
  counters: {
    default: 0,
    common: 0,
    rare: 0,
    mythic: 0,
    mysterious: 0,
    gambleCore: 0,
  } as Record<SloganClass, number>,
  sloganClass: "default" as SloganClass,
  sloganText: "",
  sloganForced: 0,
  sloganForceMAX: 5,
};

// 2. Core Functions
async function textAnim(element: HTMLElement, newText: string, speed = 10) {
  if (!element || element.innerHTML === newText) return;
  const current = element.innerHTML;

  for (let i = current.length; i >= 0; i--) {
    element.innerHTML = current.slice(0, i);
    await new Promise((res) => setTimeout(res, speed));
  }
  for (let i = 1; newText.length >= i; i++) {
    element.innerHTML = newText.slice(0, i);
    await new Promise((res) => setTimeout(res, speed));
  }
}

async function loadSlogans() {
  const lang =
    localStorage.getItem("user_lang") ||
    (navigator.language.startsWith("tr") ? "tr" : "en");
  try {
    const response = await fetch(`/locales/${lang}.json`);
    const data = await response.json();
    // JSON'daki "slogan" anahtarına erişiyoruz (slogan.default, slogan.rare vb.)
    sloganTexts = data.slogan;
  } catch (e) {
    console.error("Failed to load slogans:", e);
  }
}

function spawnSlogan(forcedCategory?: SloganClass) {
  if (!sloganTexts) return;

  const rng = Math.floor(Math.random() * 1000001);
  const category: SloganClass =
    forcedCategory ||
    (rng === 0
      ? "mysterious"
      : rng <= 5
        ? "mythic"
        : rng === 777
          ? "gambleCore"
          : rng <= 12500
            ? "rare"
            : rng <= 75000
              ? "common"
              : "default");

  state.sloganClass = category;
  state.counters[category]++;

  // Havuzdan (slogan.rarity) metni çek
  const pool = sloganTexts[category];
  if (!pool) return;

  const newText = pool[Math.floor(Math.random() * pool.length)];

  if (newText === state.sloganText && pool.length > 1)
    return spawnSlogan(forcedCategory);

  state.sloganText = newText;
  if (state.saveEnabled)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const heroEl = document.getElementById("heroSlogan");
  if (heroEl) textAnim(heroEl, newText, TEXT_SPEED);
}

// 3. Global API
function forceSpawn(cat: SloganClass) {
  if (state.sloganForced >= state.sloganForceMAX)
    return console.warn("Limit reached!");
  state.sloganForced++;
  spawnSlogan(cat);
}

function forceAddLimits(val: number) {
  console.log("%cLimit updated!", "color: hotpink; font-weight: bold;");
  state.sloganForceMAX = val;
}

(window as any).textAnim = textAnim;
(window as any).forceSpawn = forceSpawn;
(window as any).forceAddLimits = forceAddLimits;

// 4. Initialization
const initSlogan = async () => {
  if (rotationInterval) clearInterval(rotationInterval);

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      Object.assign(state, JSON.parse(saved));
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  await loadSlogans();
  spawnSlogan();
  rotationInterval = window.setInterval(spawnSlogan, TIMER_MS);
};

window.addEventListener("langChanged", async () => {
  await loadSlogans();
  spawnSlogan();
});

document.addEventListener("astro:page-load", initSlogan);
if (document.readyState !== "loading") initSlogan();
else document.addEventListener("DOMContentLoaded", initSlogan);
