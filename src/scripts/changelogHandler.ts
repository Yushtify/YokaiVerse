// --- CHANGELOG_CONFIG ---
const CHANGELOG_CONFIG = {
  MAX_SUBPATCH: 9,
  MAX_MAJOR: 10,
  BASE_PATH: "/src/components/pageComponents/changelog/versions/",
} as const;

// --- TYPE DECLARATIONS ---
interface LoadingManagerInterface {
  show: (message?: string) => void;
  hide: () => void;
  setError: (errorMessage: string) => void;
}

declare const LoadingManager: LoadingManagerInterface;

type LogLevel = "debug" | "warn" | "error";

/**
 * Centralized logger. Always logs to console with a consistent
 * [LEVEL: scope] prefix. Warnings and errors are additionally forwarded to
 * LoadingManager so the UI surfaces them (LoadingManager has no dedicated
 * warn method, so warnings are routed through setError as well).
 */
function logDebug(scope: string, message: string, level: LogLevel = "debug") {
  const prefix =
    level === "error" ? "ERROR" : level === "warn" ? "WARN" : "DEBUG";
  const fullMessage = `[${prefix}: ${scope}] ${message}`;

  if (level === "error") {
    console.error(fullMessage);
    LoadingManager.setError(message);
  } else if (level === "warn") {
    console.warn(fullMessage);
    LoadingManager.setError(message);
  } else {
    console.log(fullMessage);
  }
}

// Static chip styling config, moved to module scope since it never changes
// between calls of loadAllVersions (avoids rebuilding the object every run).
const logTypeConfig: Record<
  string,
  { bg: string; text: string; title: string; titleData: string }
> = {
  Added: {
    bg: "bg-green-400", // Pozitif/Yeni özellik ekleme (Canlı yeşil)
    text: "text-LT_Inverted dark:text-DT_Inverted",
    title: "Added",
    titleData: "changelog.variables.added",
  },
  Changed: {
    bg: "bg-amber-500", // Değişiklik/Modifikasyon (Dikkat çeken sarı/turuncu tonu)
    text: "text-LT_Inverted dark:text-DT_Inverted",
    title: "Changed",
    titleData: "changelog.variables.changed",
  },
  Updated: {
    bg: "bg-sky-400", // İyileştirme/Güncelleme (Güven veren mavi)
    text: "text-LT_Inverted dark:text-DT_Inverted",
    title: "Updated",
    titleData: "changelog.variables.updated",
  },
  Fixed: {
    bg: "bg-sky-600", // Sorun çözme/Hata giderme (Ferahlatan teal tonu)
    text: "text-LT_Inverted dark:text-DT_Inverted",
    title: "Fixed",
    titleData: "changelog.variables.fixed",
  },
  Removed: {
    bg: "bg-rose-600", // Kaldırılan/Silinen öğe (Kırmızı/Gülkurusu)
    text: "text-LT_Inverted dark:text-DT_Inverted",
    title: "Removed",
    titleData: "changelog.variables.removed",
  },
  Experimental: {
    bg: "bg-purple-600", // Deneysel/Gelişme aşamasında (Mor/Yaratıcı ton)
    text: "text-LT_Inverted dark:text-DT_Inverted",
    title: "Experimental",
    titleData: "changelog.variables.experimental",
  },
  Misc: {
    bg: "bg-slate-500", // Çeşitli/Genel (Nötr gri)
    text: "text-LT_Inverted dark:text-DT_Inverted",
    title: "Misc",
    titleData: "changelog.variables.misc",
  },
  Known_Bug: {
    bg: "bg-rose-800", // Bilinen Hata (Koyu ve ciddi kırmızı)
    text: "text-LT_Inverted dark:text-DT_Inverted",
    title: "Known Bug",
    titleData: "changelog.variables.knownBug",
  },
  Deprecated: {
    bg: "bg-amber-600", // Artık kullanılmayan/Desteklenmeyen (Uyarı turuncusu)
    text: "text-LT_Inverted dark:text-DT_Inverted",
    title: "Deprecated",
    titleData: "changelog.variables.deprecated",
  },
  Security: {
    bg: "bg-cyan-700", // Güvenlik yamaları (Koyu cyan/sistem güvenliği hissi)
    text: "text-LT_Inverted dark:text-DT_Inverted",
    title: "Security",
    titleData: "changelog.variables.security",
  },
  Performance: {
    bg: "bg-indigo-600", // Performans/Hız optimizasyonu (İndigo tonu)
    text: "text-LT_Inverted dark:text-DT_Inverted",
    title: "Performance",
    titleData: "changelog.variables.performance",
  },
  Rewritten: {
    bg: "bg-violet-600", // Baştan yazılan kod blokları (Canlı violet)
    text: "text-LT_Inverted dark:text-DT_Inverted",
    title: "Rewritten",
    titleData: "changelog.variables.rewritten",
  },
  Breaking: {
    bg: "bg-fuchsia-700", // Kritik/Uyum bozucu değişiklik (Dikkat çekici fuşya)
    text: "text-LT_Inverted dark:text-DT_Inverted",
    title: "Breaking",
    titleData: "changelog.variables.breaking",
  },
  Reverted: {
    bg: "bg-zinc-600", // Geri alınan commit/işlemler (Geri planda kalan nötr ton)
    text: "text-LT_Inverted dark:text-DT_Inverted",
    title: "Reverted",
    titleData: "changelog.variables.reverted",
  },
};

