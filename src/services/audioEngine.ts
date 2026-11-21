import {
  DSPSettings,
  EQ_FREQUENCIES,
  DEFAULT_PARAMETRIC_FILTERS,
  LimiterMetrics,
  ChannelMode,
  ABRepeatState,
  BitPerfectState,
} from '../types/dsp';
import { TrackMetadata, ReplayGainMode } from '../types/audio';
import { AudioDeviceInfo } from '../types/devices';
import { AudioParameterAutomation, AUTOMATION_TIME_CONSTANTS } from './audio/audioParameterAutomation';
import { StereoWidthProcessor } from './audio/stereoWidthProcessor';

export type PlaybackStatusCallback = (status: {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isEnded: boolean;
  trackId: string | null;
}) => void;

export type PlaybackErrorCallback = (message: string, track: TrackMetadata | null) => void;

export type TransitionMode = 'crossfade' | 'gapless' | 'fade_out_fade_in';

export type TrackTransitionCallback = (
  nextTrack: TrackMetadata,
  type: 'gapless' | 'crossfade' | 'fade_out_fade_in'
) => void;

/**
 * Build a robust media URL:
 * - Validated external HTTP/HTTPS streams are returned directly without local path corruption.
 * - Local files use the custom protocol: constant host + per-segment encoded path (drive colons, spaces, #, % are safe).
 */
export function buildMediaUrl(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') return '';
  const trimmed = filePath.trim();

  // Safely support validated external HTTP and HTTPS streams
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.href;
      }
    } catch {
      // Invalid URL format, fall through to path handling or error
    }
  }

  // Reject unauthorized/insecure schemes (prevent arbitrary code execution / file leak)
  if (/^(javascript|data|blob|file|ftp):/i.test(trimmed)) {
    throw new Error(`Unsupported audio URI scheme: ${trimmed.slice(0, 30)}`);
  }

  const norm = trimmed.replace(/\\/g, '/');
  const isUnc = norm.startsWith('//');
  const body = norm.replace(/^\/+/, '');
  const encoded = body.split('/').map(encodeURIComponent).join('/');
  return `harmoniq-media://local/${isUnc ? 'UNC/' : ''}${encoded}`;
}

interface AudioDeck {
  id: 'A' | 'B';
  element: HTMLAudioElement;
  sourceNode: MediaElementAudioSourceNode | null;
  replayGain: GainNode | null;
  preampGain: GainNode | null;
  eqFilters: BiquadFilterNode[]; // 10 ISO standard graphic EQ bands
  parametricFilters: BiquadFilterNode[]; // up to 12 parametric filters
  bassBoostFilter: BiquadFilterNode | null;
  trebleFilter: BiquadFilterNode | null;
  faderGain: GainNode | null;
  currentTrack: TrackMetadata | null;
  currentUrl: string;
  isPreloaded: boolean;
  deckDspSettings: DSPSettings | null;
}

class AudioEngine {
  private audioCtx: AudioContext | null = null;

  // Dual-Deck Architecture with Independent Per-Deck EQ Processing
  private deckA: AudioDeck | null = null;
  private deckB: AudioDeck | null = null;
  private activeDeck: AudioDeck | null = null;
  private standbyDeck: AudioDeck | null = null;

  // Master summing node before master DSP chain
  private masterMixGain: GainNode | null = null;

  private maxParametricNodes = 12;

  // Getters delegating to active deck's independent EQ stage
  private get eqFilters(): BiquadFilterNode[] {
    return this.activeDeck?.eqFilters || this.deckA?.eqFilters || [];
  }
  private get parametricFilterNodes(): BiquadFilterNode[] {
    return this.activeDeck?.parametricFilters || this.deckA?.parametricFilters || [];
  }
  private get preampGainNode(): GainNode | null {
    return this.activeDeck?.preampGain || this.deckA?.preampGain || null;
  }
  private get bassBoostFilter(): BiquadFilterNode | null {
    return this.activeDeck?.bassBoostFilter || this.deckA?.bassBoostFilter || null;
  }
  private get trebleFilter(): BiquadFilterNode | null {
    return this.activeDeck?.trebleFilter || this.deckA?.trebleFilter || null;
  }

  private monoNode: GainNode | null = null;
  private pannerNode: StereoPannerNode | null = null;

  // 2x2 Channel Matrix Nodes (Stereo, Mono, Left-Only, Right-Only, Balance)
  private channelSplitter: ChannelSplitterNode | null = null;
  private channelMerger: ChannelMergerNode | null = null;
  private gainLL: GainNode | null = null;
  private gainLR: GainNode | null = null;
  private gainRL: GainNode | null = null;
  private gainRR: GainNode | null = null;

  private limiterNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private dspBypassGain: GainNode | null = null;
  private dspActiveGain: GainNode | null = null;
  private subBandFreqBuffer: Uint8Array | null = null;

  // Mid-Side Stereo Width Processor
  private stereoWidthProcessor: StereoWidthProcessor | null = null;

  // Track EQ resolver registered from DSPContext
  private trackEQResolver: ((track: TrackMetadata) => DSPSettings | null) | null = null;

  // State
  private isInitialized = false;
  private statusListeners: Set<PlaybackStatusCallback> = new Set();
  private errorListeners: Set<PlaybackErrorCallback> = new Set();
  private transitionListeners: Set<TrackTransitionCallback> = new Set();
  private initPromise: Promise<void> | null = null;
  private loadToken = 0;
  private volume = 0.85;
  private muted = false;
  private playbackRate = 1;
  private preservesPitch = true;
  private dspSettings: DSPSettings = {
    enabled: true,
    eqMode: 'graphic',
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    parametricFilters: [...DEFAULT_PARAMETRIC_FILTERS],
    preamp: 0,
    bassBoost: 0,
    treble: 0,
    balance: 0,
    monoMix: false,
    channelMode: 'stereo',
    limiterEnabled: true,
    activePresetId: 'flat',
    stereoWidth: 100,
    stereoWidthEnabled: false,
  };
  private replayGainMode: ReplayGainMode = 'off';
  private crossfadeDuration = 0; // 0 = disabled (gapless playback); 1 - 12 seconds
  private transitionMode: TransitionMode = 'crossfade';
  private isTransitioning = false;
  private transitionTimeout: any = null;
  private currentSinkId = '';
  private nextTrackQueued: TrackMetadata | null = null;

  // A-B Repeat State & Listeners
  private abRepeat: ABRepeatState = {
    enabled: false,
    pointA: null,
    pointB: null,
  };
  private abRepeatListeners: Set<(state: ABRepeatState) => void> = new Set();

  // Bit-Perfect Mode State
  private bitPerfectRequested = false;

  // Device Change Listeners
  private deviceChangeListeners: Set<(activeDeviceId: string, devices: AudioDeviceInfo[]) => void> = new Set();

  constructor() {
    // Lazily initialized on first user interaction to comply with browser audio policies
  }

