import { IAudioDriver } from '../IAudioDriver';
import { PlaybackState, PlaybackStateListener, TrackEndedListener, MediaCommandListener, PlaybackErrorListener } from '../types';
import { TrackMetadata } from '../../../types/audio';
import { audioEngine } from '../../audioEngine';

export class ElectronAudioDriver implements IAudioDriver {
  private queue: TrackMetadata[] = [];
  private currentTrack: TrackMetadata | null = null;
  private stateListeners = new Set<PlaybackStateListener>();
  private trackEndedListeners = new Set<TrackEndedListener>();
  private mediaCommandListeners = new Set<MediaCommandListener>();
  private errorListeners = new Set<PlaybackErrorListener>();

  private currentState: PlaybackState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    trackId: null,
    currentTrack: null,
    volume: 0.85,
    isMuted: false,
    playbackRate: 1.0,
  };

  private unsubAudioEngineStatus: (() => void) | null = null;
  private unsubAudioEngineError: (() => void) | null = null;
  private unsubMediaCommand: (() => void) | null = null;

  constructor() {
    this.initListeners();
  }

  private initListeners(): void {
    this.unsubAudioEngineStatus = audioEngine.subscribeStatus((status) => {
      this.currentState = {
        ...this.currentState,
        currentTime: status.currentTime,
        duration: status.duration,
        isPlaying: status.isPlaying,
        trackId: status.trackId,
      };

      if (status.isEnded) {
        this.trackEndedListeners.forEach((cb) => {
          try {
            cb();
          } catch (e) {
            console.warn('Error in trackEnded listener:', e);
          }
        });
      }

      this.notifyState();
    });

    this.unsubAudioEngineError = audioEngine.subscribeError((message, track) => {
      this.errorListeners.forEach((cb) => {
        try {
          cb({ message, track });
        } catch (e) {
          console.warn('Error in error listener:', e);
        }
      });
    });

    if (typeof window !== 'undefined' && window.harmoniqApi?.onMediaCommand) {
      this.unsubMediaCommand = window.harmoniqApi.onMediaCommand((cmd: string) => {
        const normalized = cmd as any;
        this.mediaCommandListeners.forEach((cb) => cb(normalized));
      });
    }
  }

  private notifyState(): void {
    this.stateListeners.forEach((cb) => cb({ ...this.currentState }));
  }

  public async play(track: TrackMetadata, queue?: TrackMetadata[]): Promise<void> {
    this.currentTrack = track;
    if (queue) {
      this.queue = [...queue];
    }
    this.currentState.currentTrack = track;
    this.currentState.trackId = track.id;
    await audioEngine.loadAndPlay(track);
    this.currentState.isPlaying = true;
    this.notifyState();
    await this.updateMetadata(track, true);
  }

  public async pause(): Promise<void> {
    audioEngine.pause();
    this.currentState.isPlaying = false;
    this.notifyState();
    await this.updateMetadata(this.currentTrack, false);
  }

  public async resume(): Promise<void> {
    await audioEngine.play();
    this.currentState.isPlaying = true;
    this.notifyState();
    await this.updateMetadata(this.currentTrack, true);
  }

  public async seekTo(seconds: number): Promise<void> {
    audioEngine.seek(seconds);
    this.currentState.currentTime = seconds;
    this.notifyState();
  }

  public async setVolume(volume: number): Promise<void> {
    const clamped = Math.max(0, Math.min(1, volume));
    audioEngine.setVolume(clamped);
    this.currentState.volume = clamped;
    this.currentState.isMuted = clamped === 0;
    this.notifyState();
  }

  public async setMuted(muted: boolean): Promise<void> {
    audioEngine.setMute(muted);
    this.currentState.isMuted = muted;
    this.notifyState();
  }

  public async setPlaybackRate(rate: number): Promise<void> {
    audioEngine.setPlaybackRate(rate);
    this.currentState.playbackRate = rate;
    this.notifyState();
  }

  public async setQueue(queue: TrackMetadata[]): Promise<void> {
    this.queue = [...queue];
  }

  public async addToQueue(track: TrackMetadata): Promise<void> {
    this.queue.push(track);
  }

  public async playNext(track: TrackMetadata): Promise<void> {
    const curIdx = this.currentTrack ? this.queue.findIndex((t) => t.id === this.currentTrack!.id) : -1;
    if (curIdx >= 0) {
      this.queue.splice(curIdx + 1, 0, track);
    } else {
      this.queue.unshift(track);
    }
  }

  public async removeFromQueue(index: number): Promise<void> {
    if (index >= 0 && index < this.queue.length) {
      this.queue.splice(index, 1);
    }
  }

  public async clearQueue(): Promise<void> {
    this.queue = [];
  }

  public async setEqBands(bands: number[]): Promise<void> {
    const current = audioEngine.getDSPSettings();
    audioEngine.applyDSPSettings({ ...current, bands });
  }

  public async setPreamp(preamp: number): Promise<void> {
    const current = audioEngine.getDSPSettings();
    audioEngine.applyDSPSettings({ ...current, preamp });
  }

  public async setDspEnabled(enabled: boolean): Promise<void> {
    const current = audioEngine.getDSPSettings();
    audioEngine.applyDSPSettings({ ...current, enabled });
  }

  public async setBassBoost(bassBoost: number): Promise<void> {
    const current = audioEngine.getDSPSettings();
    audioEngine.applyDSPSettings({ ...current, bassBoost });
  }

  public async setTreble(treble: number): Promise<void> {
    const current = audioEngine.getDSPSettings();
    audioEngine.applyDSPSettings({ ...current, treble });
  }

  public async setOutputDevice(deviceId: string): Promise<boolean> {
    return await audioEngine.setOutputDevice(deviceId);
  }

  public async updateMetadata(track: TrackMetadata | null, isPlaying: boolean): Promise<void> {
    if (typeof window !== 'undefined' && window.harmoniqApi?.updateSMTC) {
      try {
        if (track) {
          await window.harmoniqApi.updateSMTC({
            title: track.title,
            artist: track.artist,
            album: track.album,
            isPlaying,
          });
        } else {
          await window.harmoniqApi.updateSMTC({
            title: '',
            artist: '',
            album: '',
            isPlaying: false,
          });
        }
      } catch (err) {
        console.warn('Failed to update SMTC via Electron driver:', err);
      }
    }
  }

  public getState(): PlaybackState {
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

  public onError(listener: PlaybackErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  public dispose(): void {
    if (this.unsubAudioEngineStatus) this.unsubAudioEngineStatus();
    if (this.unsubAudioEngineError) this.unsubAudioEngineError();
    if (this.unsubMediaCommand) this.unsubMediaCommand();
    this.stateListeners.clear();
    this.trackEndedListeners.clear();
    this.mediaCommandListeners.clear();
    this.errorListeners.clear();
  }
}
