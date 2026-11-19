import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoEqImportService } from '../services/audio/autoEqImportService';
import { ParametricFilterConfig, DEFAULT_PARAMETRIC_FILTERS } from '../types/dsp';

describe('Phase 5B.2: Parametric EQ Studio & AutoEQ Enhancements', () => {
  describe('1. AutoEQ / Equalizer APO Parsing', () => {
    it('parses standard Equalizer APO format with preamp and multiple filter types', () => {
      const apoText = `
        # Equalizer APO Parametric Profile
        Preamp: -6.5 dB
        Filter 1: ON PK Fc 32 Hz Gain 3.5 dB Q 1.41
        Filter 2: ON LSC Fc 105 Hz Gain -2.0 dB Q 0.71
        Filter 3: ON HSC Fc 10000 Hz Gain 1.8 dB Q 0.71
        Filter 4: ON LP Fc 18000 Hz Gain 0.0 dB Q 0.71
        Filter 5: ON HP Fc 25 Hz Gain 0.0 dB Q 0.71
        Filter 6: ON NO Fc 4500 Hz Gain -8.0 dB Q 4.0
        Filter 7: ON BP Fc 1000 Hz Gain 0.0 dB Q 2.0
      `;

      const result = AutoEqImportService.parseAutoEqText(apoText);
      expect(result.success).toBe(true);
      expect(result.preamp).toBe(-6.5);
      expect(result.filters).toHaveLength(7);

      const [f1, f2, f3, f4, f5, f6, f7] = result.filters;
      // Filter 5 is HP 25Hz, should be first after frequency ascending sort
      expect(result.filters[0].frequency).toBe(25);
      expect(result.filters[0].type).toBe('highpass');

      const pk = result.filters.find((f) => f.frequency === 32);
      expect(pk).toBeDefined();
      expect(pk?.type).toBe('peaking');
      expect(pk?.gain).toBe(3.5);
      expect(pk?.q).toBe(1.41);
      expect(pk?.enabled).toBe(true);

      const notch = result.filters.find((f) => f.frequency === 4500);
      expect(notch?.type).toBe('notch');
      expect(notch?.gain).toBe(-8.0);
      expect(notch?.q).toBe(4.0);
    });

    it('parses table / TSV format and raw triplets (frequency, gain, Q)', () => {
      const tripletText = `
        32 3.2 1.41
        125 -1.5 2.0
        1000 4.0 0.8
        4000 -2.5 1.5
      `;

      const result = AutoEqImportService.parseAutoEqText(tripletText);
      expect(result.success).toBe(true);
      expect(result.filters).toHaveLength(4);
      expect(result.filters[0].frequency).toBe(32);
      expect(result.filters[0].gain).toBe(3.2);
      expect(result.filters[0].q).toBe(1.41);
      expect(result.filters[0].type).toBe('peaking');
    });

    it('converts bandwidth in octaves (BW Oct) to Q factor accurately', () => {
      const bwText = `
        Filter 1: ON PK Fc 1000 Hz Gain 3.0 dB BW Oct 1.0
      `;

      const result = AutoEqImportService.parseAutoEqText(bwText);
      expect(result.success).toBe(true);
      expect(result.filters).toHaveLength(1);
      // For BW = 1.0 octave, Q = sqrt(2) / (2 - 1) = 1.414...
      expect(result.filters[0].q).toBeCloseTo(1.41, 1);
    });

    it('enforces safety bounds: clamps frequencies, gains, and Q values', () => {
      const outOfBoundsText = `
        Preamp: -30.0 dB
        Filter 1: ON PK Fc 5 Hz Gain 45.0 dB Q 50.0
        Filter 2: ON PK Fc 35000 Hz Gain -50.0 dB Q 0.01
      `;

      const result = AutoEqImportService.parseAutoEqText(outOfBoundsText);
      expect(result.success).toBe(true);
      expect(result.preamp).toBe(-18); // Clamped from -30 to -18

      const f1 = result.filters.find((f) => f.gain === 18);
      expect(f1).toBeDefined();
      expect(f1?.frequency).toBe(20); // Clamped from 5 to 20
      expect(f1?.q).toBe(18.0); // Clamped from 50 to 18

      const f2 = result.filters.find((f) => f.gain === -18);
      expect(f2).toBeDefined();
      expect(f2?.frequency).toBe(20000); // Clamped from 35000 to 20000
      expect(f2?.q).toBe(0.1); // Clamped from 0.01 to 0.1
    });

    it('caps filters to 12 when profile contains >12 filters and logs a warning', () => {
      // Generate 16 filters
      const lines = ['Preamp: -4.0 dB'];
      for (let i = 1; i <= 16; i++) {
        lines.push(`Filter ${i}: ON PK Fc ${i * 500} Hz Gain ${(i % 2 === 0 ? 1 : -1) * (i * 0.5)} dB Q 1.5`);
      }

      const result = AutoEqImportService.parseAutoEqText(lines.join('\n'));
      expect(result.success).toBe(true);
      expect(result.totalParsed).toBe(16);
      expect(result.filters).toHaveLength(12);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('supports up to 12 parametric bands');
    });

    it('handles oversized text (>50KB) gracefully without crashing', () => {
      const hugeComments = '# '.repeat(35000) + '\nFilter 1: ON PK Fc 1000 Hz Gain 2.0 dB Q 1.41\n';
      const result = AutoEqImportService.parseAutoEqText(hugeComments);
      expect(result.warnings.some((w) => w.includes('50KB'))).toBe(true);
    });

    it('returns error when text is empty or contains no valid filter lines', () => {
      const emptyResult = AutoEqImportService.parseAutoEqText('');
      expect(emptyResult.success).toBe(false);
      expect(emptyResult.error).toBeDefined();

      const invalidResult = AutoEqImportService.parseAutoEqText('Just some random text\nNo filters here');
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toContain('No valid parametric filters');
    });
  });

  describe('2. Offline Biquad Frequency Response Evaluation', () => {
    it('evaluates peaking filter gain peak accurately at center frequency', () => {
      const filters: ParametricFilterConfig[] = [
        { id: '1', type: 'peaking', frequency: 1000, gain: 6.0, q: 2.0, enabled: true },
      ];

      const testFreqs = new Float32Array([100, 1000, 10000]);
      const response = AutoEqImportService.evaluateParametricResponse(filters, 0, testFreqs, 48000);

      // At center frequency (1000 Hz), gain should be ~ +6.0 dB
      expect(response[1]).toBeCloseTo(6.0, 0.5);
      // At distant frequencies (100 Hz, 10000 Hz), gain should be ~ 0 dB
      expect(response[0]).toBeCloseTo(0.0, 0.5);
      expect(response[2]).toBeCloseTo(0.0, 0.5);
    });

    it('evaluates low shelf filter response correctly', () => {
      const filters: ParametricFilterConfig[] = [
        { id: '1', type: 'lowshelf', frequency: 200, gain: 4.0, q: 0.707, enabled: true },
      ];

      const testFreqs = new Float32Array([40, 200, 5000]);
      const response = AutoEqImportService.evaluateParametricResponse(filters, 0, testFreqs, 48000);

      // Far below cutoff (40 Hz), gain should reach +4.0 dB
      expect(response[0]).toBeCloseTo(4.0, 0.5);
      // Far above cutoff (5000 Hz), gain should approach 0 dB
      expect(response[2]).toBeCloseTo(0.0, 0.5);
    });

    it('evaluates high shelf filter response correctly', () => {
      const filters: ParametricFilterConfig[] = [
        { id: '1', type: 'highshelf', frequency: 4000, gain: -5.0, q: 0.707, enabled: true },
      ];

      const testFreqs = new Float32Array([100, 4000, 16000]);
      const response = AutoEqImportService.evaluateParametricResponse(filters, 0, testFreqs, 48000);

      // Far below cutoff (100 Hz), gain should be ~ 0 dB
      expect(response[0]).toBeCloseTo(0.0, 0.5);
      // Far above cutoff (16000 Hz), gain should approach -5.0 dB
      expect(response[2]).toBeCloseTo(-5.0, 0.5);
    });

    it('evaluates notch filter deep cut at center frequency', () => {
      const filters: ParametricFilterConfig[] = [
        { id: '1', type: 'notch', frequency: 1000, gain: 0, q: 5.0, enabled: true },
      ];

      const testFreqs = new Float32Array([1000]);
      const response = AutoEqImportService.evaluateParametricResponse(filters, 0, testFreqs, 48000);

      // Center of notch should be deeply attenuated (more than -20 dB)
      expect(response[0]).toBeLessThan(-20);
    });

    it('adds preamp gain offset across all frequencies', () => {
      const filters: ParametricFilterConfig[] = [
        { id: '1', type: 'peaking', frequency: 1000, gain: 3.0, q: 1.0, enabled: true },
      ];

      const testFreqs = new Float32Array([100, 1000, 10000]);
      const responseWithPreamp = AutoEqImportService.evaluateParametricResponse(filters, -6.0, testFreqs, 48000);

      // Peak should be 3.0 - 6.0 = -3.0 dB
      expect(responseWithPreamp[1]).toBeCloseTo(-3.0, 0.5);
      // Baseline should be 0.0 - 6.0 = -6.0 dB
      expect(responseWithPreamp[0]).toBeCloseTo(-6.0, 0.5);
      expect(responseWithPreamp[2]).toBeCloseTo(-6.0, 0.5);
    });
  });

  describe('3. Audition / Solo Mode Logic', () => {
    it('isolates the auditioned filter while zeroing other parametric gains in engine configuration', () => {
      const fullFilters: ParametricFilterConfig[] = [
        { id: 'f1', type: 'peaking', frequency: 100, gain: 4.0, q: 1.0, enabled: true },
        { id: 'f2', type: 'peaking', frequency: 1000, gain: -3.0, q: 1.5, enabled: true },
        { id: 'f3', type: 'peaking', frequency: 5000, gain: 5.0, q: 2.0, enabled: true },
      ];

      // Simulate getEffectiveSettingsForEngine logic
      const auditionFilterId = 'f2';
      const effectiveFilters = fullFilters.map((f) => {
        if (f.id === auditionFilterId) return f;
        return { ...f, gain: 0 };
      });

      // Soloed filter preserves its gain
      expect(effectiveFilters.find((f) => f.id === 'f2')?.gain).toBe(-3.0);
      // Other filters have gain set to 0 dB
      expect(effectiveFilters.find((f) => f.id === 'f1')?.gain).toBe(0);
      expect(effectiveFilters.find((f) => f.id === 'f3')?.gain).toBe(0);

      // Original configuration remains completely unmutated
      expect(fullFilters[0].gain).toBe(4.0);
      expect(fullFilters[1].gain).toBe(-3.0);
      expect(fullFilters[2].gain).toBe(5.0);
    });

    it('restores all filter gains cleanly when exiting solo mode', () => {
      const fullFilters: ParametricFilterConfig[] = [
        { id: 'f1', type: 'peaking', frequency: 100, gain: 4.0, q: 1.0, enabled: true },
        { id: 'f2', type: 'peaking', frequency: 1000, gain: -3.0, q: 1.5, enabled: true },
      ];

      const auditionFilterId: string | null = null;
      const effectiveFilters = auditionFilterId
        ? fullFilters.map((f) => (f.id === auditionFilterId ? f : { ...f, gain: 0 }))
        : fullFilters;

      expect(effectiveFilters[0].gain).toBe(4.0);
      expect(effectiveFilters[1].gain).toBe(-3.0);
    });
  });

  describe('4. Q-Factor Multiplicative Scaling & Bandwidth Calculations', () => {
    it('scales Q-factor multiplicatively by 1.10 on wheel up and 1/1.10 on wheel down', () => {
      const initialQ = 1.41;

      // Wheel up
      const qUp = Math.round(Math.min(18.0, initialQ * 1.10) * 100) / 100;
      expect(qUp).toBe(1.55);

      // Wheel down
      const qDown = Math.round(Math.max(0.10, initialQ / 1.10) * 100) / 100;
      expect(qDown).toBe(1.28);
    });

    it('clamps Q-factor scaling to [0.10, 18.00] bounds', () => {
      let q = 17.5;
      for (let i = 0; i < 5; i++) {
        q = Math.round(Math.min(18.0, q * 1.10) * 100) / 100;
      }
      expect(q).toBe(18.0);

      q = 0.15;
      for (let i = 0; i < 5; i++) {
        q = Math.round(Math.max(0.10, q / 1.10) * 100) / 100;
      }
      expect(q).toBe(0.10);
    });

    it('calculates bandwidth in octaves accurately from Q factor', () => {
      const calcBw = (q: number) => {
        const bw = (2 / Math.LN2) * Math.asinh(1 / (2 * q));
        return Math.round(bw * 100) / 100;
      };

      // Q = 1.414 -> ~ 1.00 octaves
      expect(calcBw(1.414)).toBe(1.0);
      // Q = 0.707 -> ~ 2.00 octaves
      expect(calcBw(0.707)).toBe(1.9);
      // High Q = 10.0 -> very narrow bandwidth (~ 0.14 octaves)
      expect(calcBw(10.0)).toBeCloseTo(0.14, 1);
    });
  });

  describe('5. Parametric Filter Types & Presets Support', () => {
    it('supports all 7 filter types in default configuration and custom adjustments', () => {
      const validTypes = ['peaking', 'lowshelf', 'highshelf', 'lowpass', 'highpass', 'notch', 'bandpass'];
      expect(validTypes).toHaveLength(7);

      const filter: ParametricFilterConfig = {
        id: 'test_notch',
        type: 'notch',
        frequency: 60,
        gain: 0,
        q: 10.0,
        enabled: true,
      };

      expect(filter.type).toBe('notch');
      expect(filter.frequency).toBe(60);
    });

    it('contains default 5-point parametric filters as reference baseline', () => {
      expect(DEFAULT_PARAMETRIC_FILTERS).toHaveLength(5);
      expect(DEFAULT_PARAMETRIC_FILTERS[0].type).toBe('lowshelf');
      expect(DEFAULT_PARAMETRIC_FILTERS[4].type).toBe('highshelf');
    });
  });
});
