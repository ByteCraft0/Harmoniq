# Harmoniq — Batch 3 & 4: Advanced Audio Visualizer & Professional Equalizer Suite

This engineering report documents the architecture, implementation, and verification of **Batch 3 (Advanced Audio Visualizations)** and **Batch 4 (Professional Equalizer)** for the Harmoniq High-Fidelity Desktop Music Player.

---

## 1. Overview of Delivered Features

### Part A — Advanced Audio Visualizations
1. **Advanced Audio Visualizer Engine (`AdvancedVisualizer.tsx`)**
   - Direct Web Audio API `AnalyserNode` frequency and time-domain analysis.
   - Five visualization modes:
     - **Bars**: Linear and logarithmic spectrum bar graphs with smooth gradients.
     - **Waveform**: Oscilloscope time-domain wave visualization with glowing stroke.
     - **Particles**: Audio-reactive floating particle field driven by bass and mid energy.
     - **Circular Spectrum**: Radial reactive bar constellation.
     - **Wave Rings**: Concentric ripple rings reacting to instantaneous audio dynamics.
   - Dynamic accent coloring derived from album artwork with fallback to Harmoniq's obsidian-violet theme (`#A78BFA` / `#8B5CF6`).
   - Idle / power-saving detection: visualizer automatically halts frame rendering loops when playback is paused, preventing CPU/GPU overhead.
   - Built-in sensitivity adjustment slider (0.5x to 2.5x).

2. **Real-Time 7-Band Frequency Spectrum Analyzer (`RealTimeFrequencySpectrum.tsx`)**
   - Precise frequency division into 7 standard acoustic bands:
     - **Sub-bass**: 20 Hz – 60 Hz
     - **Bass**: 60 Hz – 250 Hz
     - **Low-mid**: 250 Hz – 500 Hz
     - **Mid**: 500 Hz – 2,000 Hz
     - **Upper-mid**: 2,000 Hz – 4,000 Hz
     - **Presence**: 4,000 Hz – 6,000 Hz
     - **Brilliance**: 6,000 Hz – 20,000 Hz
   - Peak-hold indicators with realistic gravity-acceleration decay physics.
   - Logarithmic frequency binning for human auditory perception alignment.
   - Optional frequency and band name labels toggle.
   - Integrated into both the dedicated **Visualizer Studio** view and the **Now Playing** screen.

3. **Immersive Circular Audio Visualizer (`CircularAudioVisualizer.tsx`)**
   - Center rotating album artwork disc with breathing bass pulse.
   - Three distinct radial visual styles:
     - `radial-bars`: Radial bars with peak dots.
     - `radial-wave`: Continuous circular contour wave.
     - `orbit-rings`: Dual nested orbital pulse rings with particle halos.
   - Fullscreen presentation mode with track metadata overlay, keyboard exit (`Escape`), and responsive sizing.

---

### Part B — Professional Equalizer Suite

4. **10-Band Graphic Equalizer (`EqualizerStudio.tsx`)**
   - 10 standard ISO octave center frequencies:
     - **31 Hz, 62 Hz, 125 Hz, 250 Hz, 500 Hz, 1 kHz, 2 kHz, 4 kHz, 8 kHz, 16 kHz**.
   - Individual gain control from **-12.0 dB to +12.0 dB** in 0.1 dB increments.
   - Master Preamp control from **-12.0 dB to +12.0 dB** with quick zero-reset.
   - Master Bypass toggle (`enabled` state).
   - Real-time mathematical EQ curve computed directly from active biquad filter transfer functions.
   - Integrated soft-knee anti-clipping limiter.

5. **Parametric Equalizer Mode**
   - Seamless toggle between Graphic (10-Band) and Parametric modes.
   - Supports 5 fundamental filter topologies:
     - `peaking` (Bell)
     - `lowshelf`
     - `highshelf`
     - `lowpass` (Cut)
     - `highpass` (Cut)
   - Continuous parameter controls per filter:
     - **Frequency**: 20 Hz – 20,000 Hz
     - **Gain**: -18.0 dB – +18.0 dB
     - **Q Factor**: 0.1 – 18.0
   - Interactive SVG/Canvas frequency response curve with **draggable control nodes** (drag horizontally for frequency, vertically for gain, mouse wheel / controls for Q).
   - Ability to add, delete, and enable/disable individual filter bands (up to 12 active filters).