/**
 * Helper: fetches and parses a single version JSON file by name, scoped to
 * a language folder under BASE_PATH. If the file is missing in the
 * requested language (404 etc) and that language isn't already the
 * default, falls back to DEFAULT_LANG for that same file — mirroring the
 * per-field fallback used for log.desc in renderVersionCard, but applied
 * at the whole-file level so a version isn't skipped just because one
 * translation is missing.
 */
async function tryFetchVersion(fileName: string): Promise<any | null> {
  const path = `${CHANGELOG_CONFIG.BASE_PATH}${fileName}.json`;

  logDebug("changelogHandler", path);

  const response = await fetch(path);

  if (!response.ok) return null;

  return response.json();
}

// Dynamic version crawler with LoadingManager integration
async function loadAllVersions() {
  const container = document.getElementById("versionLogContainer");
  const counterDisplay = document.getElementById("UpdateCounter");
  const latestUpdateDisplay = document.getElementById("latestUpdate_Text");
  if (!container) return;

  LoadingManager.show("Fetching Version Logs...");

  let major = 0;
  let minor = 0;
  let patch = 0;
  let subPatch = 0;
  logDebug(
    "changelogHandler",
    `Starting crawl at major=${major}, minor=${minor}, patch=${patch}, subPatch=${subPatch}`,
  );

  let active = true;
  let anyVersionFound = false;
  let versionCount = 0; // Initialize counter
  let latestVersionDate = "Unknown"; // Track latest version date

  try {
    while (active) {
      const fileName = `v${major}_${minor}_${patch}`;
      const data = await tryFetchVersion(fileName);

      if (data) {
        renderVersionCard(data, container, logTypeConfig);

        const userLang = (
          localStorage.getItem("user_lang") ?? "en_us"
        ).toLowerCase();

        // Track the latest (first found) version's date
        latestVersionDate =
          data.date?.[userLang] ?? data.date?.en_us ?? "Unknown";

        anyVersionFound = true;
        versionCount++; // Increment total found versions

        // Sub-patch (hotfix) crawl: e.g. after finding v0_5_2, look for
        // v0_5_21, v0_5_22 ... without bumping the patch number itself.
        subPatch = 1;
        let subActive = true;
        while (subActive && subPatch <= CHANGELOG_CONFIG.MAX_SUBPATCH) {
          const subFileName = `v${major}_${minor}_${patch}${subPatch}`;
          const subData = await tryFetchVersion(subFileName);

          if (subData) {
            renderVersionCard(subData, container, logTypeConfig);

            latestVersionDate =
              subData.date?.[userLang] ?? subData.date?.en_us ?? "Unknown";
            versionCount++;
            subPatch++;
          } else {
            logDebug(
              "changelogHandler",
              `No sub-patch found at v${major}_${minor}_${patch}${subPatch}, moving on.`,
            );
            subActive = false;
          }
        }

        patch++;
      } else {
        if (patch > 0) {
          minor++;
          patch = 0;
        } else if (minor > 0) {
          major++;
          minor = 0;
          patch = 0;
        } else {
          if (major === 0 && minor === 0 && patch === 0) {
            minor = 1;
          } else {
            active = false;
          }
        }
      }

      if (major > CHANGELOG_CONFIG.MAX_MAJOR) active = false;
    }

    // Post-crawl UI Updates
    if (!anyVersionFound) {
      logDebug(
        "changelogHandler",
        "No version logs were found, try again later.",
        "warn",
      );
    } else {
      // Update the counter HTML with the total count
      if (counterDisplay) {
        counterDisplay.textContent = versionCount.toString();
      }

      // Update the latest update date
      if (latestUpdateDisplay) {
        latestUpdateDisplay.textContent = latestVersionDate;
      }

      LoadingManager.hide();
    }
  } catch (error: any) {
    logDebug(
      "changelogHandler",
      error.message || "Failed to load version history, try again later.",
      "error",
    );
  }
}