  public initialize(): Promise<void> {
    if (this.isInitialized && this.audioCtx && this.audioCtx.state !== 'closed') {
      return Promise.resolve();
    }
    if (!this.initPromise) {
      this.initPromise = this.doInitialize();
    }
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      const AudioContextClass =
        (typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null) ||
        (globalThis as any).AudioContext;
      if (!AudioContextClass) {
        console.warn('AudioContext not available in current environment');
        return;
      }
      const ctx: AudioContext = new AudioContextClass({
        latencyHint: 'interactive',
      });
      this.audioCtx = ctx;

      // 1. Create Master Summing Mixer
      this.masterMixGain = ctx.createGain();
      this.masterMixGain.gain.value = 1.0;

      // 2. Initialize Dual Decks (A & B)
      this.deckA = this.createDeck('A');
      this.deckB = this.createDeck('B');
      this.activeDeck = this.deckA;
      this.standbyDeck = this.deckB;

      // Set initial fader gains: Deck A active (1.0), Deck B silent (0.0)
      if (this.deckA.faderGain) this.deckA.faderGain.gain.value = 1.0;
      if (this.deckB.faderGain) this.deckB.faderGain.gain.value = 0.0;

      // 3. 2x2 Channel Matrix (Stereo, Mono Downmix, Left-Only, Right-Only, Stereo Balance)
      this.channelSplitter = ctx.createChannelSplitter(2);
      this.gainLL = ctx.createGain();
      this.gainLR = ctx.createGain();
      this.gainRL = ctx.createGain();
      this.gainRR = ctx.createGain();
      this.channelMerger = ctx.createChannelMerger(2);

      // Connect 2x2 matrix:
      // Left in (0) -> LL (to Left out) and LR (to Right out)
      this.channelSplitter.connect(this.gainLL, 0);
      this.channelSplitter.connect(this.gainLR, 0);
      // Right in (1) -> RL (to Left out) and RR (to Right out)
      this.channelSplitter.connect(this.gainRL, 1);
      this.channelSplitter.connect(this.gainRR, 1);

      // Connect to output merger
      this.gainLL.connect(this.channelMerger, 0, 0);
      this.gainRL.connect(this.channelMerger, 0, 0);
      this.gainLR.connect(this.channelMerger, 0, 1);
      this.gainRR.connect(this.channelMerger, 0, 1);

      // Legacy fallback nodes
      this.monoNode = ctx.createGain();
      if (ctx.createStereoPanner) {
        this.pannerNode = ctx.createStereoPanner();
      }

      // 4. Anti-Clipping Brickwall Limiter (DynamicsCompressorNode)
      this.limiterNode = ctx.createDynamicsCompressor();
      this.limiterNode.threshold.value = -0.5; // Trigger just below 0 dBFS
      this.limiterNode.knee.value = 3.0;
      this.limiterNode.ratio.value = 20.0; // Brickwall ratio
      this.limiterNode.attack.value = 0.003; // Fast 3ms attack
      this.limiterNode.release.value = 0.1; // 100ms release

      // 5. High-Resolution FFT Analyser
      this.analyserNode = ctx.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // 6. Mid-Side Stereo Width Processor
      this.stereoWidthProcessor = new StereoWidthProcessor(ctx);

      // 7. Bypass routing nodes
      this.dspActiveGain = ctx.createGain();
      this.dspBypassGain = ctx.createGain();

      // Master DSP chain:
      // masterMixGain -> StereoWidth -> ChannelMatrix -> Limiter -> dspActiveGain -> Analyser -> Destination
      this.masterMixGain.connect(this.stereoWidthProcessor.getInputNode());
      this.stereoWidthProcessor.getOutputNode().connect(this.channelSplitter);
      this.channelMerger.connect(this.limiterNode);

      this.limiterNode.connect(this.dspActiveGain);
      this.dspActiveGain.connect(this.analyserNode);

      // Bypass path:
      // masterMixGain -> dspBypassGain -> Analyser -> Destination
      this.masterMixGain.connect(this.dspBypassGain);
      this.dspBypassGain.connect(this.analyserNode);

      this.analyserNode.connect(ctx.destination);

      // Setup dynamic device change listener
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
        navigator.mediaDevices.addEventListener('devicechange', async () => {
          const devices = await this.getAvailableOutputDevices();
          if (this.currentSinkId && this.currentSinkId !== 'default' && this.currentSinkId !== '') {
            const exists = devices.some((d) => d.deviceId === this.currentSinkId);
            if (!exists) {
              console.warn(`[AudioEngine] Active device ${this.currentSinkId} was disconnected. Falling back to default.`);
              await this.setAudioOutputDevice('default');
              this.deviceChangeListeners.forEach((cb) => cb('default', devices));
              return;
            }
          }
          this.deviceChangeListeners.forEach((cb) => cb(this.currentSinkId || 'default', devices));
        });
      }

      // Apply initial configurations
      this.applyVolumeToBothDecks();
      this.applyDSPSettings(this.dspSettings);
      if (this.currentSinkId) {
        this.setAudioOutputDevice(this.currentSinkId).catch(() => {});
      }

