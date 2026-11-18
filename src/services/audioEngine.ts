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

export type TrackTransitionCallback = (nextTrack: TrackMetadata, type: 'gapless' | 'crossfade') => void;

/** Build a robust media URL: constant host + per-segment encoded path (drive colons, spaces, #, % are safe). */
export function buildMediaUrl(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/');
  const isUnc = norm.startsWith('//');
  const body = norm.replace(/^\/+/, '');
  const encoded = body.split('/').map(encodeURIComponent).join('/');
  return `harmoniq-media://local/${isUnc ? 'UNC/' : ''}${encoded}`;
}

interface AudioDeck {
  id: 'A' | 'B';
  element: HTMLAudioElement;
  sourceNode: MediaElementAudioSourceNode | null;
  faderGain: GainNode | null;
  replayGain: GainNode | null;
  currentTrack: TrackMetadata | null;
  currentUrl: string;
  isPreloaded: boolean;
}

class AudioEngine {
  private audioCtx: AudioContext | null = null;

  // Dual-Deck Architecture for True Gapless & Seamless Crossfade
  private deckA: AudioDeck | null = null;
  private deckB: AudioDeck | null = null;
  private activeDeck: AudioDeck | null = null;
  private standbyDeck: AudioDeck | null = null;

  // Master summing node before DSP chain
  private masterMixGain: GainNode | null = null;

  // Shared DSP Pipeline Nodes
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
  private crossfadeDuration = 0; // 0 = disabled (gapless playback); 1 - 12 seconds
  private isTransitioning = false;
  private transitionTimeout: any = null;
  private currentSinkId = '';
  private nextTrackQueued: TrackMetadata | null = null;

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

      // 1. Create Master Summing Mixer
      this.masterMixGain = this.audioCtx.createGain();
      this.masterMixGain.gain.value = 1.0;

      // 2. Initialize Dual Decks (A & B)
      this.deckA = this.createDeck('A');
      this.deckB = this.createDeck('B');
      this.activeDeck = this.deckA;
      this.standbyDeck = this.deckB;

      // Set initial fader gains: Deck A active (1.0), Deck B silent (0.0)
      if (this.deckA.faderGain) this.deckA.faderGain.gain.value = 1.0;
      if (this.deckB.faderGain) this.deckB.faderGain.gain.value = 0.0;

      // 3. Preamp Gain
      this.preampGainNode = this.audioCtx.createGain();
      this.preampGainNode.gain.value = 1.0;

      // 4. 10-Band Graphic EQ (Peaking filters)
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

      // 5. Bass Boost (Low-shelf filter @ 100Hz)
      this.bassBoostFilter = this.audioCtx.createBiquadFilter();
      this.bassBoostFilter.type = 'lowshelf';
      this.bassBoostFilter.frequency.value = 100;
      this.bassBoostFilter.gain.value = 0;

      // 6. Treble Control (High-shelf filter @ 10kHz)
      this.trebleFilter = this.audioCtx.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.value = 10000;
      this.trebleFilter.gain.value = 0;

      // 7. Mono downmix switch
      this.monoNode = this.audioCtx.createGain();
      this.monoNode.channelCountMode = 'explicit';
      this.monoNode.channelInterpretation = 'speakers';
      this.monoNode.channelCount = 2;

      // 8. Stereo Panner
      if (this.audioCtx.createStereoPanner) {
        this.pannerNode = this.audioCtx.createStereoPanner();
        this.pannerNode.pan.value = 0;
      }

      // 9. Anti-Clipping Brickwall Limiter (DynamicsCompressorNode)
      this.limiterNode = this.audioCtx.createDynamicsCompressor();
      this.limiterNode.threshold.value = -0.5; // Trigger just below 0 dBFS
      this.limiterNode.knee.value = 3.0;
      this.limiterNode.ratio.value = 20.0; // Brickwall ratio
      this.limiterNode.attack.value = 0.003; // Fast 3ms attack
      this.limiterNode.release.value = 0.1; // 100ms release

      // 10. High-Resolution FFT Analyser
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // 11. Bypass routing nodes
      this.dspActiveGain = this.audioCtx.createGain();
      this.dspBypassGain = this.audioCtx.createGain();

