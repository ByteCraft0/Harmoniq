import { TrackMetadata } from '../types/audio';

export interface SessionTrackRecord {
  track: TrackMetadata;
  startedAt: number;
  playedDurationSeconds: number;
  status: 'completed' | 'skipped' | 'partial';
}

export interface ListeningSession {
  id: string;
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number;
  tracks: SessionTrackRecord[];
  totalTracksCount: number;
  completedCount: number;
  skippedCount: number;
}

const STORAGE_SESSION_HISTORY_KEY = 'harmoniq_listening_sessions_v1';
const STORAGE_TRACKING_ENABLED_KEY = 'harmoniq_session_tracking_enabled';
const MAX_SESSIONS = 50;

export class SessionTrackingService {
  private currentSession: ListeningSession | null = null;
  private sessionHistory: ListeningSession[] = [];
  private trackingEnabled = true;
  private listeners: Set<() => void> = new Set();
  private currentTrackRecord: {
    track: TrackMetadata;
    startedAt: number;
    lastPosition: number;
    accumulatedSeconds: number;
  } | null = null;

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const rawHistory = localStorage.getItem(STORAGE_SESSION_HISTORY_KEY);
        if (rawHistory) {
          const parsed = JSON.parse(rawHistory);
          if (Array.isArray(parsed)) {
            this.sessionHistory = parsed;
          }
        }

        const rawEnabled = localStorage.getItem(STORAGE_TRACKING_ENABLED_KEY);
        if (rawEnabled !== null) {
          this.trackingEnabled = rawEnabled === 'true';
        }
      }
    } catch (e) {
      console.warn('Failed to load session tracking history:', e);
    }
  }

  private save(): void {
    if (!this.trackingEnabled) return;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          STORAGE_SESSION_HISTORY_KEY,
          JSON.stringify(this.sessionHistory.slice(0, MAX_SESSIONS))
        );
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
        (window as any).harmoniqApi
          .savePersistentData(STORAGE_SESSION_HISTORY_KEY, this.sessionHistory.slice(0, MAX_SESSIONS))
          .catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to persist session tracking history:', e);
    }
    this.emit();
  }

  public isTrackingEnabled(): boolean {
    return this.trackingEnabled;
  }

  public setTrackingEnabled(enabled: boolean): void {
    this.trackingEnabled = enabled;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_TRACKING_ENABLED_KEY, String(enabled));
      }
    } catch {
      /* ignore */
    }
    if (!enabled && this.currentSession) {
      this.endCurrentSession();
    }
    this.emit();
  }

  public getCurrentSession(): ListeningSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  public getSessionHistory(): ListeningSession[] {
    return [...this.sessionHistory];
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    this.listeners.forEach((cb) => cb());
  }

  /**
   * Start or continue an active listening session when playback begins
   */
  public onPlaybackStarted(track: TrackMetadata): void {
    if (!this.trackingEnabled) return;

    const now = Date.now();

    // If no active session, start one
    if (!this.currentSession) {
      this.currentSession = {
        id: `sess_${now}_${Math.random().toString(36).slice(2, 7)}`,
        startedAt: now,
        endedAt: null,
        durationSeconds: 0,
        tracks: [],
        totalTracksCount: 0,
        completedCount: 0,
        skippedCount: 0,
      };
    }

    // Flush any pending track progress
    if (this.currentTrackRecord && this.currentTrackRecord.track.id !== track.id) {
      this.flushCurrentTrackProgress();
    }

    // Set new current track record
    this.currentTrackRecord = {
      track,
      startedAt: now,
      lastPosition: 0,
      accumulatedSeconds: 0,
    };

    this.emit();
  }

  /**
   * Record playback progress on current track
   */
  public onPlaybackProgress(secondsListenedDelta: number): void {
    if (!this.trackingEnabled || !this.currentSession || !this.currentTrackRecord) return;

    const delta = Math.max(0, Math.min(10, secondsListenedDelta));
    this.currentTrackRecord.accumulatedSeconds += delta;
    this.currentSession.durationSeconds = Math.round(
      this.currentSession.durationSeconds + delta
    );
  }

  /**
   * Record completion or skip on track transition or manual skip
   */
  public onTrackCompletedOrSkipped(
    track: TrackMetadata,
    playedSeconds: number,
    status?: 'completed' | 'skipped' | 'partial'
  ): void {
    if (!this.trackingEnabled || !this.currentSession) return;

    let computedStatus: 'completed' | 'skipped' | 'partial' = status || 'partial';
    const duration = track.duration || 0;
    const cleanSeconds = Math.max(0, Math.round(playedSeconds));

    if (!status) {
      if (cleanSeconds >= 30 && (cleanSeconds >= duration * 0.5 || cleanSeconds >= 120)) {
        computedStatus = 'completed';
      } else if (cleanSeconds < 15) {
        computedStatus = 'skipped';
      } else {
        computedStatus = 'partial';
      }
    }

    // Append to current session
    const record: SessionTrackRecord = {
      track,
      startedAt: this.currentTrackRecord ? this.currentTrackRecord.startedAt : Date.now(),
      playedDurationSeconds: cleanSeconds,
      status: computedStatus,
    };

    this.currentSession.tracks.push(record);
    this.currentSession.totalTracksCount = this.currentSession.tracks.length;

    if (computedStatus === 'completed') {
      this.currentSession.completedCount++;
    } else if (computedStatus === 'skipped') {
      this.currentSession.skippedCount++;
    }

    this.currentTrackRecord = null;
    this.emit();
  }

  private flushCurrentTrackProgress(): void {
    if (!this.currentTrackRecord || !this.currentSession) return;
    this.onTrackCompletedOrSkipped(
      this.currentTrackRecord.track,
      this.currentTrackRecord.accumulatedSeconds
    );
  }

  /**
   * End the current listening session and archive it into session history
   */
  public endCurrentSession(): void {
    if (!this.currentSession) return;

    this.flushCurrentTrackProgress();
    this.currentSession.endedAt = Date.now();

    // Only save session if at least one track was played or duration >= 10s
    if (this.currentSession.tracks.length > 0 || this.currentSession.durationSeconds >= 10) {
      this.sessionHistory = [this.currentSession, ...this.sessionHistory].slice(0, MAX_SESSIONS);
      this.save();
    }

    this.currentSession = null;
    this.currentTrackRecord = null;
    this.emit();
  }

  /**
   * Replay a session: extract all tracks from the specified session in original sequence
   */
  public replaySession(sessionId: string): TrackMetadata[] {
    const session =
      this.sessionHistory.find((s) => s.id === sessionId) ||
      (this.currentSession?.id === sessionId ? this.currentSession : null);

    if (!session || !session.tracks || session.tracks.length === 0) {
      return [];
    }

    // Filter duplicates preserving sequence
    const seen = new Set<string>();
    const tracks: TrackMetadata[] = [];
    for (const entry of session.tracks) {
      if (entry.track && !seen.has(entry.track.id)) {
        seen.add(entry.track.id);
        tracks.push(entry.track);
      }
    }
    return tracks;
  }

  /**
   * Clear session history
   */
  public clearSessionHistory(): void {
    this.sessionHistory = [];
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_SESSION_HISTORY_KEY);
      }
    } catch {
      /* ignore */
    }
    this.emit();
  }
}

export const sessionTrackingService = new SessionTrackingService();
