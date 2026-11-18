export interface ExtractedColors {
  primary: string;       // e.g. '#A78BFA'
  secondary: string;     // e.g. '#7C3AED'
  muted: string;         // e.g. '#251D3A'
  primaryRgb: [number, number, number];
  secondaryRgb: [number, number, number];
  mutedRgb: [number, number, number];
}

const DEFAULT_COLORS: ExtractedColors = {
  primary: '#A78BFA',
  secondary: '#7C3AED',
  muted: '#1F1A3A',
  primaryRgb: [167, 139, 250],
  secondaryRgb: [124, 58, 237],
  mutedRgb: [31, 26, 58],
};

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Convert RGB to HSL for saturation/luminance analysis
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

class ColorExtractionService {
  private cache: Map<string, ExtractedColors> = new Map();
  private currentColors: ExtractedColors = { ...DEFAULT_COLORS };
  private listeners: Set<(colors: ExtractedColors) => void> = new Set();
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initCanvas();
    }
  }

  private initCanvas() {
    if (this.canvas) return;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 64;
    this.canvas.height = 64;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  public subscribe(cb: (colors: ExtractedColors) => void): () => void {
    this.listeners.add(cb);
    cb(this.currentColors);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public getCurrentColors(): ExtractedColors {
    return this.currentColors;
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public applyThemeVariables(colors: ExtractedColors): void {
    this.applyColors(colors);
  }

  public async extractColors(artworkUrl?: string | null): Promise<ExtractedColors> {
    return this.extractFromArtwork(artworkUrl);
  }

  public async extractFromArtwork(artworkUrl?: string | null): Promise<ExtractedColors> {
    if (!artworkUrl || !artworkUrl.trim()) {
      this.applyColors(DEFAULT_COLORS);
      return DEFAULT_COLORS;
    }

    // Check cache
    const cached = this.cache.get(artworkUrl);
    if (cached) {
      this.applyColors(cached);
      return cached;
    }

    try {
      const colors = await this.processImage(artworkUrl);
      this.cache.set(artworkUrl, colors);
      this.applyColors(colors);
      return colors;
    } catch (err) {
      console.warn('Artwork color extraction failed, using fallback:', err);
      this.applyColors(DEFAULT_COLORS);
      return DEFAULT_COLORS;
    }
  }

  private processImage(src: string): Promise<ExtractedColors> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || typeof Image === 'undefined') {
        resolve(DEFAULT_COLORS);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          this.initCanvas();
          if (!this.ctx || !this.canvas) {
            resolve(DEFAULT_COLORS);
            return;
          }

          this.ctx.clearRect(0, 0, 64, 64);
          this.ctx.drawImage(img, 0, 0, 64, 64);
          const imageData = this.ctx.getImageData(0, 0, 64, 64).data;

          const buckets: Map<string, { r: number; g: number; b: number; count: number; sat: number; lum: number }> =
            new Map();

          // Quantize and group into buckets
          for (let i = 0; i < imageData.length; i += 16) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            const a = imageData[i + 3];

            if (a < 128) continue; // ignore transparent
            const [h, s, l] = rgbToHsl(r, g, b);

            // Ignore extreme darks and extreme whites for dominant color pick
            if (l < 0.1 || l > 0.92) continue;

            // Quantize to 32-step buckets
            const qr = Math.floor(r / 24) * 24;
            const qg = Math.floor(g / 24) * 24;
            const qb = Math.floor(b / 24) * 24;
            const key = `${qr}_${qg}_${qb}`;

            const entry = buckets.get(key);
            if (entry) {
              entry.count++;
              entry.r = (entry.r + r) / 2;
              entry.g = (entry.g + g) / 2;
              entry.b = (entry.b + b) / 2;
            } else {
              buckets.set(key, { r, g, b, count: 1, sat: s, lum: l });
            }
          }

          if (buckets.size === 0) {
            resolve(DEFAULT_COLORS);
            return;
          }

          const sorted = Array.from(buckets.values()).sort((a, b) => {
            // Score by combination of frequency and vibrant saturation
            const scoreA = a.count * (1 + a.sat * 2);
            const scoreB = b.count * (1 + b.sat * 2);
            return scoreB - scoreA;
          });

          // Pick primary: most vibrant/prominent
          const primaryBucket = sorted[0];
          const primaryRgb: [number, number, number] = [
            Math.round(primaryBucket.r),
            Math.round(primaryBucket.g),
            Math.round(primaryBucket.b),
          ];

          // Pick secondary: different hue / tone from primary
          let secondaryBucket = sorted.find((b) => {
            const dist = Math.hypot(b.r - primaryBucket.r, b.g - primaryBucket.g, b.b - primaryBucket.b);
            return dist > 60;
          });
          if (!secondaryBucket && sorted.length > 1) {
            secondaryBucket = sorted[1];
          }

          const secondaryRgb: [number, number, number] = secondaryBucket
            ? [Math.round(secondaryBucket.r), Math.round(secondaryBucket.g), Math.round(secondaryBucket.b)]
            : [
                Math.round(primaryRgb[0] * 0.75),
                Math.round(primaryRgb[1] * 0.75),
                Math.min(255, Math.round(primaryRgb[2] * 1.2)),
              ];

          // Muted: deeper, darker tone for subtle ambient glow
          const mutedRgb: [number, number, number] = [
            Math.max(15, Math.round(primaryRgb[0] * 0.25)),
            Math.max(15, Math.round(primaryRgb[1] * 0.22)),
            Math.max(25, Math.round(primaryRgb[2] * 0.35)),
          ];

          const result: ExtractedColors = {
            primary: rgbToHex(primaryRgb[0], primaryRgb[1], primaryRgb[2]),
            secondary: rgbToHex(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]),
            muted: rgbToHex(mutedRgb[0], mutedRgb[1], mutedRgb[2]),
            primaryRgb,
            secondaryRgb,
            mutedRgb,
          };

          resolve(result);
        } catch {
          resolve(DEFAULT_COLORS);
        }
      };

      img.onerror = () => {
        resolve(DEFAULT_COLORS);
      };

      img.src = src;
    });
  }

  private applyColors(colors: ExtractedColors): void {
    this.currentColors = colors;
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--accent-dynamic', colors.primary);
      root.style.setProperty('--accent-dynamic-secondary', colors.secondary);
      root.style.setProperty('--ambient-primary', `rgba(${colors.primaryRgb.join(',')}, 0.20)`);
      root.style.setProperty('--ambient-secondary', `rgba(${colors.secondaryRgb.join(',')}, 0.15)`);
      root.style.setProperty('--ambient-muted', `rgba(${colors.mutedRgb.join(',')}, 0.28)`);
      root.style.setProperty('--glow-dynamic', `0 0 24px rgba(${colors.primaryRgb.join(',')}, 0.35)`);
    }
    this.listeners.forEach((cb) => cb(colors));
  }
}

export const colorExtractionService = new ColorExtractionService();