/**
 * Helper: Renders version cards from template
 * Added dynamic ID assignment to the cloned card root.
 */
function renderVersionCard(data: any, container: HTMLElement, typeConfig: any) {
  const mainTemplate = document.getElementById(
    "versionTemplate",
  ) as HTMLTemplateElement;
  if (!mainTemplate) return;

  // Clone returns a DocumentFragment
  const cardClone = mainTemplate.content.cloneNode(true) as DocumentFragment;

  // Target the root element of the clone to set the dynamic ID
  const cardRoot = cardClone.firstElementChild as HTMLElement;
  if (cardRoot) {
    // Format the version string to ensure it is a valid HTML ID (e.g., "version-v1_0_0")
    const safeId = data.version.replace(/[^a-zA-Z0-9-_]/g, "_");
    cardRoot.id = `version-${safeId}`;
  }

  // Query selectors work safely on the DocumentFragment
  cardClone.querySelector("#versionTitle")!.textContent = data.version;
  const userLang = (localStorage.getItem("user_lang") ?? "en_us").toLowerCase();

  cardClone.querySelector("#versionDate")!.textContent =
    data.date?.[userLang] ?? data.date?.en_us ?? "Unknown";
  cardClone.querySelector("#versionDescription")!.textContent =
    data.description?.[userLang] ?? data.description?.en_us ?? "Unknown";
  const detailsLink = cardClone.querySelector(
    "#versionDetails_Link",
  ) as HTMLAnchorElement;

  if (data.commit && data.commit.trim() !== "") {
    // If commit exists, link to GitHub
    detailsLink.href =
      "https://github.com/Yushtify/YokaiVerse/commit/" + data.commit;
  } else {
    // If commit is missing, redirect to custom 404
    detailsLink.href = "/no-commit-found-for-this-version";
  }

  const detailTemplate = cardClone.querySelector(
    "#versionDetail_Template",
  ) as HTMLTemplateElement;
  const logList = cardClone.querySelector("#logList")!;

  if (detailTemplate && logList) {
    data.logs.forEach((log: any) => {
      const detailClone = detailTemplate.content.cloneNode(
        true,
      ) as DocumentFragment;

      const chip = detailClone.querySelector(
        "#versionDetail_TypeChip",
      ) as HTMLDivElement;
      const chipTXT = chip?.querySelector("p") as HTMLParagraphElement;
      const descElement = detailClone.querySelector(
        "#versionDetail_Desc",
      ) as HTMLParagraphElement;

      if (chip && chipTXT) {
        const config = typeConfig[log.type] || {
          bg: "bg-white",
          text: "text-LT_Inverted dark:text-DT_Inverted",
          title: log.type,
          titleData: "changelog.variables." + log.type.toLowerCase(),
        };
        chip.className += ` ${config.bg} ${config.text}`;
        chipTXT.setAttribute("data-i18n", config.titleData);
        chipTXT.textContent = config.title;
      }

      if (descElement) {
        descElement.textContent =
          log.desc?.[userLang] ?? log.desc?.en_us ?? "Unknown";
      } else {
        logDebug(
          "changelogHandler",
          "Desc Element not found for info chips",
          "warn",
        );
        return;
      }

      logList.appendChild(detailClone);
    });
  }

  container.prepend(cardClone);
}
document.addEventListener("DOMContentLoaded", loadAllVersions);
