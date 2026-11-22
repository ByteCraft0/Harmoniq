import { IAudioDriver } from '../IAudioDriver';
import { PlaybackState, PlaybackStateListener, TrackEndedListener, MediaCommandListener, PlaybackErrorListener } from '../types';
import { TrackMetadata } from '../../../types/audio';
import { audioEngine } from '../../audioEngine';

export class WebAudioDriver implements IAudioDriver {
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

  private unsubStatus: (() => void) | null = null;
  private unsubError: (() => void) | null = null;

  constructor() {
    this.unsubStatus = audioEngine.subscribeStatus((status) => {
      this.currentState = {
        ...this.currentState,
        currentTime: status.currentTime,
        duration: status.duration,
        isPlaying: status.isPlaying,
        trackId: status.trackId,
      };
      if (status.isEnded) {
        this.trackEndedListeners.forEach((cb) => cb());
      }
      this.notifyState();
    });

    this.unsubError = audioEngine.subscribeError((message, track) => {
      this.errorListeners.forEach((cb) => cb({ message, track }));
    });
  }

  private notifyState(): void {
    this.stateListeners.forEach((cb) => cb({ ...this.currentState }));
  }

  public async play(track: TrackMetadata, queue?: TrackMetadata[]): Promise<void> {
    this.currentTrack = track;
    if (queue) this.queue = [...queue];
    this.currentState.currentTrack = track;
    this.currentState.trackId = track.id;
    await audioEngine.loadAndPlay(track);
    this.currentState.isPlaying = true;
    this.notifyState();
  }

  public async pause(): Promise<void> {
    audioEngine.pause();
    this.currentState.isPlaying = false;
    this.notifyState();
  }

  public async resume(): Promise<void> {
    await audioEngine.play();
    this.currentState.isPlaying = true;
    this.notifyState();
  }

  public async seekTo(seconds: number): Promise<void> {
    audioEngine.seek(seconds);
    this.currentState.currentTime = seconds;
    this.notifyState();
  }

  public async setVolume(volume: number): Promise<void> {
    audioEngine.setVolume(volume);
    this.currentState.volume = volume;
    this.currentState.isMuted = volume === 0;
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
    this.queue.unshift(track);
  }

  public async removeFromQueue(index: number): Promise<void> {
    this.queue.splice(index, 1);
  }

  public async clearQueue(): Promise<void> {
    this.queue = [];
  }

  public async updateMetadata(_track: TrackMetadata | null, _isPlaying: boolean): Promise<void> {
    // Web media session if available
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && _track) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: _track.title,
          artist: _track.artist,
          album: _track.album,
        });
      } catch {}
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

  public onError(listener: PlaybackErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  public dispose(): void {
    if (this.unsubStatus) this.unsubStatus();
    if (this.unsubError) this.unsubError();
    this.stateListeners.clear();
    this.trackEndedListeners.clear();
    this.errorListeners.clear();
  }
}
