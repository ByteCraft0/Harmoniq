import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { EqualizerStudio } from '../components/dsp/EqualizerStudio';
import { VinylAudioDial } from '../components/dsp/VinylAudioDial';
import { GraphicEQBand } from '../components/dsp/GraphicEQBand';
import { EQ_FREQUENCIES, DEFAULT_PARAMETRIC_FILTERS } from '../types/dsp';

// Mock contexts
const mockDspSettings = {
  enabled: true,
  eqMode: 'graphic' as const,
  bands: [0, 2, 4, 1, 0, -1, -2, 0, 3, 5],
  parametricFilters: DEFAULT_PARAMETRIC_FILTERS,
  preamp: 1.5,
  bassBoost: 3.0,
  treble: 2.0,
  balance: 0,
  monoMix: false,
  channelMode: 'stereo' as const,
  limiterEnabled: true,
  activePresetId: 'audiophile_warmth',
  stereoWidth: 120,
  stereoWidthEnabled: true,
};

const mockLimiterMetrics = {
  isClippingPrevented: false,
  gainReductionDb: 1.2,
  peakLevel: 0.85,
};

const mockUseDsp = {
  settings: mockDspSettings,
  presets: [
    { id: 'flat', name: 'Flat', isBuiltIn: true, bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], preamp: 0 },
    { id: 'audiophile_warmth', name: 'Audiophile Warmth', isBuiltIn: true, bands: [2, 3, 2, 1, 0, 0, 1, 2, 3, 3], preamp: -1.0 },
    { id: 'late_night', name: 'Late Night', isBuiltIn: true, bands: [1, 2, 1, 0, 0, -1, -2, -2, -1, 0], preamp: 0 },
    { id: 'electronic_punch', name: 'Electronic Punch', isBuiltIn: true, bands: [5, 4, 2, 0, 0, 1, 3, 4, 5, 4], preamp: -2.0 },
  ],
  limiterMetrics: mockLimiterMetrics,
  setEQMode: vi.fn(),
  setBandGain: vi.fn(),
  setPreamp: vi.fn(),
  setBassBoost: vi.fn(),
  setTreble: vi.fn(),
  setBalance: vi.fn(),
  resetBalance: vi.fn(),
  setChannelMode: vi.fn(),
  setStereoWidth: vi.fn(),
  toggleStereoWidth: vi.fn(),
  resetStereoWidth: vi.fn(),
  toggleMonoMix: vi.fn(),
  toggleDSPEnabled: vi.fn(),
  toggleLimiter: vi.fn(),
  resetToFlat: vi.fn(),
  applyPreset: vi.fn(),
  addParametricFilter: vi.fn(),
  updateParametricFilter: vi.fn(),
  removeParametricFilter: vi.fn(),
  toggleParametricFilter: vi.fn(),
  auditionFilterId: null,
  soloFilter: vi.fn(),
  importAutoEqProfile: vi.fn(),
  saveCustomPreset: vi.fn(),
  renameCustomPreset: vi.fn(),
  deleteCustomPreset: vi.fn(),
  exportPresetsAsJson: vi.fn(() => '{}'),
  importPresetsFromJson: vi.fn(() => ({ success: true, count: 1 })),
  resetToDefaults: vi.fn(),
  soundProfiles: [],
  activeSoundProfileId: 'audiophile_warmth',
  applySoundProfile: vi.fn(),
  isProfileModified: false,
  saveCurrentAsProfile: vi.fn(),
  restoreActiveProfile: vi.fn(),
  deleteCustomProfile: vi.fn(),
  duplicateSoundProfile: vi.fn(),
  currentTrackProfile: null,
  saveCurrentForTrack: vi.fn(),
  removeTrackProfile: vi.fn(),
  toggleTrackProfile: vi.fn(),
  allTrackProfiles: [],
  deviceProfiles: [],
  saveDevicePreferences: vi.fn(),
  getQualityReport: vi.fn(() => null),
};

const mockUsePlayer = {
  currentTrack: {
    id: 'track-1',
    title: 'Comfortably Numb',
    artist: 'Pink Floyd',
    album: 'The Wall',
    duration: 382,
    filePath: 'C:/Music/test.flac',
  },
  isPlaying: true,
  volume: 0.85,
  replayGainMode: 'track' as const,
  outputDevices: [
    { deviceId: 'default', label: 'Default High Definition Audio', isDefault: true, sampleRate: 48000, channels: 2 },
  ],
  currentDeviceId: 'default',
  setOutputDevice: vi.fn(),
  refreshOutputDevices: vi.fn(),
};

vi.mock('../context/DSPContext', () => ({
  useDSP: () => mockUseDsp,
}));

vi.mock('../context/PlayerContext', () => ({
  usePlayer: () => mockUsePlayer,
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../services/audioEngine', () => ({
  audioEngine: {
    getCombinedFrequencyResponse: vi.fn(() => new Float32Array(160)),
  },
}));