      // Connect DSP chain:
      // masterMixGain -> Preamp -> EQ[0]...EQ[9] -> BassBoost -> Treble -> Mono -> (Panner) -> Limiter -> dspActiveGain -> Analyser -> Destination
      this.masterMixGain.connect(this.preampGainNode);
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
      // masterMixGain -> dspBypassGain -> Analyser -> Destination
      this.masterMixGain.connect(this.dspBypassGain);
      this.dspBypassGain.connect(this.analyserNode);

      this.analyserNode.connect(this.audioCtx.destination);

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

    const element = new Audio();
    element.crossOrigin = 'anonymous';
    element.preload = 'auto';

    const sourceNode = this.audioCtx.createMediaElementSource(element);
    const faderGain = this.audioCtx.createGain();
    const replayGain = this.audioCtx.createGain();

    // Source -> Fader -> ReplayGain -> MasterMixGain
    sourceNode.connect(faderGain);
    faderGain.connect(replayGain);
    replayGain.connect(this.masterMixGain!);

    const deck: AudioDeck = {
      id,
      element,
      sourceNode,
      faderGain,
      replayGain,
      currentTrack: null,
      currentUrl: '',
      isPreloaded: false,
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
    if (!this.activeDeck || !this.standbyDeck || this.isTransitioning) return;

    const el = this.activeDeck.element;
    const currentTime = el.currentTime;
    const duration = el.duration;

    if (!Number.isFinite(duration) || duration <= 0) return;

    const remaining = duration - currentTime;

    // A. Crossfade transition trigger
    if (this.crossfadeDuration > 0 && this.standbyDeck.isPreloaded && this.standbyDeck.currentTrack) {
      // Ensure the track is long enough to crossfade safely
      const minTrackDuration = this.crossfadeDuration * 1.5;
      if (duration >= minTrackDuration && remaining <= this.crossfadeDuration) {
        this.startCrossfadeTransition(Math.max(1, remaining));
        return;
      }
    }

    // B. Gapless playback trigger (crossfade disabled: 0s)
    if (this.crossfadeDuration === 0 && this.standbyDeck.isPreloaded && this.standbyDeck.currentTrack) {
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
      incoming.faderGain.gain.cancelScheduledValues(now);
      incoming.faderGain.gain.setValueAtTime(1.0, now);
    }

    // 2. Start preloaded incoming deck with zero delay
    incoming.element.currentTime = 0;
    incoming.element.play().catch((err) => {
      console.warn('Gapless start error:', err);
    });

    // 3. Silence and stop outgoing deck
    outgoing.element.pause();
    if (outgoing.faderGain) {
      outgoing.faderGain.gain.cancelScheduledValues(now);
      outgoing.faderGain.gain.setValueAtTime(0.0, now);
    }

    // 4. Swap active and standby decks
    this.activeDeck = incoming;
    this.standbyDeck = outgoing;
    this.standbyDeck.isPreloaded = false;

    // 5. Notify listeners and UI of seamless gapless transition
    this.transitionListeners.forEach((cb) => cb(incomingTrack, 'gapless'));
    this.emitStatus();
  }

  /**
   * Execute smooth crossfade transition across active and standby decks
   */
  private startCrossfadeTransition(fadeSeconds: number): void {
    if (!this.activeDeck || !this.standbyDeck || !this.standbyDeck.currentTrack || !this.audioCtx) return;

    this.isTransitioning = true;
    const incomingTrack = this.standbyDeck.currentTrack;
    const outgoing = this.activeDeck;
    const incoming = this.standbyDeck;

    const now = this.audioCtx.currentTime;
    const duration = Math.min(this.crossfadeDuration, Math.max(1, fadeSeconds));

    // 1. Start incoming deck at zero gain
    if (incoming.faderGain) {
      incoming.faderGain.gain.cancelScheduledValues(now);
      incoming.faderGain.gain.setValueAtTime(0.0, now);
      // Linear ramp in
      incoming.faderGain.gain.linearRampToValueAtTime(1.0, now + duration);
    }

    incoming.element.currentTime = 0;
    incoming.element.play().catch((err) => {
      console.warn('Crossfade incoming deck play error:', err);
    });

    // 2. Ramp outgoing deck fader down to 0
    if (outgoing.faderGain) {
      outgoing.faderGain.gain.cancelScheduledValues(now);
      outgoing.faderGain.gain.setValueAtTime(outgoing.faderGain.gain.value, now);
      outgoing.faderGain.gain.linearRampToValueAtTime(0.0, now + duration);
    }

    // 3. Notify listeners that crossfade has begun so current track title & lyrics update in sync
    this.transitionListeners.forEach((cb) => cb(incomingTrack, 'crossfade'));

    // 4. Schedule complete handoff
    if (this.transitionTimeout) clearTimeout(this.transitionTimeout);
    this.transitionTimeout = setTimeout(() => {
      if (this.isTransitioning && this.activeDeck?.id === outgoing.id) {
        outgoing.element.pause();
        if (outgoing.faderGain) outgoing.faderGain.gain.setValueAtTime(0.0, this.audioCtx?.currentTime || 0);

        // Swap active and standby decks
        this.activeDeck = incoming;
        this.standbyDeck = outgoing;
        this.standbyDeck.isPreloaded = false;
        this.isTransitioning = false;
        this.emitStatus();
      }
    }, duration * 1000 + 50);
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
    const now = this.audioCtx.currentTime;

    if (this.activeDeck?.faderGain) {
      this.activeDeck.faderGain.gain.cancelScheduledValues(now);
      this.activeDeck.faderGain.gain.setValueAtTime(1.0, now);
    }

    if (this.standbyDeck) {
      this.standbyDeck.element.pause();
      if (this.standbyDeck.faderGain) {
        this.standbyDeck.faderGain.gain.cancelScheduledValues(now);
        this.standbyDeck.faderGain.gain.setValueAtTime(0.0, now);
      }
    }

    this.isTransitioning = false;
  }

