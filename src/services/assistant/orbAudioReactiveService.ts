import { audioEngine } from '../audioEngine';

export interface OrbAudioMetrics {
  bass: number;        // Smoothed 0 to 1
  mid: number;         // Smoothed 0 to 1
  treble: number;      // Smoothed 0 to 1
  intensity: number;   // Smoothed 0 to 1
  rawBass: number;     // Raw instant 0 to 1
  rawMid: number;      // Raw instant 0 to 1
  rawTreble: number;   // Raw instant 0 to 1
  rawIntensity: number;// Raw instant 0 to 1
  isPlaying: boolean;
}

const DEFAULT_METRICS: OrbAudioMetrics = {
  bass: 0,
  mid: 0,
  treble: 0,
  intensity: 0,
  rawBass: 0,
  rawMid: 0,
  rawTreble: 0,
  rawIntensity: 0,
  isPlaying: false,
};

export class OrbAudioReactiveService {
  private freqBuffer: Uint8Array = new Uint8Array(1024);
  private timeBuffer: Uint8Array = new Uint8Array(1024);

  // Smoothed visual metrics
  private smoothedBass = 0;
  private smoothedMid = 0;
  private smoothedTreble = 0;
  private smoothedIntensity = 0;

  // Raw metrics
  private currentMetrics: OrbAudioMetrics = { ...DEFAULT_METRICS };

  // Smoothing rates
  private bassAttack = 0.45;
  private bassRelease = 0.10;
  private midAttack = 0.35;
  private midRelease = 0.08;
  private trebleAttack = 0.50;
  private trebleRelease = 0.12;
  private intensityAttack = 0.40;
  private intensityRelease = 0.10;

  // Jitter threshold
  private noiseFloorThreshold = 0.015;

  // Overrides for unit tests
  private sampleRateOverride: number | null = null;
  private mockFreqBuffer: Uint8Array | null = null;
  private mockTimeBuffer: Uint8Array | null = null;
  private mockIsPlaying: boolean | null = null;

  // =========================================================================
  // Core Audio Processing
  // =========================================================================

  /**
   * Samples the audio analyser, updates frequency bands and exponential smoothing,
   * and returns normalized visual metrics in the range 0 to 1.
   */
  public processFrame(): OrbAudioMetrics {
    const isPlaying = this.mockIsPlaying !== null ? this.mockIsPlaying : audioEngine.isPlaying();

    // If audio is paused or stopped, decay smoothed values to zero and return
    if (!isPlaying) {
      this.smoothedBass = Math.max(0, this.smoothedBass * 0.75);
      this.smoothedMid = Math.max(0, this.smoothedMid * 0.75);
      this.smoothedTreble = Math.max(0, this.smoothedTreble * 0.75);
      this.smoothedIntensity = Math.max(0, this.smoothedIntensity * 0.75);

      if (this.smoothedBass < 0.005) this.smoothedBass = 0;
      if (this.smoothedMid < 0.005) this.smoothedMid = 0;
      if (this.smoothedTreble < 0.005) this.smoothedTreble = 0;
      if (this.smoothedIntensity < 0.005) this.smoothedIntensity = 0;

      this.currentMetrics = {
        bass: this.smoothedBass,
        mid: this.smoothedMid,
        treble: this.smoothedTreble,
        intensity: this.smoothedIntensity,
        rawBass: 0,
        rawMid: 0,
        rawTreble: 0,
        rawIntensity: 0,
        isPlaying: false,
      };
      return this.currentMetrics;
    }

    // Determine current FFT and frequency bin counts
    const binCount = this.mockFreqBuffer
      ? this.mockFreqBuffer.length
      : audioEngine.getFrequencyBinCount() || 1024;
    const fftSize = audioEngine.getFftSize() || binCount * 2 || 2048;
    const sampleRate =
      this.sampleRateOverride ||
      audioEngine.getAudioContext()?.sampleRate ||
      44100;

    // Ensure buffers match binCount
    if (this.freqBuffer.length !== binCount) {
      this.freqBuffer = new Uint8Array(binCount);
    }
    if (this.timeBuffer.length !== binCount) {
      this.timeBuffer = new Uint8Array(binCount);
    }

    // Fetch live frequency & time domain data from AudioEngine AnalyserNode
    if (this.mockFreqBuffer) {
      this.freqBuffer.set(this.mockFreqBuffer);
    } else {
      audioEngine.getFrequencyData(this.freqBuffer);
    }

    if (this.mockTimeBuffer) {
      this.timeBuffer.set(this.mockTimeBuffer);
    } else {
      audioEngine.getTimeDomainData(this.timeBuffer);
    }

    // Calculate bin width in Hz (e.g. 44100 / 2048 ≈ 21.53 Hz per bin)
    const binWidth = sampleRate / fftSize;

    // Compute raw energies for Bass, Midrange, and Treble
    let rawBass = this.computeBandEnergy(20, 250, binWidth, binCount);
    let rawMid = this.computeBandEnergy(250, 4000, binWidth, binCount);
    let rawTreble = this.computeBandEnergy(4000, 20000, binWidth, binCount);

    // Apply noise floor threshold to prevent micro-jitter
    if (rawBass < this.noiseFloorThreshold) rawBass = 0;
    if (rawMid < this.noiseFloorThreshold) rawMid = 0;
    if (rawTreble < this.noiseFloorThreshold) rawTreble = 0;

    // Compute overall intensity (mix of full spectrum frequency energy + waveform RMS deviation)
    let rawIntensity = this.computeOverallIntensity(binCount);
    if (rawIntensity < this.noiseFloorThreshold) rawIntensity = 0;

    // Apply Asymmetric Attack and Release Smoothing
    this.smoothedBass = this.applySmoothing(this.smoothedBass, rawBass, this.bassAttack, this.bassRelease);
    this.smoothedMid = this.applySmoothing(this.smoothedMid, rawMid, this.midAttack, this.midRelease);
    this.smoothedTreble = this.applySmoothing(this.smoothedTreble, rawTreble, this.trebleAttack, this.trebleRelease);
    this.smoothedIntensity = this.applySmoothing(
      this.smoothedIntensity,
      rawIntensity,
      this.intensityAttack,
      this.intensityRelease
    );

    this.currentMetrics = {
      bass: Math.min(1.0, Math.max(0, this.smoothedBass)),
      mid: Math.min(1.0, Math.max(0, this.smoothedMid)),
      treble: Math.min(1.0, Math.max(0, this.smoothedTreble)),
      intensity: Math.min(1.0, Math.max(0, this.smoothedIntensity)),
      rawBass: Math.min(1.0, Math.max(0, rawBass)),
      rawMid: Math.min(1.0, Math.max(0, rawMid)),
      rawTreble: Math.min(1.0, Math.max(0, rawTreble)),
      rawIntensity: Math.min(1.0, Math.max(0, rawIntensity)),
      isPlaying: true,
    };

    return this.currentMetrics;
  }

