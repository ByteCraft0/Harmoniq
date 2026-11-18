import { DSPSettings, EQ_FREQUENCIES, LimiterMetrics } from '../types/dsp';
import { TrackMetadata, ReplayGainMode } from '../types/audio';

export type PlaybackStatusCallback = (status: {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isEnded: boolean;
  trackId: string | null;
}) => void;

export type PlaybackErrorCallback = (message: string, track: TrackMetadata | null) => void;

/** Build a robust media URL: constant host + per-segment encoded path (drive colons, spaces, #, % are safe). */
export function buildMediaUrl(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/');
  const isUnc = norm.startsWith('//');
  const body = norm.replace(/^\/+/, '');
  const encoded = body.split('/').map(encodeURIComponent).join('/');
  return `harmoniq-media://local/${isUnc ? 'UNC/' : ''}${encoded}`;
}

class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;

  // DSP Pipeline Nodes
  private replayGainNode: GainNode | null = null;
  private preampGainNode: GainNode | null = null;
  private monoNode: GainNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private bassBoostFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private dspBypassGain: GainNode | null = null;
  private dspActiveGain: GainNode | null = null;

  // State
  private isInitialized = false;
  private currentTrack: TrackMetadata | null = null;
  private statusListeners: Set<PlaybackStatusCallback> = new Set();
  private errorListeners: Set<PlaybackErrorCallback> = new Set();
  private initPromise: Promise<void> | null = null;
  private loadToken = 0;
  private currentUrl = '';
  private volume = 0.85;
  private muted = false;
  private playbackRate = 1;
  private preservesPitch = true;
  private dspSettings: DSPSettings = {
    enabled: true,
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp: 0,
    bassBoost: 0,
    treble: 0,
    balance: 0,
    monoMix: false,
    limiterEnabled: true,
    activePresetId: 'flat',
  };
  private replayGainMode: ReplayGainMode = 'off';
  private crossfadeDuration = 0; // seconds
  private currentSinkId = '';

  constructor() {
    // Lazily initialized on first user interaction to comply with browser audio policies
  }

  public initialize(): Promise<void> {
    if (this.isInitialized) return Promise.resolve();
    if (!this.initPromise) {
      this.initPromise = this.doInitialize();
    }
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass({
        latencyHint: 'interactive',
      });

      this.audioElement = new Audio();
      this.audioElement.crossOrigin = 'anonymous';
      this.audioElement.preload = 'auto';

      // Connect source to Web Audio
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audioElement);

      // 0. ReplayGain (applies to both DSP and bypass paths)
      this.replayGainNode = this.audioCtx.createGain();

      // 1. Preamp Gain
      this.preampGainNode = this.audioCtx.createGain();
      this.preampGainNode.gain.value = 1.0;

      // 2. 10-Band Graphic EQ (Peaking filters)
      this.eqFilters = EQ_FREQUENCIES.map((freq) => {
        const filter = this.audioCtx!.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.414; // Standard 1-octave bandwidth
        filter.gain.value = 0;
        return filter;
      });

      // Chain the 10 EQ filters together
      for (let i = 0; i < this.eqFilters.length - 1; i++) {
        this.eqFilters[i].connect(this.eqFilters[i + 1]);
      }

      // 3. Bass Boost (Low-shelf filter @ 100Hz)
      this.bassBoostFilter = this.audioCtx.createBiquadFilter();
      this.bassBoostFilter.type = 'lowshelf';
      this.bassBoostFilter.frequency.value = 100;
      this.bassBoostFilter.gain.value = 0;

      // 4. Treble Control (High-shelf filter @ 10kHz)
      this.trebleFilter = this.audioCtx.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.value = 10000;
      this.trebleFilter.gain.value = 0;

      // 4b. Mono downmix switch (explicit channel count 1 = downmix, 2 = passthrough)
      this.monoNode = this.audioCtx.createGain();
      this.monoNode.channelCountMode = 'explicit';
      this.monoNode.channelInterpretation = 'speakers';
      this.monoNode.channelCount = 2;

      // 5. Stereo Panner
      if (this.audioCtx.createStereoPanner) {
        this.pannerNode = this.audioCtx.createStereoPanner();
        this.pannerNode.pan.value = 0;
      }

      // 6. Anti-Clipping Brickwall Limiter (DynamicsCompressorNode)
      this.limiterNode = this.audioCtx.createDynamicsCompressor();
      this.limiterNode.threshold.value = -0.5; // Trigger just below 0 dBFS
      this.limiterNode.knee.value = 3.0;
      this.limiterNode.ratio.value = 20.0; // Brickwall ratio
      this.limiterNode.attack.value = 0.003; // Fast 3ms attack
      this.limiterNode.release.value = 0.1; // 100ms release

      // 7. High-Resolution FFT Analyser
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // 8. Bypass routing nodes
      this.dspActiveGain = this.audioCtx.createGain();
      this.dspBypassGain = this.audioCtx.createGain();

      // Connect DSP chain:
      // Source -> Preamp -> EQ[0]...EQ[9] -> BassBoost -> Treble -> (Panner) -> Limiter -> dspActiveGain -> Analyser -> Destination
      this.sourceNode.connect(this.replayGainNode);
      this.replayGainNode.connect(this.preampGainNode);
      this.preampGainNode.connect(this.eqFilters[0]);
      this.eqFilters[this.eqFilters.length - 1].connect(this.bassBoostFilter);
      this.bassBoostFilter.connect(this.trebleFilter);

      this.trebleFilter.connect(this.monoNode);
      if (this.pannerNode) {
        this.monoNode.connect(this.pannerNode);
        this.pannerNode.connect(this.limiterNode);
      } else {
        this.monoNode.connect(this.limiterNode);
      }

      this.limiterNode.connect(this.dspActiveGain);
      this.dspActiveGain.connect(this.analyserNode);

      // Bypass path:
      // Source -> dspBypassGain -> Analyser -> Destination
      this.replayGainNode.connect(this.dspBypassGain);
      this.dspBypassGain.connect(this.analyserNode);

      this.analyserNode.connect(this.audioCtx.destination);

      // Event handlers for audio element
      this.setupAudioListeners();

      // Apply everything that was configured before the graph existed
      this.audioElement.volume = this.volume;
      this.audioElement.muted = this.muted;
      this.audioElement.playbackRate = this.playbackRate;
      (this.audioElement as any).preservesPitch = this.preservesPitch;
      this.applyDSPSettings(this.dspSettings);
      if (this.currentSinkId) {
        this.setAudioOutputDevice(this.currentSinkId).catch(() => {});
      }

      this.isInitialized = true;
    } catch (err) {
      console.error('Failed to initialize AudioEngine:', err);
      this.initPromise = null; // allow retry
    }
  }

  private setupAudioListeners(): void {
    if (!this.audioElement) return;

    this.audioElement.addEventListener('timeupdate', () => {
      this.emitStatus();
    });

    this.audioElement.addEventListener('play', () => {
      this.emitStatus();
    });

    this.audioElement.addEventListener('pause', () => {
      this.emitStatus();
    });

    this.audioElement.addEventListener('ended', () => {
      this.emitStatus(true);
    });

    this.audioElement.addEventListener('loadedmetadata', () => {
      this.emitStatus();
    });

    this.audioElement.addEventListener('durationchange', () => {
      this.emitStatus();
    });

    this.audioElement.addEventListener('playing', () => {
      this.emitStatus();
    });

    this.audioElement.addEventListener('error', () => {
      const err = this.audioElement?.error;
      // MEDIA_ERR_ABORTED (1) happens when we intentionally swap sources
      if (!err || err.code === 1) return;
      const message = err.code === 4 ? 'Unsupported or missing audio file' : err.message || 'Playback error';
      this.errorListeners.forEach((cb) => cb(message, this.currentTrack));
    });
  }

  public subscribeError(callback: PlaybackErrorCallback): () => void {
    this.errorListeners.add(callback);
    return () => {
      this.errorListeners.delete(callback);
    };
  }

  private emitStatus(isEnded = false): void {
    if (!this.audioElement) return;
    const status = {
      currentTime: this.audioElement.currentTime,
      duration: Number.isFinite(this.audioElement.duration) && this.audioElement.duration > 0 ? this.audioElement.duration : (this.currentTrack?.duration ?? 0),
      isPlaying: !this.audioElement.paused && !this.audioElement.ended,
      isEnded,
      trackId: this.currentTrack?.id ?? null,
    };
    this.statusListeners.forEach((cb) => cb(status));
  }

  public subscribeStatus(callback: PlaybackStatusCallback): () => void {
    this.statusListeners.add(callback);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  // Playback Control
  public async loadAndPlay(track: TrackMetadata, startTime = 0): Promise<void> {
    const token = ++this.loadToken;
    await this.initialize();
    if (!this.audioCtx || !this.audioElement) return;

    if (this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
        /* resumed on next user gesture */
      }
    }
    if (token !== this.loadToken) return; // superseded by a newer request

    this.currentTrack = track;

    // Custom local streaming protocol
    const mediaUrl = buildMediaUrl(track.filePath);
    if (this.currentUrl !== mediaUrl) {
      this.currentUrl = mediaUrl;
      this.audioElement.src = mediaUrl;
    }

    this.applyReplayGain(track);

    // Changing src resets playbackRate to default, so re-apply the user's speed
    this.audioElement.playbackRate = track.customPlaybackSpeed || this.playbackRate;
    (this.audioElement as any).preservesPitch = this.preservesPitch;

    try {
      this.audioElement.currentTime = startTime;
    } catch {
      /* metadata not ready; start from 0 */
    }

    try {
      await this.audioElement.play();
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.warn('Playback failed:', err);
    }

    if (token === this.loadToken) this.emitStatus();
  }

  public async play(): Promise<void> {
    await this.initialize();
    if (!this.audioCtx || !this.audioElement) return;

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    try {
      await this.audioElement.play();
    } catch (e) {
      console.warn('Play error:', e);
    }
    this.emitStatus();
  }

  public pause(): void {
    if (!this.audioElement) return;
    this.audioElement.pause();
    this.emitStatus();
  }

  public seek(seconds: number): void {
    if (!this.audioElement) return;
    const dur = this.audioElement.duration;
    const max = Number.isFinite(dur) && dur > 0 ? dur : Infinity;
    this.audioElement.currentTime = Math.max(0, Math.min(seconds, max));
    this.emitStatus();
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audioElement) this.audioElement.volume = this.volume;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMute(mute: boolean): void {
    this.muted = mute;
    if (this.audioElement) this.audioElement.muted = mute;
  }

  public setPlaybackRate(rate: number, preservesPitch = true): void {
    this.playbackRate = Math.max(0.5, Math.min(3.0, rate));
    this.preservesPitch = preservesPitch;
    if (!this.audioElement) return;
    this.audioElement.playbackRate = this.playbackRate;
    (this.audioElement as any).preservesPitch = preservesPitch;
  }

  public setCrossfadeDuration(seconds: number): void {
    this.crossfadeDuration = Math.max(0, Math.min(10, seconds));
  }

  public getCrossfadeDuration(): number {
    return this.crossfadeDuration;
  }

  public setReplayGainMode(mode: ReplayGainMode): void {
    this.replayGainMode = mode;
    if (this.currentTrack) {
      this.applyReplayGain(this.currentTrack);
    }
  }

  // ReplayGain (applied on its own node so it also works when DSP is bypassed)
  private applyReplayGain(track: TrackMetadata | null): void {
    if (!this.replayGainNode || !this.audioCtx) return;
    let gainDb = 0;
    let peak = 0;
    const rg = track?.replayGain;

    if (this.replayGainMode !== 'off' && rg) {
      if (this.replayGainMode === 'track' && Number.isFinite(rg.trackGain)) {
        gainDb = rg.trackGain as number;
        peak = rg.trackPeak ?? 0;
      } else if (this.replayGainMode === 'album' && Number.isFinite(rg.albumGain)) {
        gainDb = rg.albumGain as number;
        peak = rg.albumPeak ?? 0;
      }
    }

    let linear = Math.pow(10, gainDb / 20);
    // Never boost past full scale according to the recorded peak
    if (linear > 1 && peak > 0) linear = Math.min(linear, 1 / peak);
    this.replayGainNode.gain.setTargetAtTime(linear, this.audioCtx.currentTime, 0.05);
  }

  private applyPreamp(): void {
    if (!this.preampGainNode || !this.audioCtx) return;
    const linear = Math.pow(10, this.dspSettings.preamp / 20);
    this.preampGainNode.gain.setTargetAtTime(linear, this.audioCtx.currentTime, 0.05);
  }

  // Real-time DSP Controls
  public applyDSPSettings(settings: DSPSettings): void {
    this.dspSettings = { ...settings };
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;

    // 1. Preamp gain + ReplayGain
    this.applyPreamp();
    this.applyReplayGain(this.currentTrack);

    // 2. 10-band EQ
    this.eqFilters.forEach((filter, index) => {
      const gainValue = settings.bands[index] ?? 0;
      filter.gain.setTargetAtTime(gainValue, now, 0.05);
    });

    // 3. Bass Boost
    if (this.bassBoostFilter) {
      this.bassBoostFilter.gain.setTargetAtTime(settings.bassBoost, now, 0.05);
    }

    // 4. Treble Boost
    if (this.trebleFilter) {
      this.trebleFilter.gain.setTargetAtTime(settings.treble, now, 0.05);
    }

    // 5. Stereo Balance
    if (this.pannerNode) {
      this.pannerNode.pan.setTargetAtTime(settings.balance, now, 0.05);
    }

    // 6. Mono downmix
    if (this.monoNode) {
      this.monoNode.channelCount = settings.monoMix ? 1 : 2;
    }

    // 7. Limiter (transparent when disabled)
    if (this.limiterNode) {
      if (settings.limiterEnabled) {
        this.limiterNode.threshold.value = -0.5;
        this.limiterNode.knee.value = 3.0;
        this.limiterNode.ratio.value = 20.0;
      } else {
        this.limiterNode.threshold.value = 0;
        this.limiterNode.knee.value = 0;
        this.limiterNode.ratio.value = 1.0;
      }
    }

    // 8. Master Bypass
    this.updateBypassState();
  }

  private updateBypassState(): void {
    if (!this.dspActiveGain || !this.dspBypassGain || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    if (this.dspSettings.enabled) {
      // Active: Route through DSP pipeline
      this.dspActiveGain.gain.setTargetAtTime(1.0, now, 0.03);
      this.dspBypassGain.gain.setTargetAtTime(0.0, now, 0.03);
    } else {
      // Bypassed: Route directly to analyser/output
      this.dspActiveGain.gain.setTargetAtTime(0.0, now, 0.03);
      this.dspBypassGain.gain.setTargetAtTime(1.0, now, 0.03);
    }
  }

  // Limiter Metrics & Anti-Clipping Reporting
  public getLimiterMetrics(): LimiterMetrics {
    if (!this.limiterNode) {
      return { isClippingPrevented: false, gainReductionDb: 0, peakLevel: 0 };
    }

    // DynamicsCompressorNode.reduction returns negative value in dB of gain reduction
    const reduction = this.limiterNode.reduction || 0;
    return {
      isClippingPrevented: reduction < -0.1,
      gainReductionDb: Math.abs(reduction),
      peakLevel: reduction,
    };
  }

  // Real-time FFT Frequency Data for Visualizer
  public getFrequencyData(array: any): void {
    if (this.analyserNode) {
      this.analyserNode.getByteFrequencyData(array);
    }
  }

  // Real-time Oscillogram Time-Domain Data for Waveform Visualizer
  public getTimeDomainData(array: any): void {
    if (this.analyserNode) {
      this.analyserNode.getByteTimeDomainData(array);
    }
  }

  public getFrequencyBinCount(): number {
    return this.analyserNode?.frequencyBinCount ?? 1024;
  }

  public getFftSize(): number {
    return this.analyserNode?.fftSize ?? 2048;
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  // Audio Device Selection
  public async setAudioOutputDevice(sinkId: string): Promise<boolean> {
    this.currentSinkId = sinkId;
    if (this.audioElement && (this.audioElement as any).setSinkId) {
      try {
        await (this.audioElement as any).setSinkId(sinkId);
        return true;
      } catch (err) {
        console.warn('Failed to setSinkId on audio element:', err);
        return false;
      }
    }
    return false;
  }

  public getCurrentSinkId(): string {
    return this.currentSinkId;
  }

  public getCurrentTrack(): TrackMetadata | null {
    return this.currentTrack;
  }

  public getDSPSettings(): DSPSettings {
    return { ...this.dspSettings };
  }
}

export const audioEngine = new AudioEngine();
