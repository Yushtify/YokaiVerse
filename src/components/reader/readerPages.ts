import { config, debugHandler } from "./readerConfig.ts";

/**
 * mangaReaderPages.ts
 *
 * Clones #chReaderTemplate once per page discovered under a chapter's root
 * folder, re-ids every clone by page number, points both foreground and
 * background <img> elements at that page's file.
 */

export interface RenderedPage {
  index: number;
  containerEl: HTMLElement;
  imageEl: HTMLImageElement;
  imageBgEl: HTMLImageElement; // Canvas yerine HTMLImageElement olarak güncellendi
}

// ─── Page Existence Probe ────────────────────────────────────────────────────

function probeImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

// ─── Single Page Clone ───────────────────────────────────────────────────────

function renderSinglePage(
  pageIndex: number,
  pageUrl: string,
  template: HTMLTemplateElement,
  container: HTMLElement,
): RenderedPage | null {
  const fragment = template.content.cloneNode(true) as DocumentFragment;

  const readerDiv = fragment.querySelector<HTMLElement>(`#${config.readerID}`);
  const imageEl = fragment.querySelector<HTMLImageElement>(
    `#${config.imageID}`,
  );
  const imageBgEl = fragment.querySelector<HTMLImageElement>(
    `#${config.imageBgID}`,
  );

  if (!readerDiv || !imageEl || !imageBgEl) {
    debugHandler(
      "E",
      `Page ${pageIndex} template contents missing (reader/image/imageBg)`,
      "mangaReaderPages.ts",
    );
    return null;
  }

  // Re-id every element by page number so N cloned pages never collide.
  readerDiv.id = `${config.readerID}_pg${pageIndex}`;
  imageEl.id = `${config.imageID}_pg${pageIndex}`;
  imageBgEl.id = `${config.imageBgID}_pg${pageIndex}`;

  imageEl.dataset.pageIndex = String(pageIndex);
  imageEl.alt = `Page ${pageIndex}`;

  imageBgEl.dataset.pageIndex = String(pageIndex);
  imageBgEl.alt = `Background Page ${pageIndex}`;

  imageEl.addEventListener(
    "load",
    () => {
      debugHandler("L", `Page ${pageIndex} loaded`, "mangaReaderPages.ts");
    },
    { once: true },
  );

  imageEl.addEventListener(
    "error",
    () => {
      console.error(
        `[ERROR: mangaReaderPages.ts] Failed to load page image: ${pageUrl}`,
      );
    },
    { once: true },
  );

  // Set src last so listeners are ready.
  imageEl.src = pageUrl;
  imageBgEl.src = pageUrl;

  container.appendChild(fragment);

  return { index: pageIndex, containerEl: readerDiv, imageEl, imageBgEl };
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function renderChapterPages(
  chapterRoot: string,
): Promise<RenderedPage[]> {
  const container = document.getElementById(config.containerID);
  const template = document.getElementById(
    config.templateID,
  ) as HTMLTemplateElement | null;

  if (!container || !template) {
    debugHandler(
      "E",
      `Reader container ('${config.containerID}') or template ('${config.templateID}') not found`,
      "mangaReaderPages.ts",
    );
    return [];
  }

  // Clear any previously rendered pages
  container
    .querySelectorAll(`[id^='${config.readerID}_pg']`)
    .forEach((el) => el.remove());

  const rendered: RenderedPage[] = [];
  let i = 1;

  while (i <= config.maxPages) {
    const pageUrl = `${chapterRoot}/${config.pageFilePrefix}${i}.${config.pageFileExtension}`;
    const exists = await probeImage(pageUrl);

    if (!exists) {
      debugHandler(
        "L",
        `Page ${i} not found at ${pageUrl}, stopping discovery`,
        "mangaReaderPages.ts",
      );
      break;
    }

    const page = renderSinglePage(i, pageUrl, template, container);
    if (page) rendered.push(page);

    i++;
  }

  debugHandler(
    "L",
    `Rendered ${rendered.length} page(s) from: ${chapterRoot}`,
    "mangaReaderPages.ts",
  );

  return rendered;
}
