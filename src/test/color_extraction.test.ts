import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { colorExtractionService, ExtractedColors } from '../services/colorExtractionService';

describe('ColorExtractionService (Part 6)', () => {
  let originalDocument: any;

  beforeEach(() => {
    colorExtractionService.clearCache();
    originalDocument = (globalThis as any).document;
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  it('provides reliable fallback colors when artwork is unavailable', async () => {
    const palette = await colorExtractionService.extractColors();
    expect(palette).toBeDefined();
    expect(palette.primary).toBe('#A78BFA');
    expect(palette.secondary).toBe('#7C3AED');
    expect(palette.primaryRgb).toEqual([167, 139, 250]);
  });

  it('provides reliable fallback colors for invalid image source in headless environments', async () => {
    const palette = await colorExtractionService.extractColors('data:image/png;base64,invalid');
    expect(palette).toBeDefined();
    expect(palette.primary).toBe('#A78BFA');
    expect(palette.secondary).toBe('#7C3AED');
  });

  it('caches extracted colors and returns identical palette for repeated requests', async () => {
    const artUrl = 'data:image/svg+xml;utf8,<svg></svg>';
    const first = await colorExtractionService.extractColors(artUrl);
    const second = await colorExtractionService.extractColors(artUrl);
    expect(first).toEqual(second);
  });

  it('applies CSS variables to document root element safely', () => {
    const mockStyles: Record<string, string> = {};
    (globalThis as any).document = {
      documentElement: {
        style: {
          setProperty: (key: string, val: string) => {
            mockStyles[key] = val;
          },
          getPropertyValue: (key: string) => mockStyles[key] || '',
        },
      },
    };

    const testPalette: ExtractedColors = {
      primary: '#10B981',
      secondary: '#059669',
      muted: '#064E3B',
      primaryRgb: [16, 185, 129],
      secondaryRgb: [5, 150, 105],
      mutedRgb: [6, 78, 59],
    };

    colorExtractionService.applyThemeVariables(testPalette);
    const rootStyle = (globalThis as any).document.documentElement.style;
    expect(rootStyle.getPropertyValue('--accent-dynamic')).toBe('#10B981');
    expect(rootStyle.getPropertyValue('--accent-dynamic-secondary')).toBe('#059669');
    expect(rootStyle.getPropertyValue('--ambient-primary')).toBe('rgba(16,185,129, 0.20)');
    expect(rootStyle.getPropertyValue('--glow-dynamic')).toContain('rgba(16,185,129');
  });
});
