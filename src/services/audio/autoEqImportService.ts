import { ParametricFilterConfig, ParametricFilterType } from '../../types/dsp';

export interface AutoEqParseResult {
  success: boolean;
  filters: ParametricFilterConfig[];
  preamp: number;
  totalParsed: number;
  warnings: string[];
  error?: string;
  rawTextLength: number;
}

const MAX_TEXT_LENGTH = 50 * 1024; // 50 KB limit
const MAX_PARAMETRIC_FILTERS = 12;

/**
 * Maps common AutoEQ / Equalizer APO filter type representations to Harmoniq's ParametricFilterType.
 */
function normalizeFilterType(rawType: string): ParametricFilterType {
  const upper = rawType.toUpperCase().trim();
  switch (upper) {
    case 'PK':
    case 'PEAK':
    case 'PEAKING':
      return 'peaking';
    case 'LSC':
    case 'LOW_SHELF':
    case 'LOWSHELF':
    case 'LS':
      return 'lowshelf';
    case 'HSC':
    case 'HIGH_SHELF':
    case 'HIGHSHELF':
    case 'HS':
      return 'highshelf';
    case 'LP':
    case 'LOW_PASS':
    case 'LOWPASS':
      return 'lowpass';
    case 'HP':
    case 'HIGH_PASS':
    case 'HIGHPASS':
      return 'highpass';
    case 'NO':
    case 'NOTCH':
      return 'notch';
    case 'BP':
    case 'BAND_PASS':
    case 'BANDPASS':
      return 'bandpass';
    default:
      return 'peaking';
  }
}

/**
 * Clamp a number to a specified range, with fallback.
 */