  /**
   * Preload and prepare the next track on the standby deck before the current song ends
   */
  public prepareNextTrack(nextTrack: TrackMetadata | null): void {
    this.nextTrackQueued = nextTrack;
    if (!this.standbyDeck || !this.isInitialized) return;

    // If queue ends or no next track exists
    if (!nextTrack) {
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

    // Set initial fader gain: 1.0 for instant gapless handoff, 0.0 for crossfade ramp
    if (this.audioCtx && this.standbyDeck.faderGain) {
      const targetGain = this.crossfadeDuration > 0 ? 0.0 : 1.0;
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

    // Reset faders
    const now = this.audioCtx.currentTime;
    if (this.activeDeck.faderGain) {
      this.activeDeck.faderGain.gain.cancelScheduledValues(now);
      this.activeDeck.faderGain.gain.setValueAtTime(1.0, now);
    }
    if (this.standbyDeck.faderGain) {
      this.standbyDeck.faderGain.gain.cancelScheduledValues(now);
      this.standbyDeck.faderGain.gain.setValueAtTime(0.0, now);
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
    if (!this.activeDeck) return;
    this.activeDeck.element.pause();
    if (this.isTransitioning && this.standbyDeck) {
      this.standbyDeck.element.pause();
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
    deck.replayGain.gain.setTargetAtTime(linearGain, this.audioCtx.currentTime, 0.05);
  }

  public getActiveReplayGainInfo(): { mode: ReplayGainMode; gainDb: number; linearGain: number; isClippingPrevented: boolean } {
    const track = this.activeDeck?.currentTrack ?? null;
    const calc = this.calculateReplayGain(track);
    return {
      mode: this.replayGainMode,
      ...calc,
    };
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

    // 1. Preamp gain
    this.applyPreamp();

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
      this.dspActiveGain.gain.setTargetAtTime(1.0, now, 0.03);
      this.dspBypassGain.gain.setTargetAtTime(0.0, now, 0.03);
    } else {
      this.dspActiveGain.gain.setTargetAtTime(0.0, now, 0.03);
      this.dspBypassGain.gain.setTargetAtTime(1.0, now, 0.03);
    }
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
    let ok = false;

    if (this.deckA?.element && (this.deckA.element as any).setSinkId) {
      try {
        await (this.deckA.element as any).setSinkId(sinkId);
        ok = true;
      } catch (err) {
        console.warn('Failed to setSinkId on deckA:', err);
      }
    }

    if (this.deckB?.element && (this.deckB.element as any).setSinkId) {
      try {
        await (this.deckB.element as any).setSinkId(sinkId);
        ok = true;
      } catch (err) {
        console.warn('Failed to setSinkId on deckB:', err);
      }
    }

    return ok;
  }

  public getCurrentSinkId(): string {
    return this.currentSinkId;
  }

  public getCurrentTrack(): TrackMetadata | null {
    return this.activeDeck?.currentTrack ?? null;
  }

  public getDSPSettings(): DSPSettings {
    return { ...this.dspSettings };
  }
}

export const audioEngine = new AudioEngine();