6. **Custom EQ Preset Management System**
   - **11 Built-in Presets**:
     1. Flat
     2. Bass Boost
     3. Treble Boost
     4. Rock
     5. Pop
     6. Classical
     7. Jazz
     8. Electronic
     9. Acoustic
     10. Vocal
     11. Headphones
   - Full user-created preset lifecycle:
     - Save current configuration as a new custom preset.
     - Rename custom presets.
     - Delete custom presets.
     - Export custom presets to a standard JSON file.
     - Import custom presets from JSON with validation and ID collision handling.
     - Reset presets to factory defaults.
   - Persistent storage across application restarts via `localStorage`.
   - Audio parameter ramping (`setTargetAtTime` with 15ms time constant) ensuring 100% pop-free and click-free preset switching.

---

## 2. Audio Engine Architecture

```
   ┌─────────────────┐       ┌─────────────────┐
   │  Deck A Player  │       │  Deck B Player  │
   └────────┬────────┘       └────────┬────────┘
            │                         │
            └───────────┬─────────────┘
                        ▼
            ┌───────────────────────┐
            │ Crossfade / Deck Gain │
            └───────────┬───────────┘
                        ▼
            ┌───────────────────────┐
            │ ReplayGain Pre-Amp    │
            └───────────┬───────────┘
                        ▼
            ┌───────────────────────┐
            │ Master Preamp Gain    │
            └───────────┬───────────┘
                        ▼
            ┌───────────────────────┐
            │ 10-Band Graphic EQ    │  ◄── 10 BiquadFilterNodes (31Hz - 16kHz)
            └───────────┬───────────┘
                        ▼
            ┌───────────────────────┐
            │ 12-Band Parametric EQ │  ◄── 12 Cascaded BiquadFilterNodes
            └───────────┬───────────┘
                        ▼
            ┌───────────────────────┐
            │ Tone (Bass/Treble)    │
            └───────────┬───────────┘
                        ▼
            ┌───────────────────────┐
            │ Anti-Clipping Limiter │
            └───────────┬───────────┘
                        ▼
            ┌───────────────────────┐
            │ Dual AnalyserNodes    │  ◄── Real-time Visualizers & Spectrum
            └───────────┬───────────┘
                        ▼
            ┌───────────────────────┐
            │ AudioDestinationNode  │  (Speakers / Headphones)
            └───────────────────────┘
```

### Zero-Disconnection Signal Routing
To prevent audio dropouts, pops, and browser garbage collection spikes:
- 10 Graphic EQ filters and 12 Parametric filters are pre-instantiated in series within `AudioEngineService`.
- In **Graphic Mode**, parametric filter gains are smoothly set to 0 dB (unity gain).
- In **Parametric Mode**, graphic filter gains are smoothly set to 0 dB (unity gain).
- All changes are applied with Web Audio API exponential smoothing:
  ```typescript
  node.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.015);
  ```

---

## 3. Visualizer Studio & Navigation Integration

- **New Sidebar Navigation Item**: `Audio Studio -> Audio Visualizer` (`Sparkles` icon).
- **Global Keyboard Shortcut**: Press `V` to immediately open the Visualizer Studio.
- **Now Playing Integration**: Quick tab switcher on the Now Playing view allows instant toggling between Album Art, Circular Visualizer, Multi-style Visualizer, and the 7-Band Frequency Spectrum.

---

## 4. Test Verification Summary

### Test Suite Execution
- **Command**: `npm test`
- **Result**: **12 test suites passed, 94 tests passed, 0 failures**.

```
 ✓ src/test/sleep_timer.test.ts (3 tests)
 ✓ src/test/inspector.test.ts (7 tests)
 ✓ src/test/color_extraction.test.ts (4 tests)
 ✓ src/test/lyrics.test.ts (3 tests)
 ✓ src/test/karaoke_lrc_advanced.test.ts (5 tests)
 ✓ src/test/core_playback_enhancements.test.ts (12 tests)
 ✓ src/test/visualizer_and_eq.test.ts (12 tests)
 ✓ src/test/library.test.ts (5 tests)
 ✓ src/test/functionality_fixes.test.ts (15 tests)
 ✓ src/test/windows_integration.test.ts (15 tests)
 ✓ src/test/regression.test.ts (11 tests)
 ✓ src/test/metadata_tagger.test.ts (2 tests)

 Test Files  12 passed (12)
      Tests  94 passed (94)
```

### TypeScript & Production Build Verification
- `npm run build` (`tsc && vite build`) passed with exit code 0.
- `npm run build:electron` (`tsc -p tsconfig.electron.json`) passed with exit code 0.
- Git commit hash: `b234bb2`.