function clamp(val: number, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

/**
 * Convert bandwidth in octaves to Q factor:
 * Q = sqrt(2^BW) / (2^BW - 1)
 */
function bwToQ(bw: number): number {
  if (bw <= 0) return 1.414;
  const twoPowerBw = Math.pow(2, bw);
  const q = Math.sqrt(twoPowerBw) / (twoPowerBw - 1);
  return Number.isFinite(q) && q > 0 ? q : 1.414;
}

/**
 * Service to parse, validate, and preview AutoEQ and Equalizer APO parametric profiles.
 */
export class AutoEqImportService {
  /**
   * Parse text in Equalizer APO or AutoEQ format into Harmoniq parametric filter configurations.
   */
  public static parseAutoEqText(text: string): AutoEqParseResult {
    const warnings: string[] = [];

    if (!text || typeof text !== 'string') {
      return {
        success: false,
        filters: [],
        preamp: 0,
        totalParsed: 0,
        warnings: [],
        error: 'No text provided for import.',
        rawTextLength: 0,
      };
    }

    if (text.length > MAX_TEXT_LENGTH) {
      warnings.push(`Import text exceeded 50KB limit (${Math.round(text.length / 1024)}KB). Truncated.`);
      text = text.slice(0, MAX_TEXT_LENGTH);
    }

    const lines = text.split(/\r?\n/);
    let preamp = 0;
    const parsedFilters: ParametricFilterConfig[] = [];
    let filterIndex = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const rawLine = lines[lineIndex].trim();
      if (!rawLine || rawLine.startsWith('#') || rawLine.startsWith('//') || rawLine.startsWith(';')) {
        continue;
      }

      // Check for Preamp directive: e.g. "Preamp: -6.5 dB" or "Preamp: -6.5dB"
      const preampMatch = rawLine.match(/^Preamp:\s*([+-]?\d+(?:\.\d+)?)\s*(?:dB)?/i);
      if (preampMatch) {
        const parsedPreamp = parseFloat(preampMatch[1]);
        if (Number.isFinite(parsedPreamp)) {
          preamp = clamp(parsedPreamp, -18, 18, 0);
        }
        continue;
      }

      // 1. Equalizer APO standard format:
      // "Filter 1: ON PK Fc 32.0 Hz Gain 3.2 dB Q 1.41"
      // or "Filter: ON LSC Fc 105 Hz Gain -2.1 dB Q 0.71"
      // or "Filter 3: OFF PK Fc 1000 Hz Gain 0.0 dB Q 1.0"
      const apoPattern = /(?:Filter\s*\d*:\s*)?(ON|OFF)?\s*(PK|PEAK|PEAKING|LSC|LOW_SHELF|LOWSHELF|LS|HSC|HIGH_SHELF|HIGHSHELF|HS|LP|LOW_PASS|LOWPASS|HP|HIGH_PASS|HIGHPASS|NO|NOTCH|BP|BAND_PASS|BANDPASS)\s+(?:Fc\s*)?([0-9.]+)\s*(?:Hz)?\s+(?:Gain\s*)?([+-]?[0-9.]+)\s*(?:dB)?\s+(?:(Q|BW\s+Oct)\s*)?([0-9.]+)/i;
      const apoMatch = rawLine.match(apoPattern);

      if (apoMatch) {
        const stateStr = apoMatch[1]?.toUpperCase();
        const typeStr = apoMatch[2];
        const freqVal = parseFloat(apoMatch[3]);
        const gainVal = parseFloat(apoMatch[4]);
        const qOrBwType = apoMatch[5]?.toUpperCase();
        const qOrBwVal = parseFloat(apoMatch[6]);

        if (Number.isFinite(freqVal)) {
          const type = normalizeFilterType(typeStr);
          const frequency = clamp(Math.round(freqVal), 20, 20000, 1000);
          const gain = clamp(Math.round(gainVal * 10) / 10, -18, 18, 0);
          let q = 1.414;
          if (qOrBwType && qOrBwType.includes('BW')) {
            q = clamp(Math.round(bwToQ(qOrBwVal) * 100) / 100, 0.1, 18.0, 1.414);
          } else if (Number.isFinite(qOrBwVal)) {
            q = clamp(Math.round(qOrBwVal * 100) / 100, 0.1, 18.0, 1.414);
          }
          const enabled = stateStr !== 'OFF';

          filterIndex++;
          parsedFilters.push({
            id: `autoeq_${filterIndex}_${Date.now()}`,
            type,
            frequency,
            gain,
            q,
            enabled,
          });
          continue;
        }
      }

      // 2. Tab or space-delimited table line: e.g. "PK 32.0 3.2 1.41" or "32 3.2 1.41"
      // or "Filter 1: 32 Hz, +3.2 dB, Q 1.41"
      const columns = rawLine.split(/[\t, ]+/).filter(Boolean);
      if (columns.length >= 3) {
        // Try to identify columns
        let type: ParametricFilterType = 'peaking';
        let freqVal: number | null = null;
        let gainVal: number | null = null;
        let qVal: number | null = null;

        let colStart = 0;
        // Check if first token is "Filter" or explicit index with colon
        if (/^filter:?$/i.test(columns[0])) {
          colStart = 1;
          if (columns[1] && /^\d+:?$/.test(columns[1])) {
            colStart = 2;
          }
        } else if (/^\d+:$/.test(columns[0])) {
          colStart = 1;
        } else if (
          columns.length >= 4 &&
          /^\d+$/.test(columns[0]) &&
          /^(PK|PEAK|LSC|HSC|LP|HP|NO|BP|ON|OFF)/i.test(columns[1])
        ) {
          colStart = 1;
        }
        if (columns[colStart] && /^(ON|OFF)$/i.test(columns[colStart])) {
          colStart++;
        }

        const remaining = columns.slice(colStart);
        // Check if remaining[0] is filter type
        if (remaining.length >= 3 && /^(PK|PEAK|LSC|HSC|LP|HP|NO|BP)/i.test(remaining[0])) {
          type = normalizeFilterType(remaining[0]);
          freqVal = parseFloat(remaining[1].replace(/[^0-9.]/g, ''));
          gainVal = parseFloat(remaining[2].replace(/[^-+0-9.]/g, ''));
          qVal = remaining[3] ? parseFloat(remaining[3].replace(/[^0-9.]/g, '')) : 1.414;
        } else if (remaining.length >= 3) {
          // Triplet: freq gain q
          const c0 = parseFloat(remaining[0].replace(/[^0-9.]/g, ''));
          const c1 = parseFloat(remaining[1].replace(/[^-+0-9.]/g, ''));
          const c2 = parseFloat(remaining[2].replace(/[^0-9.]/g, ''));
          if (Number.isFinite(c0) && Number.isFinite(c1)) {
            freqVal = c0;
            gainVal = c1;
            qVal = Number.isFinite(c2) && c2 > 0 ? c2 : 1.414;
          }
        }

        if (freqVal !== null && Number.isFinite(freqVal) && gainVal !== null && Number.isFinite(gainVal)) {
          filterIndex++;
          parsedFilters.push({
            id: `autoeq_${filterIndex}_${Date.now()}`,
            type,
            frequency: clamp(Math.round(freqVal), 20, 20000, 1000),
            gain: clamp(Math.round(gainVal * 10) / 10, -18, 18, 0),
            q: clamp(Math.round((qVal ?? 1.414) * 100) / 100, 0.1, 18.0, 1.414),
            enabled: true,
          });
          continue;
        }
      }
    }

    if (parsedFilters.length === 0) {
      return {
        success: false,
        filters: [],
        preamp,
        totalParsed: 0,
        warnings,
        error: 'No valid parametric filters found in the provided text.',
        rawTextLength: text.length,
      };
    }

    const totalParsed = parsedFilters.length;
    let finalFilters = parsedFilters;

    if (parsedFilters.length > MAX_PARAMETRIC_FILTERS) {
      warnings.push(
        `Profile contained ${totalParsed} filters. Harmoniq supports up to ${MAX_PARAMETRIC_FILTERS} parametric bands. The 12 most impactful filters (highest absolute gain / key cutoffs) have been preserved in frequency order.`
      );

      // Rank by importance: absolute gain or shelf/cut filters, pick top 12, then sort back by frequency
      const indexed = parsedFilters.map((f, origIdx) => {
        let weight = Math.abs(f.gain);
        if (f.type === 'lowshelf' || f.type === 'highshelf') weight += 2;
        if (f.type === 'lowpass' || f.type === 'highpass') weight += 3;
        return { filter: f, weight, origIdx };
      });

      indexed.sort((a, b) => b.weight - a.weight);
      const top12 = indexed.slice(0, MAX_PARAMETRIC_FILTERS);
      top12.sort((a, b) => a.filter.frequency - b.filter.frequency);
      finalFilters = top12.map((item, idx) => ({
        ...item.filter,
        id: `autoeq_${idx + 1}_${Date.now()}`,
      }));
    } else {
      // Sort in frequency ascending order for clean UI presentation
      finalFilters.sort((a, b) => a.frequency - b.frequency);
      finalFilters = finalFilters.map((f, idx) => ({
        ...f,
        id: `autoeq_${idx + 1}_${Date.now()}`,
      }));
    }

    return {
      success: true,
      filters: finalFilters,
      preamp,
      totalParsed,
      warnings,
      rawTextLength: text.length,
    };
  }

  /**
   * Offline mathematical evaluation of parametric filter frequency response.
   * Computes the exact transfer function magnitude across test frequencies using standard RBJ cookbook formulas.
   */
  public static evaluateParametricResponse(
    filters: ParametricFilterConfig[],
    preampDb: number,
    testFrequencies: Float32Array,
    sampleRate = 48000
  ): Float32Array {
    const numPoints = testFrequencies.length;
    const responseDb = new Float32Array(numPoints);

    // Initialize with preamp gain
    for (let i = 0; i < numPoints; i++) {
      responseDb[i] = preampDb;
    }

    const activeFilters = filters.filter((f) => f.enabled);
    if (activeFilters.length === 0) {
      return responseDb;
    }

    for (const filter of activeFilters) {
      const f0 = Math.max(20, Math.min(sampleRate * 0.49, filter.frequency));
      const gainDb = filter.gain;
      const q = Math.max(0.1, Math.min(18.0, filter.q));

      // RBJ filter coefficients
      const w0 = (2 * Math.PI * f0) / sampleRate;
      const cosW0 = Math.cos(w0);
      const sinW0 = Math.sin(w0);
      const alpha = sinW0 / (2 * q);
      const A = Math.pow(10, gainDb / 40);

      let b0 = 1;
      let b1 = 0;
      let b2 = 0;
      let a0 = 1;
      let a1 = 0;
      let a2 = 0;

      switch (filter.type) {
        case 'peaking': {
          b0 = 1 + alpha * A;
          b1 = -2 * cosW0;
          b2 = 1 - alpha * A;
          a0 = 1 + alpha / A;
          a1 = -2 * cosW0;
          a2 = 1 - alpha / A;
          break;
        }
        case 'lowshelf': {
          const beta = 2 * Math.sqrt(A) * alpha;
          b0 = A * (A + 1 - (A - 1) * cosW0 + beta);
          b1 = 2 * A * (A - 1 - (A + 1) * cosW0);
          b2 = A * (A + 1 - (A - 1) * cosW0 - beta);
          a0 = A + 1 + (A - 1) * cosW0 + beta;
          a1 = -2 * (A - 1 + (A + 1) * cosW0);
          a2 = A + 1 + (A - 1) * cosW0 - beta;
          break;
        }
        case 'highshelf': {
          const beta = 2 * Math.sqrt(A) * alpha;
          b0 = A * (A + 1 + (A - 1) * cosW0 + beta);
          b1 = -2 * A * (A - 1 + (A + 1) * cosW0);
          b2 = A * (A + 1 + (A - 1) * cosW0 - beta);
          a0 = A + 1 - (A - 1) * cosW0 + beta;
          a1 = 2 * (A - 1 - (A + 1) * cosW0);
          a2 = A + 1 - (A - 1) * cosW0 - beta;
          break;
        }
        case 'lowpass': {
          b0 = (1 - cosW0) / 2;
          b1 = 1 - cosW0;
          b2 = (1 - cosW0) / 2;
          a0 = 1 + alpha;
          a1 = -2 * cosW0;
          a2 = 1 - alpha;
          break;
        }
        case 'highpass': {
          b0 = (1 + cosW0) / 2;
          b1 = -(1 + cosW0);
          b2 = (1 + cosW0) / 2;
          a0 = 1 + alpha;
          a1 = -2 * cosW0;
          a2 = 1 - alpha;
          break;
        }
        case 'notch': {
          b0 = 1;
          b1 = -2 * cosW0;
          b2 = 1;
          a0 = 1 + alpha;
          a1 = -2 * cosW0;
          a2 = 1 - alpha;
          break;
        }
        case 'bandpass': {
          b0 = alpha;
          b1 = 0;
          b2 = -alpha;
          a0 = 1 + alpha;
          a1 = -2 * cosW0;
          a2 = 1 - alpha;
          break;
        }
      }

      // Normalize coefficients
      b0 /= a0;
      b1 /= a0;
      b2 /= a0;
      a1 /= a0;
      a2 /= a0;

      // Evaluate magnitude response across all test frequencies
      for (let i = 0; i < numPoints; i++) {
        const f = testFrequencies[i];
        const w = (2 * Math.PI * f) / sampleRate;
        const cosW = Math.cos(w);
        const cos2W = Math.cos(2 * w);
        const sinW = Math.sin(w);
        const sin2W = Math.sin(2 * w);

        // H(e^{jw}) = (b0 + b1 e^{-jw} + b2 e^{-2jw}) / (1 + a1 e^{-jw} + a2 e^{-2jw})
        const numRe = b0 + b1 * cosW + b2 * cos2W;
        const numIm = -b1 * sinW - b2 * sin2W;
        const denRe = 1 + a1 * cosW + a2 * cos2W;
        const denIm = -a1 * sinW - a2 * sin2W;

        const numMagSq = numRe * numRe + numIm * numIm;
        const denMagSq = denRe * denRe + denIm * denIm;

        if (denMagSq > 1e-12 && numMagSq > 1e-12) {
          const filterGainDb = 10 * Math.log10(numMagSq / denMagSq);
          responseDb[i] += filterGainDb;
        } else if (numMagSq <= 1e-12) {
          // Complete cut (notch/filter zero)
          responseDb[i] += -60;
        }
      }
    }

    return responseDb;
  }
}