  /**
   * Returns the most recent processed metrics without advancing state.
   */
  public getMetrics(): OrbAudioMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Returns the raw time-domain waveform buffer for fine ripple rendering.
   */
  public getTimeDomainBuffer(): Uint8Array {
    return this.timeBuffer;
  }

  /**
   * Resets all smoothed metrics and buffers to initial zero states.
   */
  public reset(): void {
    this.smoothedBass = 0;
    this.smoothedMid = 0;
    this.smoothedTreble = 0;
    this.smoothedIntensity = 0;
    this.freqBuffer.fill(0);
    this.timeBuffer.fill(128);
    this.currentMetrics = { ...DEFAULT_METRICS };
  }

  // =========================================================================
  // Private Helper Computations
  // =========================================================================

  private computeBandEnergy(
    minHz: number,
    maxHz: number,
    binWidth: number,
    binCount: number
  ): number {
    if (binWidth <= 0 || binCount <= 0) return 0;

    const startBin = Math.max(0, Math.min(binCount - 1, Math.floor(minHz / binWidth)));
    const endBin = Math.max(startBin + 1, Math.min(binCount, Math.ceil(maxHz / binWidth)));

    let sum = 0;
    let count = 0;

    for (let i = startBin; i < endBin; i++) {
      sum += this.freqBuffer[i];
      count++;
    }

    if (count === 0) return 0;
    return Math.min(1.0, sum / count / 255.0);
  }

  private computeOverallIntensity(binCount: number): number {
    if (binCount <= 0) return 0;

    // 1. Average of all frequency bins
    let freqSum = 0;
    for (let i = 0; i < binCount; i++) {
      freqSum += this.freqBuffer[i];
    }
    const freqAvg = freqSum / binCount / 255.0;

    // 2. RMS of time-domain waveform around center value (128)
    const timeLen = this.timeBuffer.length;
    let timeSqSum = 0;
    for (let i = 0; i < timeLen; i++) {
      const dev = (this.timeBuffer[i] - 128) / 128.0;
      timeSqSum += dev * dev;
    }
    const rms = timeLen > 0 ? Math.sqrt(timeSqSum / timeLen) : 0;

    // Weighted blend: 65% frequency magnitude + 35% time-domain dynamic RMS
    const blended = freqAvg * 0.65 + rms * 0.35 * 1.5;
    return Math.min(1.0, blended);
  }

  private applySmoothing(
    current: number,
    target: number,
    attack: number,
    release: number
  ): number {
    if (target > current) {
      return current + (target - current) * attack;
    } else {
      return current + (target - current) * release;
    }
  }

  // =========================================================================
  // Testing & Calibration Utilities
  // =========================================================================

  public setSampleRate(rate: number): void {
    this.sampleRateOverride = rate;
  }

  public setMockFrequencyData(buffer: Uint8Array | null): void {
    this.mockFreqBuffer = buffer;
  }

  public setMockTimeDomainData(buffer: Uint8Array | null): void {
    this.mockTimeBuffer = buffer;
  }

  public setMockIsPlaying(playing: boolean | null): void {
    this.mockIsPlaying = playing;
  }
}

export const orbAudioReactiveService = new OrbAudioReactiveService();