      this.isInitialized = true;
    } catch (err) {
      console.error('Failed to initialize AudioEngine:', err);
      this.initPromise = null;
    }
  }

  private createDeck(id: 'A' | 'B'): AudioDeck {
    if (!this.audioCtx) throw new Error('AudioContext missing');
    const ctx = this.audioCtx;

    const AudioConstructor =
      (typeof Audio !== 'undefined' ? Audio : null) ||
      (typeof window !== 'undefined' ? (window as any).Audio : null) ||
      (globalThis as any).Audio;
    const element = AudioConstructor ? new AudioConstructor() : ({} as any);
    element.crossOrigin = 'anonymous';
    element.preload = 'auto';

    const sourceNode = ctx.createMediaElementSource(element);
    const replayGain = ctx.createGain();
    const preampGain = ctx.createGain();
    preampGain.gain.value = 1.0;

    // Independent 10-Band Graphic EQ for this deck
    const eqFilters = EQ_FREQUENCIES.map((freq) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.414; // Standard 1-octave bandwidth
      filter.gain.value = 0;
      return filter;
    });
    for (let i = 0; i < eqFilters.length - 1; i++) {
      eqFilters[i].connect(eqFilters[i + 1]);
    }

    // Independent 12-Band Parametric Filter Nodes Chain for this deck
    const parametricFilters: BiquadFilterNode[] = [];
    for (let i = 0; i < this.maxParametricNodes; i++) {
      const pFilter = ctx.createBiquadFilter();
      pFilter.type = 'peaking';
      pFilter.frequency.value = 1000;
      pFilter.Q.value = 1.0;
      pFilter.gain.value = 0;
      parametricFilters.push(pFilter);
    }
    for (let i = 0; i < parametricFilters.length - 1; i++) {
      parametricFilters[i].connect(parametricFilters[i + 1]);
    }

    // Independent Tone Controls for this deck
    const bassBoostFilter = ctx.createBiquadFilter();
    bassBoostFilter.type = 'lowshelf';
    bassBoostFilter.frequency.value = 100;
    bassBoostFilter.gain.value = 0;

    const trebleFilter = ctx.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 10000;
    trebleFilter.gain.value = 0;

    const faderGain = ctx.createGain();

    // Connect Deck signal path:
    // sourceNode -> replayGain -> preampGain -> eqFilters[0..9] -> parametricFilters[0..11] -> bassBoostFilter -> trebleFilter -> faderGain -> masterMixGain
    sourceNode.connect(replayGain);
    replayGain.connect(preampGain);
    preampGain.connect(eqFilters[0]);
    eqFilters[eqFilters.length - 1].connect(parametricFilters[0]);
    parametricFilters[parametricFilters.length - 1].connect(bassBoostFilter);
    bassBoostFilter.connect(trebleFilter);
    trebleFilter.connect(faderGain);
    faderGain.connect(this.masterMixGain!);

    const deck: AudioDeck = {
      id,
      element,
      sourceNode,
      replayGain,
      preampGain,
      eqFilters,
      parametricFilters,
      bassBoostFilter,
      trebleFilter,
      faderGain,
      currentTrack: null,
      currentUrl: '',
      isPreloaded: false,
      deckDspSettings: null,
    };

    this.setupDeckListeners(deck);
    return deck;
  }

  private setupDeckListeners(deck: AudioDeck): void {
    const el = deck.element;

    el.addEventListener('timeupdate', () => {
      if (this.activeDeck?.id === deck.id) {
        this.handleTimeUpdate();
        this.emitStatus();
      }
    });

    el.addEventListener('play', () => {
      if (this.activeDeck?.id === deck.id) {
        this.emitStatus();
      }
    });

    el.addEventListener('pause', () => {
      if (this.activeDeck?.id === deck.id && !this.isTransitioning) {
        this.emitStatus();
      }
    });

    el.addEventListener('ended', () => {
      if (this.activeDeck?.id === deck.id) {
        this.handleActiveDeckEnded();
      }
    });

    el.addEventListener('loadedmetadata', () => {
      if (this.activeDeck?.id === deck.id) {
        this.emitStatus();
      }
    });

    el.addEventListener('durationchange', () => {
      if (this.activeDeck?.id === deck.id) {
        this.emitStatus();
      }
    });

    el.addEventListener('playing', () => {
      if (this.activeDeck?.id === deck.id) {
        this.emitStatus();
      }
    });

    el.addEventListener('error', () => {
      const err = el.error;
      if (!err || err.code === 1) return; // Ignore user-initiated aborts
      const message = err.code === 4 ? 'Unsupported or missing audio file' : err.message || 'Playback error';
      this.errorListeners.forEach((cb) => cb(message, deck.currentTrack));
    });
  }

  /**
   * Monitor playback position on active deck to trigger Gapless or Crossfade transitions seamlessly
   */
  private handleTimeUpdate(): void {
    if (!this.activeDeck) return;

    const el = this.activeDeck.element;
    const currentTime = el.currentTime;
    const duration = el.duration;

    // A-B Repeat Loop Check
    if (this.abRepeat.enabled && this.abRepeat.pointA !== null && this.abRepeat.pointB !== null) {
      if (currentTime >= this.abRepeat.pointB) {
        el.currentTime = this.abRepeat.pointA;
        this.emitStatus();
        return; // Prevent crossfade or gapless handoff during active A-B loop!
      }
    }

    if (!this.standbyDeck || this.isTransitioning) return;
    if (!Number.isFinite(duration) || duration <= 0) return;

    const remaining = duration - currentTime;

    // A. Crossfade / Fade-out-fade-in transition trigger
    if (this.transitionMode !== 'gapless' && this.crossfadeDuration > 0 && this.standbyDeck.isPreloaded && this.standbyDeck.currentTrack) {
      // Ensure the track is long enough to crossfade safely
      const minTrackDuration = this.crossfadeDuration * 1.5;
      if (duration >= minTrackDuration && remaining <= this.crossfadeDuration) {
        if (this.transitionMode === 'fade_out_fade_in') {
          this.startFadeOutFadeInTransition(Math.max(1, remaining));
        } else {
          this.startCrossfadeTransition(Math.max(1, remaining));
        }
        return;
      }
    }

    // B. Gapless playback trigger (gapless mode or crossfade disabled: 0s)
    if ((this.transitionMode === 'gapless' || this.crossfadeDuration === 0) && this.standbyDeck.isPreloaded && this.standbyDeck.currentTrack) {
      // Trigger gapless handoff 60ms before completion to eliminate decoder initialization latency
      if (remaining <= 0.06) {
        this.executeGaplessTransition();
      }
    }
  }

  /**
   * Called when active track natural audio playback ends
   */
  private handleActiveDeckEnded(): void {
    if (this.isTransitioning) return;

    // If gapless standby track was ready, swap immediately
    if (this.standbyDeck?.isPreloaded && this.standbyDeck.currentTrack) {
      this.executeGaplessTransition();
    } else {
      // No next track preloaded: standard queue completion
      this.emitStatus(true);
    }
  }

  /**
   * Execute instantaneous gapless transition between outgoing and preloaded incoming deck
   */
  private executeGaplessTransition(): void {
    if (!this.activeDeck || !this.standbyDeck || !this.standbyDeck.currentTrack || !this.audioCtx) return;

    const incomingTrack = this.standbyDeck.currentTrack;
    const outgoing = this.activeDeck;
    const incoming = this.standbyDeck;

    const now = this.audioCtx.currentTime;

    // 1. Ensure incoming deck fader is at unity gain
    if (incoming.faderGain) {
      AudioParameterAutomation.safeSetValue(incoming.faderGain.gain, 1.0, this.audioCtx);
    }

    // 2. Start preloaded incoming deck with zero delay
    incoming.element.currentTime = 0;
    incoming.element.play().catch((err) => {
      console.warn('Gapless start error:', err);
    });

    // 3. Silence and stop outgoing deck
    outgoing.element.pause();
    if (outgoing.faderGain) {
      AudioParameterAutomation.safeSetValue(outgoing.faderGain.gain, 0.0, this.audioCtx);
    }

    // 4. Swap active and standby decks
    this.activeDeck = incoming;
    this.standbyDeck = outgoing;
    this.standbyDeck.isPreloaded = false;
    if (incoming.deckDspSettings) {
      this.dspSettings = { ...incoming.deckDspSettings };
    }

    // 5. Notify listeners and UI of seamless gapless transition
    this.transitionListeners.forEach((cb) => cb(incomingTrack, 'gapless'));
    this.emitStatus();
  }

  /**
   * Execute smooth crossfade transition across active and standby decks
   * Uses equal-power sine/cosine automation curves to avoid the 3dB dip
   */
  private startCrossfadeTransition(fadeSeconds: number): void {
    if (!this.activeDeck || !this.standbyDeck || !this.standbyDeck.currentTrack || !this.audioCtx) return;

    this.isTransitioning = true;
    const incomingTrack = this.standbyDeck.currentTrack;
    const outgoing = this.activeDeck;
    const incoming = this.standbyDeck;

    const duration = Math.min(this.crossfadeDuration, Math.max(1, fadeSeconds));

    // 1. Equal-Power Fade-in on incoming deck (0 -> 1 via sin curve)
    if (incoming.faderGain) {
      AudioParameterAutomation.safeSetValue(incoming.faderGain.gain, 0.0, this.audioCtx);
      AudioParameterAutomation.equalPowerFade(incoming.faderGain.gain, 'in', duration, this.audioCtx);
    }

    incoming.element.currentTime = 0;
    incoming.element.play().catch((err) => {
      console.warn('Crossfade incoming deck play error:', err);
    });

    // 2. Equal-Power Fade-out on outgoing deck (1 -> 0 via cos curve)
    if (outgoing.faderGain) {
      AudioParameterAutomation.equalPowerFade(outgoing.faderGain.gain, 'out', duration, this.audioCtx);
    }

    // 3. Notify listeners that crossfade has begun so current track title & lyrics update in sync
    this.transitionListeners.forEach((cb) => cb(incomingTrack, 'crossfade'));

    // 4. Schedule complete handoff
    if (this.transitionTimeout) clearTimeout(this.transitionTimeout);
    this.transitionTimeout = setTimeout(() => {
      if (this.isTransitioning && this.activeDeck?.id === outgoing.id) {
        outgoing.element.pause();
        if (outgoing.faderGain) {
          AudioParameterAutomation.safeSetValue(outgoing.faderGain.gain, 0.0, this.audioCtx);
        }

        // Swap active and standby decks
        this.activeDeck = incoming;
        this.standbyDeck = outgoing;
        this.standbyDeck.isPreloaded = false;
        this.isTransitioning = false;
        if (incoming.deckDspSettings) {
          this.dspSettings = { ...incoming.deckDspSettings };
        }
        this.emitStatus();
      }
    }, duration * 1000 + 50);
  }

  /**
   * Execute clean fade-out then fade-in transition across active and standby decks
   * Ensures distinct silence separation between tracks rather than simultaneous overlap
   */
  private startFadeOutFadeInTransition(fadeSeconds: number): void {
    if (!this.activeDeck || !this.standbyDeck || !this.standbyDeck.currentTrack || !this.audioCtx) return;

    this.isTransitioning = true;
    const incomingTrack = this.standbyDeck.currentTrack;
    const outgoing = this.activeDeck;
    const incoming = this.standbyDeck;

    const totalDuration = Math.min(this.crossfadeDuration, Math.max(1, fadeSeconds));
    const halfDuration = Math.max(0.25, totalDuration / 2);

    // 1. Fade outgoing deck completely down to 0
    if (outgoing.faderGain) {
      AudioParameterAutomation.linearRamp(outgoing.faderGain.gain, 0.0, halfDuration, this.audioCtx);
    }

    // 2. Ensure incoming deck is silent initially
    if (incoming.faderGain) {
      AudioParameterAutomation.safeSetValue(incoming.faderGain.gain, 0.0, this.audioCtx);
    }

    if (this.transitionTimeout) clearTimeout(this.transitionTimeout);

    // 3. Once outgoing has faded, pause outgoing, start incoming, and fade it in
    this.transitionTimeout = setTimeout(() => {
      if (!this.isTransitioning || this.activeDeck?.id !== outgoing.id) return;

      outgoing.element.pause();
      if (outgoing.faderGain) {
        AudioParameterAutomation.safeSetValue(outgoing.faderGain.gain, 0.0, this.audioCtx);
      }

      incoming.element.currentTime = 0;
      incoming.element.play().catch((err) => {
        console.warn('FadeOutFadeIn incoming deck play error:', err);
      });

      if (incoming.faderGain) {
        AudioParameterAutomation.linearRamp(incoming.faderGain.gain, 1.0, halfDuration, this.audioCtx);
      }

      // Notify listeners of the transition
      this.transitionListeners.forEach((cb) => cb(incomingTrack, 'fade_out_fade_in'));

      // 4. Complete handoff once incoming has finished fading in
      this.transitionTimeout = setTimeout(() => {
        if (this.isTransitioning && this.activeDeck?.id === outgoing.id) {
          this.activeDeck = incoming;
          this.standbyDeck = outgoing;
          this.standbyDeck.isPreloaded = false;
          this.isTransitioning = false;
          if (incoming.deckDspSettings) {
            this.dspSettings = { ...incoming.deckDspSettings };
          }
          this.emitStatus();
        }
      }, halfDuration * 1000 + 50);
    }, halfDuration * 1000 + 30);
  }

  /**
   * Cancel any in-flight crossfade ramp immediately (e.g. on manual skip, seek, or queue purge)
   */
  private cancelCrossfade(): void {
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
      this.transitionTimeout = null;
    }

    if (!this.audioCtx) return;

    if (this.activeDeck?.faderGain) {
      AudioParameterAutomation.safeSetValue(this.activeDeck.faderGain.gain, 1.0, this.audioCtx);
    }

    if (this.standbyDeck) {
      this.standbyDeck.element.pause();
      if (this.standbyDeck.faderGain) {
        AudioParameterAutomation.safeSetValue(this.standbyDeck.faderGain.gain, 0.0, this.audioCtx);
      }
    }

    this.isTransitioning = false;
  }

  /**
   * Preload and prepare the next track on the standby deck before the current song ends
   */
  public prepareNextTrack(nextTrack: TrackMetadata | null, nextTrackDspSettings?: DSPSettings): void {
    this.nextTrackQueued = nextTrack;
    if (!this.standbyDeck || !this.isInitialized) return;

    // If queue ends or no next track exists
    if (!nextTrack) {
      if (this.isTransitioning) {
        this.cancelCrossfade();
      }
      this.standbyDeck.currentTrack = null;
      this.standbyDeck.currentUrl = '';
      this.standbyDeck.element.src = '';
      this.standbyDeck.isPreloaded = false;
      return;
    }

    const mediaUrl = buildMediaUrl(nextTrack.filePath);

    // If standby deck is already buffered with this exact track, do not re-request
    if (this.standbyDeck.currentUrl === mediaUrl && this.standbyDeck.isPreloaded) {
      return;
    }

    this.standbyDeck.currentTrack = nextTrack;
    this.standbyDeck.currentUrl = mediaUrl;
    this.standbyDeck.element.src = mediaUrl;
    this.standbyDeck.element.preload = 'auto';
    this.standbyDeck.element.volume = this.volume;
    this.standbyDeck.element.muted = this.muted;
    this.standbyDeck.element.playbackRate = nextTrack.customPlaybackSpeed || this.playbackRate;
    (this.standbyDeck.element as any).preservesPitch = this.preservesPitch;

    // Apply pre-calculated ReplayGain to standby deck
    this.applyReplayGainToDeck(this.standbyDeck, nextTrack);

    // Apply track-specific EQ to standby deck
    if (nextTrackDspSettings) {
      this.applyDSPSettingsToDeck(this.standbyDeck, nextTrackDspSettings);
    } else if (this.trackEQResolver) {
      const resolved = this.trackEQResolver(nextTrack);
      if (resolved) {
        this.applyDSPSettingsToDeck(this.standbyDeck, resolved);
      } else {
        this.applyDSPSettingsToDeck(this.standbyDeck, this.dspSettings);
      }
    } else {
      this.applyDSPSettingsToDeck(this.standbyDeck, this.dspSettings);
    }

    // Set initial fader gain: 1.0 for instant gapless handoff, 0.0 for crossfade ramp
    if (this.audioCtx && this.standbyDeck.faderGain) {
      const targetGain =
        this.transitionMode !== 'gapless' && this.crossfadeDuration > 0 ? 0.0 : 1.0;
      this.standbyDeck.faderGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.standbyDeck.faderGain.gain.setValueAtTime(targetGain, this.audioCtx.currentTime);
    }

    this.standbyDeck.element.load();
    this.standbyDeck.isPreloaded = true;
  }

  // Subscriptions
  public subscribeStatus(callback: PlaybackStatusCallback): () => void {
    this.statusListeners.add(callback);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public subscribeError(callback: PlaybackErrorCallback): () => void {
    this.errorListeners.add(callback);
    return () => {
      this.errorListeners.delete(callback);
    };
  }

  public subscribeTrackTransition(callback: TrackTransitionCallback): () => void {
    this.transitionListeners.add(callback);
    return () => {
      this.transitionListeners.delete(callback);
    };
  }

  private emitStatus(isEnded = false): void {
    if (!this.activeDeck) return;
    const el = this.activeDeck.element;
    const track = this.activeDeck.currentTrack;

    const status = {
      currentTime: el.currentTime,
      duration: Number.isFinite(el.duration) && el.duration > 0 ? el.duration : (track?.duration ?? 0),
      isPlaying: !el.paused && !el.ended,
      isEnded,
      trackId: track?.id ?? null,
    };
    this.statusListeners.forEach((cb) => cb(status));
  }

  public isPlaying(): boolean {
    if (!this.activeDeck) return false;
    const el = this.activeDeck.element;
    return !el.paused && !el.ended;
  }

  // Playback Control
  public async loadAndPlay(track: TrackMetadata, startTime = 0): Promise<void> {
    const token = ++this.loadToken;
    await this.initialize();
    if (!this.audioCtx || !this.activeDeck || !this.standbyDeck) return;

    if (this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
        /* resumed on next user gesture */
      }
    }
    if (token !== this.loadToken) return;

    // If crossfade was active, cancel it immediately
    if (this.isTransitioning) {
      this.cancelCrossfade();
    }

    // Reset A-B repeat interval when loading a different track
    if (this.activeDeck.currentTrack?.id !== track.id) {
      this.clearABRepeat();
    }

    // Check if the requested track is already preloaded on the standby deck and start point is 0
    if (this.standbyDeck.currentTrack?.id === track.id && this.standbyDeck.isPreloaded && startTime === 0) {
      this.executeGaplessTransition();
      return;
    }

    // Load on active deck
    this.activeDeck.currentTrack = track;
    const mediaUrl = buildMediaUrl(track.filePath);
    if (this.activeDeck.currentUrl !== mediaUrl) {
      this.activeDeck.currentUrl = mediaUrl;
      this.activeDeck.element.src = mediaUrl;
    }

    this.applyReplayGainToDeck(this.activeDeck, track);

    // Apply track-specific EQ to active deck
    if (this.trackEQResolver) {
      const resolved = this.trackEQResolver(track);
      if (resolved) {
        this.applyDSPSettingsToDeck(this.activeDeck, resolved);
        this.dspSettings = { ...resolved };
      } else {
        this.applyDSPSettingsToDeck(this.activeDeck, this.dspSettings);
      }
    } else {
      this.applyDSPSettingsToDeck(this.activeDeck, this.dspSettings);
    }

    // Reset faders
    if (this.activeDeck.faderGain) {
      AudioParameterAutomation.safeSetValue(this.activeDeck.faderGain.gain, 1.0, this.audioCtx);
    }
    if (this.standbyDeck.faderGain) {
      AudioParameterAutomation.safeSetValue(this.standbyDeck.faderGain.gain, 0.0, this.audioCtx);
    }
    this.standbyDeck.element.pause();

    this.activeDeck.element.playbackRate = track.customPlaybackSpeed || this.playbackRate;
    (this.activeDeck.element as any).preservesPitch = this.preservesPitch;

    try {
      this.activeDeck.element.currentTime = startTime;
    } catch {
      /* metadata not ready; start from 0 */
    }

    try {
      await this.activeDeck.element.play();
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.warn('Playback failed:', err);
    }

    if (token === this.loadToken) this.emitStatus();
  }

  public async play(): Promise<void> {
    await this.initialize();
    if (!this.audioCtx || !this.activeDeck) return;

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    try {
      await this.activeDeck.element.play();
      if (this.isTransitioning && this.standbyDeck) {
        await this.standbyDeck.element.play();
      }
    } catch (e) {
      console.warn('Play error:', e);
    }
    this.emitStatus();
  }

  public pause(): void {
    if (this.activeDeck) {
      this.activeDeck.element.pause();
      if (this.isTransitioning) {
        this.cancelCrossfade();
      }
    }
    // Suspend AudioContext to release hardware audio thread and reduce idle CPU to zero
    if (this.audioCtx && this.audioCtx.state === 'running' && typeof this.audioCtx.suspend === 'function') {
      this.audioCtx.suspend().catch(() => {});
    }
    this.emitStatus();
  }

  public stop(): void {
    if (this.activeDeck) {
      this.activeDeck.element.pause();
      this.activeDeck.element.currentTime = 0;
      if (this.isTransitioning) {
        this.cancelCrossfade();
      } else if (this.standbyDeck) {
        this.standbyDeck.element.pause();
        this.standbyDeck.element.currentTime = 0;
      }
    }
    // Suspend AudioContext to release hardware audio thread and reduce idle CPU to zero
    if (this.audioCtx && this.audioCtx.state === 'running' && typeof this.audioCtx.suspend === 'function') {
      this.audioCtx.suspend().catch(() => {});
    }
    this.emitStatus();
  }

  public seek(seconds: number): void {
    if (!this.activeDeck) return;

    // Seeking cancels any active crossfade ramp
    if (this.isTransitioning) {
      this.cancelCrossfade();
    }

    const dur = this.activeDeck.element.duration;
    const max = Number.isFinite(dur) && dur > 0 ? dur : Infinity;
    this.activeDeck.element.currentTime = Math.max(0, Math.min(seconds, max));

    if (this.isPlaying() && this.audioCtx && this.audioCtx.state === 'suspended' && typeof this.audioCtx.resume === 'function') {
      this.audioCtx.resume().catch(() => {});
    }

    this.emitStatus();
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyVolumeToBothDecks();
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMute(mute: boolean): void {
    this.muted = mute;
    this.applyVolumeToBothDecks();
  }

  private applyVolumeToBothDecks(): void {
    if (this.deckA) {
      this.deckA.element.volume = this.volume;
      this.deckA.element.muted = this.muted;
    }
    if (this.deckB) {
      this.deckB.element.volume = this.volume;
      this.deckB.element.muted = this.muted;
    }
  }

  public setPlaybackRate(rate: number, preservesPitch = true): void {
    this.playbackRate = Math.max(0.5, Math.min(3.0, rate));
    this.preservesPitch = preservesPitch;

    if (this.deckA) {
      this.deckA.element.playbackRate = this.playbackRate;
      (this.deckA.element as any).preservesPitch = preservesPitch;
    }
    if (this.deckB) {
      this.deckB.element.playbackRate = this.playbackRate;
      (this.deckB.element as any).preservesPitch = preservesPitch;
    }
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  public setCrossfadeDuration(seconds: number): void {
    // 0 = disabled (gapless playback); 1 - 12 seconds
    this.crossfadeDuration = Math.max(0, Math.min(12, Math.round(seconds)));
  }

  public getCrossfadeDuration(): number {
    return this.crossfadeDuration;
  }

  public isCrossfading(): boolean {
    return this.isTransitioning;
  }

  public setTransitionMode(mode: TransitionMode): void {
    this.transitionMode = mode;
  }

  public getTransitionMode(): TransitionMode {
    return this.transitionMode;
  }

  public setReplayGainMode(mode: ReplayGainMode): void {
    this.replayGainMode = mode;
    if (this.deckA && this.deckA.currentTrack) {
      this.applyReplayGainToDeck(this.deckA, this.deckA.currentTrack);
    }
    if (this.deckB && this.deckB.currentTrack) {
      this.applyReplayGainToDeck(this.deckB, this.deckB.currentTrack);
    }
  }

  public getReplayGainMode(): ReplayGainMode {
    return this.replayGainMode;
  }

  /**
   * ReplayGain calculation with safe headroom and brickwall peak protection
   */
  public calculateReplayGain(track: TrackMetadata | null): { linearGain: number; gainDb: number; isClippingPrevented: boolean } {
    if (!track || this.replayGainMode === 'off' || !track.replayGain) {
      return { linearGain: 1.0, gainDb: 0, isClippingPrevented: false };
    }

    let gainDb = 0;
    let peak = 0;
    const rg = track.replayGain;

    if (this.replayGainMode === 'track') {
      gainDb = Number.isFinite(rg.trackGain) ? (rg.trackGain as number) : 0;
      peak = Number.isFinite(rg.trackPeak) ? (rg.trackPeak as number) : 0;
    } else if (this.replayGainMode === 'album') {
      // Prefer album gain; fall back to track gain if missing in album mode
      if (Number.isFinite(rg.albumGain)) {
        gainDb = rg.albumGain as number;
        peak = Number.isFinite(rg.albumPeak) ? (rg.albumPeak as number) : 0;
      } else if (Number.isFinite(rg.trackGain)) {
        gainDb = rg.trackGain as number;
        peak = Number.isFinite(rg.trackPeak) ? (rg.trackPeak as number) : 0;
      }
    }

    let linear = Math.pow(10, gainDb / 20);
    let isClippingPrevented = false;

    // Peak protection: prevent scaling over 0.988 (-0.1 dBFS) to guarantee no inter-sample clipping
    if (peak > 0 && linear * peak > 0.988) {
      linear = 0.988 / peak;
      isClippingPrevented = true;
    }

    // Safety limits: max +12 dB (approx 3.98x), min -30 dB (approx 0.03x)
    linear = Math.max(0.03, Math.min(3.98, linear));

    return { linearGain: linear, gainDb, isClippingPrevented };
  }

  private applyReplayGainToDeck(deck: AudioDeck, track: TrackMetadata | null): void {
    if (!deck.replayGain || !this.audioCtx) return;
    const { linearGain } = this.calculateReplayGain(track);
    AudioParameterAutomation.smoothTransition(
      deck.replayGain.gain,
      linearGain,
      this.audioCtx,
      { timeConstant: AUTOMATION_TIME_CONSTANTS.REPLAY_GAIN, min: 0.01, max: 4.0 }
    );
  }

  public getActiveReplayGainInfo(): { mode: ReplayGainMode; gainDb: number; linearGain: number; isClippingPrevented: boolean } {
    const track = this.activeDeck?.currentTrack ?? null;
    const calc = this.calculateReplayGain(track);
    return {
      mode: this.replayGainMode,
      ...calc,
    };
  }

  private applyPreamp(deck: AudioDeck | null = this.activeDeck): void {
    if (!deck?.preampGain || !this.audioCtx) return;
    const preampDb = deck.deckDspSettings?.preamp ?? this.dspSettings.preamp ?? 0;
    const linear = Math.pow(10, preampDb / 20);
    AudioParameterAutomation.smoothTransition(
      deck.preampGain.gain,
      linear,
      this.audioCtx,
      { timeConstant: AUTOMATION_TIME_CONSTANTS.PREAMP, min: 0.0, max: 4.0 }
    );
  }

  /**
   * Apply DSP settings (Preamp, 10-band Graphic EQ, Parametric Filters, Tone Controls)
   * to a specific deck independently, allowing genuine dual-deck independent EQ during crossfade.
   */
  public applyDSPSettingsToDeck(deck: AudioDeck | null, settings: DSPSettings): void {
    if (!deck || !this.audioCtx) return;
    deck.deckDspSettings = { ...settings };

    // 1. Deck Preamp
    if (deck.preampGain) {
      const preampDb = settings.enabled ? (settings.preamp ?? 0) : 0;
      const linear = Math.pow(10, preampDb / 20);
      AudioParameterAutomation.smoothTransition(
        deck.preampGain.gain,
        linear,
        this.audioCtx,
        { timeConstant: AUTOMATION_TIME_CONSTANTS.PREAMP, min: 0.0, max: 4.0 }
      );
    }

    // 2. EQ Filters
    if (!settings.enabled) {
      // Flat unity when DSP disabled
      deck.eqFilters.forEach((filter) => {
        AudioParameterAutomation.smoothTransition(filter.gain, 0, this.audioCtx, {
          timeConstant: AUTOMATION_TIME_CONSTANTS.EQ_BAND,
          min: -12,
          max: 12,
        });
      });
      deck.parametricFilters.forEach((node) => {
        AudioParameterAutomation.smoothTransition(node.gain, 0, this.audioCtx, {
          timeConstant: AUTOMATION_TIME_CONSTANTS.EQ_BAND,
          min: -18,
          max: 18,
        });
      });
      if (deck.bassBoostFilter) {
        AudioParameterAutomation.smoothTransition(deck.bassBoostFilter.gain, 0, this.audioCtx, {
          timeConstant: AUTOMATION_TIME_CONSTANTS.TONE_SHELF,
          min: 0,
          max: 12,
        });
      }
      if (deck.trebleFilter) {
        AudioParameterAutomation.smoothTransition(deck.trebleFilter.gain, 0, this.audioCtx, {
          timeConstant: AUTOMATION_TIME_CONSTANTS.TONE_SHELF,
          min: -6,
          max: 12,
        });
      }
      return;
    }

    if (settings.eqMode === 'graphic') {
      // 2a. 10-Band Graphic EQ Active
      deck.eqFilters.forEach((filter, index) => {
        const gainValue = settings.bands[index] ?? 0;
        AudioParameterAutomation.smoothTransition(
          filter.gain,
          gainValue,
          this.audioCtx,
          { timeConstant: AUTOMATION_TIME_CONSTANTS.EQ_BAND, min: -12, max: 12 }
        );
      });

      // Parametric nodes set to transparent unity (0 dB gain)
      deck.parametricFilters.forEach((node) => {
        node.type = 'peaking';
        AudioParameterAutomation.smoothTransition(
          node.gain,
          0,
          this.audioCtx,
          { timeConstant: AUTOMATION_TIME_CONSTANTS.EQ_BAND, min: -18, max: 18 }
        );
      });
    } else {
      // 2b. Parametric Mode Active: 10-band graphic filters set to 0 dB unity
      deck.eqFilters.forEach((filter) => {
        AudioParameterAutomation.smoothTransition(
          filter.gain,
          0,
          this.audioCtx,
          { timeConstant: AUTOMATION_TIME_CONSTANTS.EQ_BAND, min: -12, max: 12 }
        );
      });

      // Parametric filters configured
      const configs = settings.parametricFilters || [];
      for (let i = 0; i < this.maxParametricNodes; i++) {
        const node = deck.parametricFilters[i];
        if (!node) continue;
        const cfg = configs[i];
        if (cfg && cfg.enabled) {
          node.type = cfg.type;
          AudioParameterAutomation.smoothTransition(
            node.frequency,
            cfg.frequency,
            this.audioCtx,
            { timeConstant: AUTOMATION_TIME_CONSTANTS.EQ_BAND, min: 20, max: 20000 }
          );
          AudioParameterAutomation.smoothTransition(
            node.Q,
            cfg.q,
            this.audioCtx,
            { timeConstant: AUTOMATION_TIME_CONSTANTS.EQ_BAND, min: 0.1, max: 18 }
          );
          AudioParameterAutomation.smoothTransition(
            node.gain,
            cfg.gain,
            this.audioCtx,
            { timeConstant: AUTOMATION_TIME_CONSTANTS.EQ_BAND, min: -18, max: 18 }
          );
        } else {
          // Bypassed/idle node
          node.type = 'peaking';
          AudioParameterAutomation.smoothTransition(
            node.gain,
            0,
            this.audioCtx,
            { timeConstant: AUTOMATION_TIME_CONSTANTS.EQ_BAND, min: -18, max: 18 }
          );
        }
      }
    }

    // 3. Bass Boost
    if (deck.bassBoostFilter) {
      AudioParameterAutomation.smoothTransition(
        deck.bassBoostFilter.gain,
        settings.bassBoost ?? 0,
        this.audioCtx,
        { timeConstant: AUTOMATION_TIME_CONSTANTS.TONE_SHELF, min: 0, max: 12 }
      );
    }

    // 4. Treble Boost
    if (deck.trebleFilter) {
      AudioParameterAutomation.smoothTransition(
        deck.trebleFilter.gain,
        settings.treble ?? 0,
        this.audioCtx,
        { timeConstant: AUTOMATION_TIME_CONSTANTS.TONE_SHELF, min: -6, max: 12 }
      );
    }
  }

  /**
   * Apply Master DSP Stages (Stereo Width, Channel Matrix, Limiter, Bypass routing)
   */
  public applyMasterDSPStages(settings: DSPSettings): void {
    if (!this.audioCtx) return;

    // 5. Mid-Side Stereo Width Processing
    if (this.stereoWidthProcessor) {
      this.stereoWidthProcessor.setWidth(settings.stereoWidth ?? 100);
      this.stereoWidthProcessor.setEnabled(settings.stereoWidthEnabled ?? false);
    }

    // 6. Channel Routing Matrix & Stereo Balance (Stereo, Mono, Left-Only, Right-Only, Balance)
    if (this.gainLL && this.gainLR && this.gainRL && this.gainRR) {
      let baseLL = 1.0, baseLR = 0.0, baseRL = 0.0, baseRR = 1.0;
      const mode = settings.channelMode || (settings.monoMix ? 'mono' : 'stereo');

      if (mode === 'mono') {
        baseLL = 0.5; baseLR = 0.5; baseRL = 0.5; baseRR = 0.5;
      } else if (mode === 'left_only') {
        baseLL = 1.0; baseLR = 1.0; baseRL = 0.0; baseRR = 0.0;
      } else if (mode === 'right_only') {
        baseLL = 0.0; baseLR = 0.0; baseRL = 1.0; baseRR = 1.0;
      }

      // Balance adjustment: -1.0 (Left) to +1.0 (Right)
      const bal = Math.max(-1.0, Math.min(1.0, settings.balance ?? 0));
      const multL = bal <= 0 ? 1.0 : Math.max(0, 1.0 - bal);
      const multR = bal >= 0 ? 1.0 : Math.max(0, 1.0 + bal);

      const tc = AUTOMATION_TIME_CONSTANTS.FAST;
      AudioParameterAutomation.smoothTransition(this.gainLL.gain, baseLL * multL, this.audioCtx, { timeConstant: tc, min: 0, max: 1.0 });
      AudioParameterAutomation.smoothTransition(this.gainRL.gain, baseRL * multL, this.audioCtx, { timeConstant: tc, min: 0, max: 1.0 });
      AudioParameterAutomation.smoothTransition(this.gainLR.gain, baseLR * multR, this.audioCtx, { timeConstant: tc, min: 0, max: 1.0 });
      AudioParameterAutomation.smoothTransition(this.gainRR.gain, baseRR * multR, this.audioCtx, { timeConstant: tc, min: 0, max: 1.0 });
    }

    // Legacy fallback nodes
    if (this.pannerNode) {
      AudioParameterAutomation.smoothTransition(
        this.pannerNode.pan,
        settings.balance ?? 0,
        this.audioCtx,
        { timeConstant: AUTOMATION_TIME_CONSTANTS.FAST, min: -1, max: 1 }
      );
    }
    if (this.monoNode) {
      this.monoNode.channelCount = settings.monoMix ? 1 : 2;
    }

    // 7. Limiter (transparent when disabled)
    if (this.limiterNode) {
      const tc = AUTOMATION_TIME_CONSTANTS.FAST;
      if (settings.limiterEnabled) {
        AudioParameterAutomation.smoothTransition(this.limiterNode.threshold, -0.5, this.audioCtx, { timeConstant: tc });
        AudioParameterAutomation.smoothTransition(this.limiterNode.knee, 3.0, this.audioCtx, { timeConstant: tc });
        AudioParameterAutomation.smoothTransition(this.limiterNode.ratio, 20.0, this.audioCtx, { timeConstant: tc });
      } else {
        AudioParameterAutomation.smoothTransition(this.limiterNode.threshold, 0, this.audioCtx, { timeConstant: tc });
        AudioParameterAutomation.smoothTransition(this.limiterNode.knee, 0, this.audioCtx, { timeConstant: tc });
        AudioParameterAutomation.smoothTransition(this.limiterNode.ratio, 1.0, this.audioCtx, { timeConstant: tc });
      }
    }

    // 8. Master Bypass
    this.updateBypassState();
  }

  // Real-time DSP Controls
  public applyDSPSettings(settings: DSPSettings): void {
    this.dspSettings = { ...settings };
    if (!this.audioCtx) return;

    // Apply to active deck with smooth transitions
    if (this.activeDeck) {
      this.applyDSPSettingsToDeck(this.activeDeck, settings);
    }

    // Apply master stages: Stereo Width, Channel Matrix, Limiter, Bypass gains
    this.applyMasterDSPStages(settings);
  }

  public registerTrackEQResolver(resolver: ((track: TrackMetadata) => DSPSettings | null) | null): void {
    this.trackEQResolver = resolver;
  }

  public setStandbyDeckDSPSettings(settings: DSPSettings): void {
    if (this.standbyDeck) {
      this.applyDSPSettingsToDeck(this.standbyDeck, settings);
    }
  }

  public setDeckDSPSettings(deckId: 'A' | 'B', settings: DSPSettings): void {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    if (deck) {
      this.applyDSPSettingsToDeck(deck, settings);
    }
  }

  public getDeckDSPSettings(deckId: 'A' | 'B'): DSPSettings | null {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    return deck?.deckDspSettings || null;
  }

  public getDeck(deckId: 'A' | 'B'): AudioDeck | null {
    return deckId === 'A' ? this.deckA : this.deckB;
  }

  private updateBypassState(): void {
    if (!this.dspActiveGain || !this.dspBypassGain || !this.audioCtx) return;

    const activeTarget = this.dspSettings.enabled ? 1.0 : 0.0;
    const bypassTarget = this.dspSettings.enabled ? 0.0 : 1.0;
    const tc = AUTOMATION_TIME_CONSTANTS.BYPASS_SWITCH;

    AudioParameterAutomation.smoothTransition(this.dspActiveGain.gain, activeTarget, this.audioCtx, { timeConstant: tc });
    AudioParameterAutomation.smoothTransition(this.dspBypassGain.gain, bypassTarget, this.audioCtx, { timeConstant: tc });
  }

  // Limiter Metrics & Anti-Clipping Reporting
  public getLimiterMetrics(): LimiterMetrics {
    if (!this.limiterNode) {
      return { isClippingPrevented: false, gainReductionDb: 0, peakLevel: 0 };
    }

    const reduction = this.limiterNode.reduction || 0;
    return {
      isClippingPrevented: reduction < -0.1,
      gainReductionDb: Math.abs(reduction),
      peakLevel: reduction,
    };
  }

  // Real-time FFT Frequency Data for Visualizer
  public getFrequencyData(array: any): void {
    if (!this.isPlaying()) {
      if (array && typeof array.fill === 'function') {
        array.fill(0);
      }
      return;
    }
    if (this.analyserNode) {
      this.analyserNode.getByteFrequencyData(array);
    }
  }

  // Real-time Oscillogram Time-Domain Data for Waveform Visualizer
  public getTimeDomainData(array: any): void {
    if (!this.isPlaying()) {
      if (array && typeof array.fill === 'function') {
        array.fill(128);
      }
      return;
    }
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

  /**
   * Computes the combined frequency response curve across the full audible spectrum (20Hz - 20kHz).
   * Queries actual BiquadFilterNodes using Web Audio API getFrequencyResponse.
   */
  public getCombinedFrequencyResponse(frequencies: Float32Array): Float32Array {
    const len = frequencies.length;
    const magResponse = new Float32Array(len).fill(1.0);
    const phaseResponse = new Float32Array(len);

    const tempMag = new Float32Array(len);
    const tempPhase = new Float32Array(len);

    const preampLinear = Math.pow(10, this.dspSettings.preamp / 20);

    if (!this.dspSettings.enabled) {
      // Flat 0 dB response when bypassed
      return new Float32Array(len).fill(0);
    }

    if (this.dspSettings.eqMode === 'graphic') {
      // 10-band Graphic EQ response
      this.eqFilters.forEach((filter) => {
        filter.getFrequencyResponse(frequencies as any, tempMag as any, tempPhase as any);
        for (let i = 0; i < len; i++) {
          magResponse[i] *= tempMag[i];
        }
      });
    } else {
      // Parametric EQ response
      const configs = this.dspSettings.parametricFilters || [];
      configs.forEach((cfg, idx) => {
        if (!cfg.enabled) return;
        const node = this.parametricFilterNodes[idx];
        if (node) {
          node.getFrequencyResponse(frequencies as any, tempMag as any, tempPhase as any);
          for (let i = 0; i < len; i++) {
            magResponse[i] *= tempMag[i];
          }
        }
      });
    }

    // Tone controls: Bass Boost & Treble
    if (this.bassBoostFilter) {
      this.bassBoostFilter.getFrequencyResponse(frequencies as any, tempMag as any, tempPhase as any);
      for (let i = 0; i < len; i++) {
        magResponse[i] *= tempMag[i];
      }
    }
    if (this.trebleFilter) {
      this.trebleFilter.getFrequencyResponse(frequencies as any, tempMag as any, tempPhase as any);
      for (let i = 0; i < len; i++) {
        magResponse[i] *= tempMag[i];
      }
    }

    // Convert linear composite gain to dB with preamp
    const dbResponse = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const linear = magResponse[i] * preampLinear;
      dbResponse[i] = 20 * Math.log10(Math.max(1e-5, linear));
    }

    return dbResponse;
  }

  /**
   * Calculates real-time energy across standard 7 audio frequency bands:
   * Sub-bass (20-60Hz), Bass (60-250Hz), Low-mid (250-500Hz), Mid (500-2kHz),
   * Upper-mid (2-4kHz), Presence (4-6kHz), Brilliance (6-20kHz)
   */
  public getSubBandEnergies(): {
    subBass: number;
    bass: number;
    lowMid: number;
    mid: number;
    upperMid: number;
    presence: number;
    brilliance: number;
  } {
    if (!this.analyserNode || !this.isPlaying()) {
      return { subBass: 0, bass: 0, lowMid: 0, mid: 0, upperMid: 0, presence: 0, brilliance: 0 };
    }

    const binCount = this.analyserNode.frequencyBinCount;
    if (!this.subBandFreqBuffer || this.subBandFreqBuffer.length !== binCount) {
      this.subBandFreqBuffer = new Uint8Array(binCount);
    }
    const freqData = this.subBandFreqBuffer;
    this.analyserNode.getByteFrequencyData(freqData as any);

    const sampleRate = this.audioCtx?.sampleRate || 44100;
    const nyquist = sampleRate / 2;
    const hzPerBin = nyquist / binCount;

    const getAverageEnergyInRange = (lowHz: number, highHz: number): number => {
      const startBin = Math.max(0, Math.floor(lowHz / hzPerBin));
      const endBin = Math.min(binCount - 1, Math.ceil(highHz / hzPerBin));
      if (startBin > endBin) return 0;

      let sum = 0;
      let count = 0;
      for (let i = startBin; i <= endBin; i++) {
        sum += freqData[i];
        count++;
      }
      return count > 0 ? (sum / count) / 255 : 0;
    };

    return {
      subBass: getAverageEnergyInRange(20, 60),
      bass: getAverageEnergyInRange(60, 250),
      lowMid: getAverageEnergyInRange(250, 500),
      mid: getAverageEnergyInRange(500, 2000),
      upperMid: getAverageEnergyInRange(2000, 4000),
      presence: getAverageEnergyInRange(4000, 6000),
      brilliance: getAverageEnergyInRange(6000, 20000),
    };
  }

  // Audio Device Manager & Output Routing
  public async setOutputDevice(sinkId: string): Promise<boolean> {
    return this.setAudioOutputDevice(sinkId);
  }

  public async setAudioOutputDevice(sinkId: string): Promise<boolean> {
    this.currentSinkId = sinkId;
    let ok = false;

    // 1. Try to set on Web Audio AudioContext (Chromium AudioContext.setSinkId)
    if (this.audioCtx && (this.audioCtx as any).setSinkId) {
      try {
        await (this.audioCtx as any).setSinkId(sinkId === 'default' ? '' : sinkId);
        ok = true;
      } catch (err) {
        console.warn('Failed to setSinkId on audioCtx:', err);
      }
    }

    // 2. Set on HTML5 media elements for both decks
    if (this.deckA?.element && (this.deckA.element as any).setSinkId) {
      try {
        await (this.deckA.element as any).setSinkId(sinkId === 'default' ? '' : sinkId);
        ok = true;
      } catch (err) {
        console.warn('Failed to setSinkId on deckA:', err);
      }
    }

    if (this.deckB?.element && (this.deckB.element as any).setSinkId) {
      try {
        await (this.deckB.element as any).setSinkId(sinkId === 'default' ? '' : sinkId);
        ok = true;
      } catch (err) {
        console.warn('Failed to setSinkId on deckB:', err);
      }
    }

    try {
      localStorage.setItem('harmoniq_preferred_audio_device', sinkId);
    } catch {}

    return ok;
  }

  public async getAvailableOutputDevices(): Promise<AudioDeviceInfo[]> {
    const devices: AudioDeviceInfo[] = [];

    // Enumerate via Web MediaDevices API
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        const outputs = mediaDevices.filter((d) => d.kind === 'audiooutput');

        outputs.forEach((d, idx) => {
          const isDefault = d.deviceId === 'default' || (!d.deviceId && idx === 0);
          devices.push({
            deviceId: d.deviceId || (isDefault ? 'default' : `device_${idx}`),
            label: d.label || (isDefault ? 'Default Windows Audio Endpoint' : `Audio Endpoint ${idx + 1}`),
            groupId: d.groupId || '',
            isDefault,
            sampleRate: this.audioCtx?.sampleRate || 48000,
            channels: 2,
            bitDepth: 24,
          });
        });
      } catch (e) {
        console.warn('Failed to enumerate media devices:', e);
      }
    }

    // Provide default endpoint if enumeration was restricted or empty
    if (devices.length === 0) {
      devices.push({
        deviceId: 'default',
        label: 'Default Windows Audio Endpoint',
        groupId: 'default-group',
        isDefault: true,
        sampleRate: this.audioCtx?.sampleRate || 48000,
        channels: 2,
        bitDepth: 24,
      });
    }

    return devices;
  }

  public subscribeDeviceChange(cb: (activeDeviceId: string, devices: AudioDeviceInfo[]) => void): () => void {
    this.deviceChangeListeners.add(cb);
    this.getAvailableOutputDevices().then((devs) => {
      cb(this.currentSinkId || 'default', devs);
    });
    return () => this.deviceChangeListeners.delete(cb);
  }

  public getCurrentSinkId(): string {
    return this.currentSinkId || 'default';
  }

  // A-B Repeat Controller
  public getABRepeat(): ABRepeatState {
    return { ...this.abRepeat };
  }

  public setABRepeatPointA(time?: number): void {
    const curTime = time !== undefined ? time : (this.activeDeck?.element.currentTime || 0);
    this.abRepeat.pointA = Math.max(0, curTime);

    if (this.abRepeat.pointB !== null && this.abRepeat.pointB <= this.abRepeat.pointA) {
      this.abRepeat.pointB = null;
    }

    if (this.abRepeat.pointA !== null && this.abRepeat.pointB !== null) {
      this.abRepeat.enabled = true;
    }
    this.emitABRepeat();
  }

  public setABRepeatPointB(time?: number): void {
    const curTime = time !== undefined ? time : (this.activeDeck?.element.currentTime || 0);
    if (this.abRepeat.pointA === null) {
      this.abRepeat.pointA = 0;
    }

    if (curTime <= this.abRepeat.pointA) {
      this.abRepeat.pointB = this.abRepeat.pointA + 1.0;
    } else {
      this.abRepeat.pointB = curTime;
    }

    this.abRepeat.enabled = true;
    this.emitABRepeat();
  }

  public toggleABRepeat(enabled?: boolean): void {
    if (enabled !== undefined) {
      this.abRepeat.enabled = enabled;
    } else {
      this.abRepeat.enabled = !this.abRepeat.enabled;
    }
    this.emitABRepeat();
  }

  public clearABRepeat(): void {
    this.abRepeat = {
      enabled: false,
      pointA: null,
      pointB: null,
    };
    this.emitABRepeat();
  }

  public setABPoints(a: number | null, b: number | null, enabled = true): void {
    this.abRepeat = {
      enabled,
      pointA: a !== null ? Math.max(0, a) : null,
      pointB: b !== null ? Math.max(0, b) : null,
    };
    this.emitABRepeat();
  }

  public subscribeABRepeat(cb: (state: ABRepeatState) => void): () => void {
    this.abRepeatListeners.add(cb);
    cb(this.getABRepeat());
    return () => this.abRepeatListeners.delete(cb);
  }

  private emitABRepeat(): void {
    const copy = this.getABRepeat();
    this.abRepeatListeners.forEach((cb) => cb(copy));
  }

  // Bit-Perfect Playback Mode
  public setBitPerfectMode(requested: boolean): void {
    this.bitPerfectRequested = requested;
  }

  public isBitPerfectRequested(): boolean {
    return this.bitPerfectRequested;
  }

  public getBitPerfectStatus(): BitPerfectState {
    const track = this.getCurrentTrack();
    const outputRate = this.audioCtx?.sampleRate || 48000;
    const sourceRate = track?.sampleRate || outputRate;
    const isLossless = !!track?.isLossless;
    const rateMatches = sourceRate === outputRate;
    const unityVolume = Math.abs(this.volume - 1.0) < 0.001 && !this.muted;
    const dspBypassed =
      !this.dspSettings.enabled ||
      (this.dspSettings.bands.every((b) => Math.abs(b) < 0.05) &&
        Math.abs(this.dspSettings.preamp) < 0.05 &&
        Math.abs(this.dspSettings.bassBoost) < 0.05 &&
        Math.abs(this.dspSettings.treble) < 0.05 &&
        Math.abs(this.dspSettings.balance) < 0.01 &&
        this.dspSettings.channelMode === 'stereo' &&
        (!this.dspSettings.stereoWidthEnabled || Math.abs((this.dspSettings.stereoWidth ?? 100) - 100) < 0.1));
    const replayGainOff = this.replayGainMode === 'off';
    const crossfadeOff = this.crossfadeDuration === 0;

    const disabledFeatures: string[] = [];
    if (!dspBypassed) disabledFeatures.push('Equalizer / Tone Controls');
    if (!replayGainOff) disabledFeatures.push('ReplayGain Normalization');
    if (!crossfadeOff) disabledFeatures.push('Crossfade');
    if (!unityVolume) disabledFeatures.push('Digital Volume Attenuation');

    if (!this.bitPerfectRequested) {
      return {
        enabled: false,
        active: false,
        status: 'disabled',
        reason: 'Bit-Perfect mode is not engaged',
        sourceSampleRate: sourceRate,
        outputSampleRate: outputRate,
        isLossless,
        disabledFeatures,
      };
    }

    if (!isLossless) {
      return {
        enabled: true,
        active: false,
        status: 'impaired',
        reason: 'Source audio is lossy (compressed). True bit-perfection requires lossless PCM/FLAC source.',
        sourceSampleRate: sourceRate,
        outputSampleRate: outputRate,
        isLossless,
        disabledFeatures,
      };
    }

    if (!rateMatches) {
      return {
        enabled: true,
        active: false,
        status: 'resampled',
        reason: `Sample rate mismatch: source is ${(sourceRate / 1000).toFixed(1)} kHz but hardware output is ${(outputRate / 1000).toFixed(1)} kHz. Resampling is performed by Windows Audio Engine.`,
        sourceSampleRate: sourceRate,
        outputSampleRate: outputRate,
        isLossless,
        disabledFeatures,
      };
    }

    if (!unityVolume || !dspBypassed || !replayGainOff) {
      return {
        enabled: true,
        active: false,
        status: 'impaired',
        reason: 'Processing active: DSP, Volume, or ReplayGain is altering bitstream.',
        sourceSampleRate: sourceRate,
        outputSampleRate: outputRate,
        isLossless,
        disabledFeatures,
      };
    }

    return {
      enabled: true,
      active: true,
      status: 'active',
      reason: 'Bit-transparent audio path active. Original bitstream preserved with 0 dB unity gain.',
      sourceSampleRate: sourceRate,
      outputSampleRate: outputRate,
      isLossless: true,
      disabledFeatures: [],
    };
  }

  // Channel Mode & Balance Controls
  public setChannelMode(mode: ChannelMode): void {
    this.dspSettings.channelMode = mode;
    this.dspSettings.monoMix = mode === 'mono';
    this.applyDSPSettings(this.dspSettings);
  }

  public setBalance(balance: number): void {
    this.dspSettings.balance = Math.max(-1.0, Math.min(1.0, balance));
    this.applyDSPSettings(this.dspSettings);
  }

  public getCurrentTrack(): TrackMetadata | null {
    return this.activeDeck?.currentTrack ?? null;
  }

  public getDSPSettings(): DSPSettings {
    return { ...this.dspSettings };
  }

  public getStereoWidthProcessor(): StereoWidthProcessor | null {
    return this.stereoWidthProcessor;
  }

  public setStereoWidth(widthPercent: number): void {
    this.dspSettings.stereoWidth = Math.max(0, Math.min(150, widthPercent));
    if (this.stereoWidthProcessor) {
      this.stereoWidthProcessor.setWidth(this.dspSettings.stereoWidth);
    }
  }

  public setStereoWidthEnabled(enabled: boolean): void {
    this.dspSettings.stereoWidthEnabled = !!enabled;
    if (this.stereoWidthProcessor) {
      this.stereoWidthProcessor.setEnabled(this.dspSettings.stereoWidthEnabled);
    }
  }

  /**
   * Complete playback engine shutdown & resource disposal
   */
  public async shutdown(): Promise<void> {
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
      this.transitionTimeout = null;
    }
    this.isTransitioning = false;

    // Stop and pause audio elements
    if (this.deckA) {
      try {
        this.deckA.element.pause();
        this.deckA.element.src = '';
      } catch {}
    }
    if (this.deckB) {
      try {
        this.deckB.element.pause();
        this.deckB.element.src = '';
      } catch {}
    }

    // Clean up stereo width processor
    if (this.stereoWidthProcessor) {
      this.stereoWidthProcessor.dispose();
      this.stereoWidthProcessor = null;
    }

    // Disconnect DSP nodes
    try {
      this.masterMixGain?.disconnect();
      this.preampGainNode?.disconnect();
      this.eqFilters.forEach((f) => f.disconnect());
      this.parametricFilterNodes.forEach((p) => p.disconnect());
      this.bassBoostFilter?.disconnect();
      this.trebleFilter?.disconnect();
      this.channelSplitter?.disconnect();
      this.gainLL?.disconnect();
      this.gainRL?.disconnect();
      this.gainLR?.disconnect();
      this.gainRR?.disconnect();
      this.channelMerger?.disconnect();
      this.limiterNode?.disconnect();
      this.dspActiveGain?.disconnect();
      this.dspBypassGain?.disconnect();
      this.analyserNode?.disconnect();
      if (this.deckA) {
        this.deckA.sourceNode?.disconnect();
        this.deckA.replayGain?.disconnect();
        this.deckA.preampGain?.disconnect();
        this.deckA.eqFilters.forEach((f) => f.disconnect());
        this.deckA.parametricFilters.forEach((p) => p.disconnect());
        this.deckA.bassBoostFilter?.disconnect();
        this.deckA.trebleFilter?.disconnect();
        this.deckA.faderGain?.disconnect();
      }
      if (this.deckB) {
        this.deckB.sourceNode?.disconnect();
        this.deckB.replayGain?.disconnect();
        this.deckB.preampGain?.disconnect();
        this.deckB.eqFilters.forEach((f) => f.disconnect());
        this.deckB.parametricFilters.forEach((p) => p.disconnect());
        this.deckB.bassBoostFilter?.disconnect();
        this.deckB.trebleFilter?.disconnect();
        this.deckB.faderGain?.disconnect();
      }
    } catch {}

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        await this.audioCtx.close();
      } catch {}
    }

    this.audioCtx = null;
    this.isInitialized = false;
    this.initPromise = null;
  }

  public dispose(): Promise<void> {
    return this.shutdown();
  }
}

export const audioEngine = new AudioEngine();
