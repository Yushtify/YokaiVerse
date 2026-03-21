/**
 * Extracts a vibrant accent color from an anime cover image.
 * Uses canvas pixel sampling + HSL scoring to find the most
 * visually striking color — not just the most frequent one.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface ScoredColor extends RGB {
  score: number;
  count: number;
}

// Convert RGB → HSL (all values 0–1)
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [h, s, l];
}

// Quantize a single channel to reduce color space
function quantize(value: number, levels = 16): number {
  return Math.round(value / (256 / levels)) * (256 / levels);
}

/**
 * Score a color on how "vibrant" and usable it is as an accent.
 * Penalizes near-whites, near-blacks, and very desaturated grays.
 */
function vibrancyScore(r: number, g: number, b: number, count: number): number {
  const [, s, l] = rgbToHsl(r, g, b);

  // Reject colors that are too dark, too light, or too gray
  if (l < 0.12 || l > 0.92 || s < 0.2) return -1;

  // Reward high saturation + mid lightness (ideal for UI accents)
  const saturationWeight = s * 3;
  const lightnessWeight = 1 - Math.abs(l - 0.5) * 2; // peaks at l=0.5
  const populationWeight = Math.log(count + 1) * 0.4;

  return saturationWeight + lightnessWeight + populationWeight;
}

/**
 * Given an HTMLImageElement (must be CORS-accessible or same-origin),
 * returns the most vibrant accent color as a hex string like "#e94560".
 *
 * Falls back to a neutral purple if extraction fails.
 */
export async function getAccentColor(
  imgSource: string,
  options?: {
    sampleSize?: number; // Canvas resize dimension (default: 64)
    fallback?: string; // Fallback hex color (default: "#7c3aed")
  },
): Promise<string> {
  const { sampleSize = 64, fallback = "#7c3aed" } = options ?? {};

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = sampleSize;
        canvas.height = sampleSize;

        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(fallback);

        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);

        // Build a color frequency map using quantized RGB keys
        const colorMap = new Map<string, ScoredColor>();

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue; // skip transparent pixels

          const r = quantize(data[i]);
          const g = quantize(data[i + 1]);
          const b = quantize(data[i + 2]);
          const key = `${r},${g},${b}`;

          const existing = colorMap.get(key);
          if (existing) {
            existing.count++;
          } else {
            colorMap.set(key, { r, g, b, count: 1, score: 0 });
          }
        }

        // Score all sampled colors
        let best: ScoredColor | null = null;

        for (const color of colorMap.values()) {
          color.score = vibrancyScore(color.r, color.g, color.b, color.count);
          if (color.score > (best?.score ?? -Infinity)) {
            best = color;
          }
        }

        if (!best || best.score < 0) return resolve(fallback);

        // Convert to hex
        const hex =
          "#" +
          [best.r, best.g, best.b]
            .map((v) => Math.min(255, v).toString(16).padStart(2, "0"))
            .join("");

        resolve(hex);
      } catch {
        resolve(fallback);
      }
    };

    img.onerror = () => resolve(fallback);
    img.src = imgSource;
  });
}

/**
 * Injects the accent color as CSS custom properties on :root.
 * Call this once per page load on /watch and /info pages.
 *
 * Sets:
 *   --accent          → the raw extracted color
 *   --accent-glow     → same color at 40% opacity (for glow effects)
 *   --accent-subtle   → same color at 12% opacity (for backgrounds)
 *   --accent-border   → same color at 30% opacity (for borders)
 */
export function applyAccentColor(hex: string): void {
  const root = document.documentElement;
  root.style.setProperty("--accent", hex);
  root.style.setProperty("--accent-glow", hex + "66"); // 40% opacity
  root.style.setProperty("--accent-subtle", hex + "1f"); // 12% opacity
  root.style.setProperty("--accent-border", hex + "4d"); // 30% opacity
}
