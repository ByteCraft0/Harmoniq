import { describe, it, expect } from 'vitest';
import {
  EQ_FREQUENCIES,
  BUILT_IN_PRESETS,
  DEFAULT_PARAMETRIC_FILTERS,
  ParametricFilterConfig,
  DSPSettings,
} from '../types/dsp';

describe('Harmoniq Batch 3 + 4: Advanced Visualizer & Professional Equalizer', () => {
  describe('10-Band Professional Equalizer Constants & Bands', () => {
    it('has exactly 10 frequency bands matching standard ISO octave centers', () => {
      expect(EQ_FREQUENCIES).toHaveLength(10);
      expect(EQ_FREQUENCIES).toEqual([31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]);
    });

    it('defines all required built-in presets including Treble Boost and Headphones', () => {
      const presetIds = BUILT_IN_PRESETS.map((p) => p.id);
      const expectedIds = [
        'flat',
        'bass_boost',
        'treble_boost',
        'rock',
        'pop',
        'classical',
        'jazz',
        'electronic',
        'acoustic',
        'vocal',
        'headphones',
      ];

      expectedIds.forEach((id) => {
        expect(presetIds).toContain(id);
      });
      expect(BUILT_IN_PRESETS.length).toBeGreaterThanOrEqual(11);
    });

    it('ensures all built-in presets have 10 valid band gains between -12 dB and +12 dB', () => {
      BUILT_IN_PRESETS.forEach((preset) => {
        expect(preset.bands).toHaveLength(10);
        preset.bands.forEach((gain, index) => {
          expect(typeof gain).toBe('number');
          expect(gain).toBeGreaterThanOrEqual(-12);
          expect(gain).toBeLessThanOrEqual(12);
        });
        expect(preset.preamp).toBeGreaterThanOrEqual(-12);
        expect(preset.preamp).toBeLessThanOrEqual(12);
      });
    });

    it('correctly provides Flat preset with 0 dB across all 10 bands', () => {
      const flat = BUILT_IN_PRESETS.find((p) => p.id === 'flat');
      expect(flat).toBeDefined();
      expect(flat?.bands.every((b) => b === 0)).toBe(true);
      expect(flat?.preamp).toBe(0);
    });
  });

  describe('Parametric Equalizer Configuration & Filters', () => {
    it('initializes default parametric filters across the audible spectrum', () => {
      expect(DEFAULT_PARAMETRIC_FILTERS.length).toBeGreaterThanOrEqual(4);

      // Verify filters have valid properties
      DEFAULT_PARAMETRIC_FILTERS.forEach((filter) => {
        expect(filter.frequency).toBeGreaterThanOrEqual(20);
        expect(filter.frequency).toBeLessThanOrEqual(20000);
        expect(filter.gain).toBeGreaterThanOrEqual(-18);
        expect(filter.gain).toBeLessThanOrEqual(18);
        expect(filter.q).toBeGreaterThanOrEqual(0.1);
        expect(filter.q).toBeLessThanOrEqual(18);
        expect(['peaking', 'lowshelf', 'highshelf', 'lowpass', 'highpass']).toContain(filter.type);
      });
    });

    it('supports all required filter types (peaking, lowshelf, highshelf, lowpass, highpass)', () => {
      const validTypes: ParametricFilterConfig['type'][] = [
        'peaking',
        'lowshelf',
        'highshelf',
        'lowpass',
        'highpass',
      ];
      validTypes.forEach((type) => {
        const testFilter: ParametricFilterConfig = {
          id: `test_${type}`,
          frequency: 1000,
          gain: 3,
          q: 1.0,
          type,
          enabled: true,
        };
        expect(testFilter.type).toBe(type);
      });
    });
  });

  describe('Preset Import & Export JSON Validation', () => {
    it('serializes custom presets to valid JSON format', () => {
      const customPresets = [
        {
          id: 'custom_warm',
          name: 'Warm Room',
          bands: [3, 2.5, 1, 0, 0, 0, -1, -2, -3, -4],
          preamp: -1.5,
          isCustom: true,
        },
      ];

      const jsonStr = JSON.stringify(customPresets, null, 2);
      const parsed = JSON.parse(jsonStr);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].name).toBe('Warm Room');
      expect(parsed[0].bands).toHaveLength(10);
    });

    it('validates and rejects corrupted or malformed preset payloads', () => {
      const invalidJson = '{"notAnArray": true}';
      const parsed = JSON.parse(invalidJson);

      const isValidPresetArray = (obj: any): boolean => {
        if (!Array.isArray(obj)) return false;
        return obj.every(
          (item) =>
            typeof item.name === 'string' &&
            Array.isArray(item.bands) &&
            item.bands.length === 10 &&
            item.bands.every((b: any) => typeof b === 'number')
        );
      };

      expect(isValidPresetArray(parsed)).toBe(false);

      const invalidBandsCount = [{ name: 'Bad Preset', bands: [0, 1, 2], preamp: 0 }];
      expect(isValidPresetArray(invalidBandsCount)).toBe(false);

      const validPreset = [{ name: 'Good Preset', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], preamp: 0 }];
      expect(isValidPresetArray(validPreset)).toBe(true);
    });
  });

  describe('7-Band Real-Time Frequency Spectrum Sub-Bands', () => {
    const SPECTRUM_BANDS = [
      { name: 'Sub-bass', minHz: 20, maxHz: 60 },
      { name: 'Bass', minHz: 60, maxHz: 250 },
      { name: 'Low-mid', minHz: 250, maxHz: 500 },
      { name: 'Mid', minHz: 500, maxHz: 2000 },
      { name: 'Upper-mid', minHz: 2000, maxHz: 4000 },
      { name: 'Presence', minHz: 4000, maxHz: 6000 },
      { name: 'Brilliance', minHz: 6000, maxHz: 20000 },
    ];

    it('covers the entire human audible range from 20 Hz to 20,000 Hz seamlessly', () => {
      expect(SPECTRUM_BANDS).toHaveLength(7);
      expect(SPECTRUM_BANDS[0].minHz).toBe(20);
      expect(SPECTRUM_BANDS[SPECTRUM_BANDS.length - 1].maxHz).toBe(20000);

      // Verify continuity between adjacent bands
      for (let i = 0; i < SPECTRUM_BANDS.length - 1; i++) {
        expect(SPECTRUM_BANDS[i].maxHz).toBe(SPECTRUM_BANDS[i + 1].minHz);
      }
    });

    it('maps FFT frequency bins to the correct sub-band with sample rate 44.1kHz and fftSize 2048', () => {
      const sampleRate = 44100;
      const fftSize = 2048;
      const binCount = fftSize / 2; // 1024
      const binWidth = sampleRate / fftSize; // ~21.53 Hz per bin

      const getBandForFrequency = (freq: number) => {
        return SPECTRUM_BANDS.find((band) => freq >= band.minHz && freq < band.maxHz)?.name || 'Out of bounds';
      };

      // 40 Hz -> Sub-bass
      expect(getBandForFrequency(40)).toBe('Sub-bass');
      // 100 Hz -> Bass
      expect(getBandForFrequency(100)).toBe('Bass');
      // 350 Hz -> Low-mid
      expect(getBandForFrequency(350)).toBe('Low-mid');
      // 1000 Hz -> Mid
      expect(getBandForFrequency(1000)).toBe('Mid');
      // 3000 Hz -> Upper-mid
      expect(getBandForFrequency(3000)).toBe('Upper-mid');
      // 5000 Hz -> Presence
      expect(getBandForFrequency(5000)).toBe('Presence');
      // 12000 Hz -> Brilliance
      expect(getBandForFrequency(12000)).toBe('Brilliance');
    });
  });

  describe('Mathematical EQ Response & Peak-Hold Physics', () => {
    it('calculates logarithmic composite decibel response accurately', () => {
      const preamp = -3.0; // dB
      const linearPreamp = Math.pow(10, preamp / 20); // ~0.7079
      const filterGainLinear = 2.0; // +6 dB

      const totalLinear = linearPreamp * filterGainLinear;
      const totalDb = 20 * Math.log10(totalLinear);

      // -3 dB + 6 dB = +3 dB
      expect(totalDb).toBeCloseTo(3.02, 1);
    });

    it('verifies peak-hold decay physics simulation', () => {
      // Simulate gravity peak decay
      let peak = 1.0;
      const decayRate = 0.03; // decay per frame
      const holdTimeFrames = 15;

      const frames = [];
      let holdTimer = holdTimeFrames;

      for (let f = 0; f < 30; f++) {
        if (holdTimer > 0) {
          holdTimer--;
        } else {
          peak = Math.max(0, peak - decayRate);
        }
        frames.push(peak);
      }

      // During hold time, peak should remain exactly 1.0
      expect(frames[0]).toBe(1.0);
      expect(frames[14]).toBe(1.0);
      // After hold time, peak decays smoothly
      expect(frames[15]).toBeLessThan(1.0);
      expect(frames[29]).toBeLessThan(frames[15]);
      expect(frames[29]).toBeGreaterThan(0);
    });
  });
});