vi.mock('../components/visualizer/AudioVisualizer', () => ({
  AudioVisualizer: () => <div data-testid="audio-visualizer-mock" />,
}));

vi.mock('../components/dsp/ParametricEQCurve', () => ({
  ParametricEQCurve: () => <div data-testid="parametric-eq-curve-mock" />,
}));

vi.mock('../components/dsp/AutoEqImportModal', () => ({
  AutoEqImportModal: () => <div data-testid="autoeq-modal-mock" />,
}));

describe('HARMONIQ 2.0.1 — Premium Equalizer & Audio Effects Modernization Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Color System & Architectural Strictness', () => {
    it('enforces Charcoal Black surfaces and Muted Violet accents throughout the Equalizer Studio', () => {
      const html = renderToString(<EqualizerStudio />);

      // Primary Charcoal Black surfaces
      expect(html).toContain('bg-[#09090B]'); // Root background
      expect(html).toContain('bg-[#17171F]'); // Elevated cards
      expect(html).toContain('bg-[#111116]'); // Secondary control surfaces
      expect(html).toContain('border-[#292936]'); // Standard border

      // Muted Violet Accents
      expect(html).toContain('#8B5CF6'); // Primary Violet
      expect(html).toContain('#A78BFA'); // Secondary Violet

      // Strict Restrictions: No garish rainbow or neon classes
      expect(html).not.toContain('text-sky-400');
      expect(html).not.toContain('text-orange-400');
      expect(html).not.toContain('text-pink-400');
      expect(html).not.toContain('bg-gradient-to-r from-red');
    });

    it('provides un-crammed, naturally scrollable page structure with bounded vertical scroll', () => {
      const html = renderToString(<EqualizerStudio />);

      // Root element must enable vertical scrolling and contain horizontal overflow
      expect(html).toContain('h-full w-full overflow-y-auto overflow-x-hidden');
      expect(html).toContain('scrollbar-thin');
    });
  });

  describe('2. SECTION 1: Equalizer Header & Tuned Preset Selector', () => {
    it('renders the refined studio header with title, 32-bit DSP badge, and status controls', () => {
      const html = renderToString(<EqualizerStudio />);

      expect(html).toContain('Equalizer &amp; Audio DSP Studio');
      expect(html).toContain('32-Bit Float DSP');
      expect(html).toContain('Reset Flat');
      expect(html).toContain('DSP: ACTIVE');
    });

    it('renders acoustic presets with active preset highlighted in muted violet', () => {
      const html = renderToString(<EqualizerStudio />);

      expect(html).toContain('Acoustic Profiles &amp; Tuned Presets');
      expect(html).toContain('Audiophile Warmth');
      expect(html).toContain('Late Night');
      expect(html).toContain('Electronic Punch');
      expect(html).toContain('Save Preset');
      expect(html).toContain('Export');
      expect(html).toContain('Import');

      // Active preset has violet styling
      expect(html).toContain('border-[#8B5CF6]');
    });
  });

  describe('3. SECTION 2: 10-Band Graphic Equalizer with Musical Waveform Tracks', () => {
    it('renders all 10 ISO standard frequency bands correctly', () => {
      const html = renderToString(<EqualizerStudio />);

      EQ_FREQUENCIES.forEach((freq) => {
        const label = freq >= 1000 ? `${(freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1)}k` : `${freq}`;
        expect(html).toContain(label);
      });
    });

    it('renders individual GraphicEQBand components with frequency-specific wave decorations and dB values', () => {
      const html = renderToString(
        <GraphicEQBand
          index={0}
          frequency={31}
          gain={3.5}
          onChange={vi.fn()}
          onReset={vi.fn()}
          isPlaying={true}
        />
      );

      // Decibel readout above
      expect(html).toContain('+3.5');
      expect(html).toContain('text-[#A78BFA]');

      // Frequency label and tag below
      expect(html).toContain('31');
      expect(html).toContain('Sub');

      // Waveform SVG track decoration
      expect(html).toContain('<svg width="32" height="180"');
      expect(html).toContain('stroke="#8B5CF6"');

      // Native range slider with double click reset
      expect(html).toContain('class="eq-slider z-20"');
      expect(html).toContain('type="range"');
      expect(html).toContain('min="-12"');
      expect(html).toContain('max="12"');
    });

    it('supports negative gains with appropriate muted violet styling', () => {
      const html = renderToString(
        <GraphicEQBand
          index={5}
          frequency={1000}
          gain={-2.5}
          onChange={vi.fn()}
          onReset={vi.fn()}
          isPlaying={false}
        />
      );

      expect(html).toContain('-2.5');
      expect(html).toContain('text-[#8B5CF6]');
      expect(html).toContain('1k');
      expect(html).toContain('Vocal');
    });

    it('renders the interactive combined frequency response curve with mode switcher', () => {
      const html = renderToString(<EqualizerStudio />);

      expect(html).toContain('Combined Frequency Response Curve');
      expect(html).toContain('10-Band Graphic');
      expect(html).toContain('Parametric Nodes');
      expect(html).toContain('<canvas');
    });
  });

  describe('4. SECTION 3: Audio Enhancement Controls (Preamp, Bass Warmth, Treble Air)', () => {
    it('renders Preamp Gain, Bass Warmth, and Treble Air cards with accurate dB readouts', () => {
      const html = renderToString(<EqualizerStudio />);

      // Preamp Gain
      expect(html).toContain('Preamp Gain');
      expect(html).toContain('Input Level Trim');
      expect(html).toContain('+1.5 dB');

      // Bass Warmth
      expect(html).toContain('Bass Warmth');
      expect(html).toContain('50 Hz Low Shelf');
      expect(html).toContain('+3.0 dB');

      // Treble Air
      expect(html).toContain('Treble Air');
      expect(html).toContain('10 kHz High Shelf');
      expect(html).toContain('+2.0 dB');
    });
  });

  describe('5. SECTION 5: Premium Vinyl-Inspired Audio Dial', () => {
    it('renders the VinylAudioDial component on the far right of the enhancement controls', () => {
      const html = renderToString(
        <VinylAudioDial
          value={120}
          min={0}
          max={150}
          defaultValue={100}
          step={5}
          unit="%"
          label="Stereo Width"
          sublabel="Spatial Mid-Side Expander"
          enabled={true}
          onToggleEnabled={vi.fn()}
          onChange={vi.fn()}
          onReset={vi.fn()}
          isPlaying={true}
          size={144}
        />
      );

      // Header & Labels
      expect(html).toContain('Stereo Width');
      expect(html).toContain('Spatial Mid-Side Expander');
      expect(html).toContain('ACTIVE');

      // Miniature Vinyl Record Disc elements
      expect(html).toContain('vinyl-gradient'); // Radial gradient for vinyl surface
      expect(html).toContain('animate-vinyl-spin'); // Gentle 33⅓ RPM rotating animation
      expect(html).toContain('stroke="rgba(255, 255, 255, 0.035)"'); // Concentric grooves
      expect(html).toContain('stroke="rgba(139, 92, 246, 0.05)"'); // Violet groove harmonics

      // Digital readout & Status
      expect(html).toContain('120');
      expect(html).toContain('%');
      expect(html).toContain('Expanded Spatial');
    });

    it('renders neutral state and bypass toggle for VinylAudioDial', () => {
      const html = renderToString(
        <VinylAudioDial
          value={100}
          min={0}
          max={150}
          defaultValue={100}
          step={5}
          unit="%"
          enabled={false}
          onToggleEnabled={vi.fn()}
          onChange={vi.fn()}
          isPlaying={false}
        />
      );

      expect(html).toContain('BYPASS');
      expect(html).toContain('Standard Stereo');
      expect(html).toContain('100');
    });
  });

  describe('6. SECTION 4: Musical Effects & Audio Processing', () => {
    it('renders Dynamic Peak Limiter with live gain reduction meter and anti-clipping status', () => {
      const html = renderToString(<EqualizerStudio />);

      expect(html).toContain('Peak Limiter');
      expect(html).toContain('Anti-Clipping DSP Protection');
      expect(html).toContain('Gain Reduction:');
      expect(html).toContain('-1.2 dB');
      expect(html).toContain('Soft-Knee Compression');
    });

    it('renders Channel Routing and Panning Balance controls', () => {
      const html = renderToString(<EqualizerStudio />);

      expect(html).toContain('Channel Routing &amp; Balance');
      expect(html).toContain('STEREO');
      expect(html).toContain('Stereo Balance');
      expect(html).toContain('Center');
      expect(html).toContain('Full Left');
      expect(html).toContain('Full Right');
    });

    it('renders Quick Acoustic Sound Profiles with instant one-click apply cards', () => {
      const html = renderToString(<EqualizerStudio />);

      expect(html).toContain('Acoustic Profiles');
      expect(html).toContain('Quick Studio Signatures');
      expect(html).toContain('Analog Tube Tone');
      expect(html).toContain('Low-Bass Intimate');
      expect(html).toContain('Fast Dynamic Attack');
      expect(html).toContain('Acoustic Room Field');
    });
  });

  describe('7. Other Tabs Harmonization & Modals', () => {
    it('harmonizes all 5 studio tabs with consistent charcoal & violet navigation', () => {
      const html = renderToString(<EqualizerStudio />);

      expect(html).toContain('Equalizer &amp; Effects');
      expect(html).toContain('Sound Profiles');
      expect(html).toContain('Track EQ Memory');
      expect(html).toContain('Audio Devices');
      expect(html).toContain('Quality Transparency');
    });
  });
});
