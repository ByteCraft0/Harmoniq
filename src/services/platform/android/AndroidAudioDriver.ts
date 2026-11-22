import { IAudioDriver } from '../IAudioDriver';
import {
  PlaybackState,
  PlaybackStateListener,
  TrackEndedListener,
  MediaCommandListener,
  PlaybackErrorListener,
  EqualizerParameters,
  NativeSleepTimerStatus,
  SleepTimerExpiredListener,
} from '../types';
import { TrackMetadata, RepeatMode } from '../../../types/audio';
import { getGlobalContext } from '../index';

export class AndroidAudioDriver implements IAudioDriver {
  private queue: TrackMetadata[] = [];
  private currentTrack: TrackMetadata | null = null;
  private stateListeners = new Set<PlaybackStateListener>();
  private trackEndedListeners = new Set<TrackEndedListener>();
  private mediaCommandListeners = new Set<MediaCommandListener>();
  private errorListeners = new Set<PlaybackErrorListener>();
  private sleepTimerExpiredListeners = new Set<SleepTimerExpiredListener>();
  private listenersAttached = false;

  private currentState: PlaybackState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    trackId: null,
    currentTrack: null,
    volume: 1.0,
    isMuted: false,
    playbackRate: 1.0,
    isShuffle: false,
    repeatMode: 'off',
  };

  constructor() {
    this.initNativeListeners();
    this.getPlaybackSnapshot().catch(() => {});
  }

  private getCapacitor(): any {
    return getGlobalContext().Capacitor;
  }

  private initNativeListeners(): void {
    if (this.listenersAttached) return;
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer) {
      this.listenersAttached = true;
      try {
        cap.Plugins.HarmoniqAudioPlayer.addListener('playbackStateChange', (data: any) => {
          if (!data) return;
          this.currentState.isPlaying = !!data.isPlaying;
          if (typeof data.currentTime === 'number') {
            this.currentState.currentTime = data.currentTime;
          }
          if (typeof data.duration === 'number' && data.duration > 0) {
            this.currentState.duration = data.duration;
          }
          if (data.trackId) {
            this.currentState.trackId = data.trackId;
          }
          if (data.track) {
            this.currentTrack = data.track;
            this.currentState.currentTrack = data.track;
          }
          if (Array.isArray(data.queue) && data.queue.length > 0) {
            this.queue = data.queue;
            this.currentState.queue = data.queue;
          }
          if (typeof data.currentQueueIndex === 'number') {
            this.currentState.currentQueueIndex = data.currentQueueIndex;
          }
          if (typeof data.volume === 'number') {
            this.currentState.volume = data.volume;
            this.currentState.isMuted = data.volume === 0;
          }
          if (typeof data.isShuffle === 'boolean') {
            this.currentState.isShuffle = data.isShuffle;
          }
          if (data.repeatMode) {
            this.currentState.repeatMode = data.repeatMode;
          }
          if (typeof data.isLive === 'boolean') {
            this.currentState.isLive = data.isLive;
          }
          if (typeof data.isBuffering === 'boolean') {
            this.currentState.isBuffering = data.isBuffering;
          }
          this.notifyState();
        });

        cap.Plugins.HarmoniqAudioPlayer.addListener('metadataChanged', (data: any) => {
          if (!data) return;
          if (this.currentTrack && (data.title || data.artist)) {
            const updated = {
              ...this.currentTrack,
              title: data.title || this.currentTrack.title,
              artist: data.artist || this.currentTrack.artist,
            };
            this.currentTrack = updated;
            this.currentState.currentTrack = updated;
            this.notifyState();
          }
        });

        cap.Plugins.HarmoniqAudioPlayer.addListener('trackEnded', () => {
          this.trackEndedListeners.forEach((cb) => cb());
        });

        cap.Plugins.HarmoniqAudioPlayer.addListener('sleepTimerExpired', () => {
          this.sleepTimerExpiredListeners.forEach((cb) => cb());
        });

        cap.Plugins.HarmoniqAudioPlayer.addListener('playbackError', (data: any) => {
          this.errorListeners.forEach((cb) =>
            cb({
              message: data?.message || 'Native audio playback error',
              track: this.currentTrack,
              code: data?.errorCodeName,
            })
          );
        });
      } catch (err) {
        console.warn('[AndroidAudioDriver] Failed to attach native listeners:', err);
      }
    }
  }

  private notifyState(): void {
    this.stateListeners.forEach((cb) => cb({ ...this.currentState }));
  }

  public async play(track: TrackMetadata, queue?: TrackMetadata[]): Promise<void> {
    this.initNativeListeners();
    this.currentTrack = track;
    if (queue) this.queue = [...queue];
    this.currentState.currentTrack = track;
    this.currentState.trackId = track.id;
    this.currentState.duration = track.duration || 0;

    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.play({
          track,
          queue: this.queue,
        });
        this.currentState.isPlaying = true;
        this.notifyState();
        return;
      } catch (err: any) {
        console.warn('[AndroidAudioDriver] Native play call error:', err);
        this.errorListeners.forEach((cb) => cb({ message: err?.message || 'Native playback error', track }));
      }
    }

    this.currentState.isPlaying = false;
    this.notifyState();
  }

  public async pause(): Promise<void> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.pause();
      } catch {}
    }
    this.currentState.isPlaying = false;
    this.notifyState();
  }

  public async resume(): Promise<void> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.resume();
        this.currentState.isPlaying = true;
        this.notifyState();
        return;
      } catch {}
    }
    this.currentState.isPlaying = false;
    this.notifyState();
  }

  public async seekTo(seconds: number): Promise<void> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.seekTo({ position: seconds });
      } catch {}
    }
    this.currentState.currentTime = seconds;
    this.notifyState();
  }

  public async setVolume(volume: number): Promise<void> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.setVolume({ volume });
      } catch {}
    }
    this.currentState.volume = volume;
    this.currentState.isMuted = volume === 0;
    this.notifyState();
  }

  public async setMuted(muted: boolean): Promise<void> {
    this.currentState.isMuted = muted;
    await this.setVolume(muted ? 0 : 1.0);
  }

  public async setPlaybackRate(rate: number): Promise<void> {
    this.currentState.playbackRate = rate;
    this.notifyState();
  }

  public async setQueue(queue: TrackMetadata[]): Promise<void> {
    this.queue = [...queue];
    this.currentState.queue = this.queue;
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.setQueue) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.setQueue({ queue: this.queue });
      } catch (err) {
        console.warn('[AndroidAudioDriver] setQueue error:', err);
      }
    }
  }

  public async addToQueue(track: TrackMetadata): Promise<void> {
    this.queue.push(track);
    await this.setQueue(this.queue);
  }

  public async playNext(track: TrackMetadata): Promise<void> {
    this.queue.unshift(track);
    await this.setQueue(this.queue);
  }

  public async removeFromQueue(index: number): Promise<void> {
    if (index >= 0 && index < this.queue.length) {
      this.queue.splice(index, 1);
      await this.setQueue(this.queue);
    }
  }

  public async clearQueue(): Promise<void> {
    this.queue = this.currentTrack ? [this.currentTrack] : [];
    await this.setQueue(this.queue);
  }

  public async setEqBands(bands: number[]): Promise<void> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.setEqBands) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.setEqBands({ bands });
      } catch {}
    }
  }

  public async setPreamp(gainDb: number): Promise<void> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.setPreamp) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.setPreamp({ gainDb });
      } catch {}
    }
  }

  public async updateMetadata(_track: TrackMetadata | null, _isPlaying: boolean): Promise<void> {
    // Managed natively by HarmoniqMediaService in Android MediaSession
  }

  public getState(): PlaybackState {
    return { ...this.currentState };
  }

  public async getPlaybackSnapshot(): Promise<PlaybackState> {
    this.initNativeListeners();
    const cap = this.getCapacitor();
    const playerPlugin = cap?.Plugins?.HarmoniqAudioPlayer;
    if (playerPlugin && (typeof playerPlugin.getPlaybackState === 'function' || typeof playerPlugin.getState === 'function')) {
      try {
        const snap = typeof playerPlugin.getPlaybackState === 'function'
          ? await playerPlugin.getPlaybackState()
          : await playerPlugin.getState();
        if (snap) {
          if (typeof snap.isPlaying === 'boolean') this.currentState.isPlaying = snap.isPlaying;
          if (typeof snap.currentTime === 'number') this.currentState.currentTime = snap.currentTime;
          if (typeof snap.duration === 'number' && snap.duration > 0) this.currentState.duration = snap.duration;
          if (snap.trackId) this.currentState.trackId = snap.trackId;
          if (snap.track) {
            this.currentTrack = snap.track;
            this.currentState.currentTrack = snap.track;
          }
          if (Array.isArray(snap.queue) && snap.queue.length > 0) {
            this.queue = snap.queue;
            this.currentState.queue = snap.queue;
          }
          if (typeof snap.currentQueueIndex === 'number') {
            this.currentState.currentQueueIndex = snap.currentQueueIndex;
          }
          if (typeof snap.volume === 'number') {
            this.currentState.volume = snap.volume;
            this.currentState.isMuted = snap.volume === 0;
          }
          if (typeof snap.isShuffle === 'boolean') {
            this.currentState.isShuffle = snap.isShuffle;
          }
          if (snap.repeatMode) {
            this.currentState.repeatMode = snap.repeatMode;
          }
          this.notifyState();
        }
      } catch (err) {
        console.warn('[AndroidAudioDriver] Failed to get playback snapshot:', err);
      }
    }
    return { ...this.currentState };
  }

  public onPlaybackStateChange(listener: PlaybackStateListener): () => void {
    this.stateListeners.add(listener);
    listener({ ...this.currentState });
    return () => this.stateListeners.delete(listener);
  }

  public onTrackEnded(listener: TrackEndedListener): () => void {
    this.trackEndedListeners.add(listener);
    return () => this.trackEndedListeners.delete(listener);
  }

  public onMediaCommand(listener: MediaCommandListener): () => void {
    this.mediaCommandListeners.add(listener);
    return () => this.mediaCommandListeners.delete(listener);
  }

  public async setShuffle(enabled: boolean): Promise<void> {
    this.currentState.isShuffle = enabled;
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.setShuffle) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.setShuffle({ shuffle: enabled });
      } catch {}
    }
    this.notifyState();
  }

  public async setRepeatMode(mode: RepeatMode): Promise<void> {
    this.currentState.repeatMode = mode;
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.setRepeatMode) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.setRepeatMode({ repeatMode: mode });
      } catch {}
    }
    this.notifyState();
  }

  public async skipToNext(): Promise<void> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.skipToNext) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.skipToNext();
      } catch {}
    }
  }

  public async skipToPrevious(): Promise<void> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.skipToPrevious) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.skipToPrevious();
      } catch {}
    }
  }

  public async getEqualizerParameters(): Promise<EqualizerParameters> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.getEqualizerParameters) {
      try {
        const res = await cap.Plugins.HarmoniqAudioPlayer.getEqualizerParameters();
        if (res) return res as EqualizerParameters;
      } catch {}
    }
    return {
      supported: false,
      enabled: false,
      numBands: 0,
      bands: [],
      presets: ['Flat', 'Bass Boost', 'Vocal', 'Rock', 'Pop', 'Classical', 'Jazz', 'Electronic'],
      currentPreset: 'Flat',
    };
  }

  public async setEqualizerEnabled(enabled: boolean): Promise<void> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.setEqualizerEnabled) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.setEqualizerEnabled({ enabled });
      } catch {}
    }
  }

  public async setEqualizerBandGain(band: number, gainDb: number): Promise<void> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.setEqualizerBandGain) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.setEqualizerBandGain({ band, gainDb });
      } catch {}
    }
  }

  public async setEqualizerPreset(presetName: string): Promise<void> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.setEqualizerPreset) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.setEqualizerPreset({ preset: presetName });
      } catch {}
    }
  }

  public async resetEqualizer(): Promise<void> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.resetEqualizer) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.resetEqualizer();
      } catch {}
    }
  }

  public async startSleepTimer(minutes: number): Promise<void> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.startSleepTimer) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.startSleepTimer({ minutes });
      } catch {}
    }
  }

  public async cancelSleepTimer(): Promise<void> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.cancelSleepTimer) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.cancelSleepTimer();
      } catch {}
    }
  }

  public async getSleepTimerStatus(): Promise<NativeSleepTimerStatus> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.getSleepTimerStatus) {
      try {
        const res = await cap.Plugins.HarmoniqAudioPlayer.getSleepTimerStatus();
        if (res) return res as NativeSleepTimerStatus;
      } catch {}
    }
    return { isActive: false, secondsRemaining: 0, totalSeconds: 0 };
  }

  public onSleepTimerExpired(listener: SleepTimerExpiredListener): () => void {
    this.sleepTimerExpiredListeners.add(listener);
    return () => this.sleepTimerExpiredListeners.delete(listener);
  }

  public async checkNotificationPermission(): Promise<{ granted: boolean; shouldShowRationale?: boolean }> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.checkNotificationPermission) {
      try {
        const res = await cap.Plugins.HarmoniqAudioPlayer.checkNotificationPermission();
        return {
          granted: Boolean(res?.granted),
          shouldShowRationale: Boolean(res?.shouldShowRationale),
        };
      } catch {}
    }
    return { granted: true, shouldShowRationale: false };
  }

  public async requestNotificationPermission(): Promise<{ requested: boolean; granted?: boolean }> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.requestNotificationPermission) {
      try {
        const res = await cap.Plugins.HarmoniqAudioPlayer.requestNotificationPermission();
        return {
          requested: Boolean(res?.requested),
          granted: Boolean(res?.granted),
        };
      } catch {}
    }
    return { requested: false, granted: true };
  }

  public async openNotificationSettings(): Promise<boolean> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.openNotificationSettings) {
      try {
        const res = await cap.Plugins.HarmoniqAudioPlayer.openNotificationSettings();
        return Boolean(res?.success);
      } catch {}
    }
    return false;
  }

  public async getStopOnTaskRemoved(): Promise<boolean> {
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.getStopOnTaskRemoved) {
      try {
        const res = await cap.Plugins.HarmoniqAudioPlayer.getStopOnTaskRemoved();
        if (res && typeof res.enabled === 'boolean') {
          return res.enabled;
        }
      } catch {}
    }
    try {
      const stored = localStorage.getItem('harmoniq_stop_on_task_removed');
      if (stored !== null) return stored === 'true';
    } catch {}
    return true;
  }

  public async setStopOnTaskRemoved(enabled: boolean): Promise<void> {
    try {
      localStorage.setItem('harmoniq_stop_on_task_removed', String(enabled));
    } catch {}
    const cap = this.getCapacitor();
    if (cap?.Plugins?.HarmoniqAudioPlayer?.setStopOnTaskRemoved) {
      try {
        await cap.Plugins.HarmoniqAudioPlayer.setStopOnTaskRemoved({ enabled });
      } catch {}
    }
  }

  public onError(listener: PlaybackErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }
}
