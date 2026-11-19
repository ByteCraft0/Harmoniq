import { ABXSession, ABXTrial, ABXStreamChoice, ABXStatisticalResult } from '../types/abx';
import { TrackMetadata } from '../types/audio';
import { buildMediaUrl } from './audioEngine';

const STORAGE_ABX_SESSIONS_KEY = 'harmoniq_abx_sessions_v1';

export class ABXService {
  private sessions: Map<string, ABXSession> = new Map();
  private currentSession: ABXSession | null = null;
  private currentStream: ABXStreamChoice = 'A';

  // Synchronized Dual-Audio Decks for ABX Testing
  private audioA: HTMLAudioElement | null = null;
  private audioB: HTMLAudioElement | null = null;
  private isPlaying = false;
  private syncTimer: any = null;

  private listeners: Set<(session: ABXSession | null) => void> = new Set();
  private playbackListeners: Set<(state: { isPlaying: boolean; currentTime: number; duration: number; activeStream: ABXStreamChoice }) => void> = new Set();

  constructor() {
    this.loadSessions();
  }

  private loadSessions(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_ABX_SESSIONS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const s of parsed) {
              if (s && s.id) this.sessions.set(s.id, s);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load ABX sessions:', e);
    }
  }

  private saveSessions(): void {
    try {
      const list = Array.from(this.sessions.values());
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_ABX_SESSIONS_KEY, JSON.stringify(list));
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
        (window as any).harmoniqApi.savePersistentData(STORAGE_ABX_SESSIONS_KEY, list).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to persist ABX sessions:', e);
    }
  }

  // --- Statistical Calculations ---

  /**
   * Computes binomial combination C(n, k) = n! / (k! * (n-k)!)
   */
  public static combinations(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    let c = 1;
    for (let i = 1; i <= k; i++) {
      c = (c * (n - (k - i))) / i;
    }
    return Math.round(c);
  }

  /**
   * Calculates exact one-tailed binomial probability p-value (null hypothesis p = 0.5):
   * p = Sum_{i=k..n} ( C(n, i) * 0.5^n )
   */
  public static computeBinomialPValue(totalTrials: number, correctTrials: number): number {
    if (totalTrials <= 0) return 1.0;
    if (correctTrials <= 0) return 1.0;
    if (correctTrials > totalTrials) return 0.0;

    let sum = 0;
    const factor = Math.pow(0.5, totalTrials);
    for (let i = correctTrials; i <= totalTrials; i++) {
      sum += ABXService.combinations(totalTrials, i) * factor;
    }
    return Math.min(1.0, Math.max(0.0, sum));
  }

  public static analyzeResults(totalTrials: number, correctTrials: number): ABXStatisticalResult {
    const percentage = totalTrials > 0 ? (correctTrials / totalTrials) * 100 : 0;
    const pValue = ABXService.computeBinomialPValue(totalTrials, correctTrials);
    const isSignificant = pValue < 0.05 && totalTrials >= 5;

    let interpretation = 'Not enough trials completed.';
    if (totalTrials >= 5) {
      if (pValue < 0.001) {
        interpretation = 'Extremely Significant (p < 0.001): Overwhelming evidence of audible difference.';
      } else if (pValue < 0.01) {
        interpretation = 'Highly Significant (p < 0.01): Reliable ability to distinguish files.';
      } else if (pValue < 0.05) {
        interpretation = 'Statistically Significant (p < 0.05): Audible difference detected beyond chance.';
      } else {
        interpretation = 'Not Statistically Significant (p ≥ 0.05): Results consistent with random guessing.';
      }
    }

    return {
      trials: totalTrials,
      correct: correctTrials,
      percentage: parseFloat(percentage.toFixed(1)),
      pValue: parseFloat(pValue.toFixed(4)),
      isSignificant,
      interpretation,
    };
  }

  // --- Session Lifecycle ---

  public createSession(
    trackA: TrackMetadata | null,
    trackB: TrackMetadata | null,
    totalTrials = 10,
    options: {
      name?: string;
      levelTrimDbA?: number;
      levelTrimDbB?: number;
      audioGearNotes?: string;
    } = {}
  ): ABXSession {
    const id = `abx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const trackAName = trackA ? `${trackA.title} - ${trackA.artist}` : 'Audio Track A';
    const trackBName = trackB ? `${trackB.title} - ${trackB.artist}` : 'Audio Track B';

    // Generate trials with unbiased random secret assignments
    const trials: ABXTrial[] = [];
    for (let i = 0; i < totalTrials; i++) {
      trials.push({
        trialIndex: i,
        secretAssignment: Math.random() < 0.5 ? 'A' : 'B',
        userChoice: null,
        isCorrect: null,
        timestamp: 0,
        timeSpentAuditioningSec: 0,
      });
    }

    // Auto-level matching based on ReplayGain if available
    let trimA = options.levelTrimDbA || 0;
    let trimB = options.levelTrimDbB || 0;
    let isAutoLevelMatched = false;

    if (trackA?.replayGain?.trackGain && trackB?.replayGain?.trackGain) {
      const diff = trackB.replayGain.trackGain - trackA.replayGain.trackGain;
      trimB += diff;
      isAutoLevelMatched = true;
    }

    const session: ABXSession = {
      id,
      name: options.name?.trim() || `ABX Test: ${trackAName} vs ${trackBName}`,
      trackA,
      trackB,
      trackAName,
      trackBName,
      totalTrials,
      currentTrialIndex: 0,
      trials,
      levelTrimDbA: trimA,
      levelTrimDbB: trimB,
      isAutoLevelMatched,
      isComplete: false,
      correctCount: 0,
      completedTrialsCount: 0,
      correctPercentage: 0,
      pValue: 1.0,
      isStatisticallySignificant: false,
      confidenceRating: 'Awaiting Trials',
      dateCreated: Date.now(),
      audioGearNotes: options.audioGearNotes,
    };

    this.sessions.set(id, session);
    this.currentSession = session;
    this.currentStream = 'A';
    this.setupAudioDecks(trackA, trackB);
    this.saveSessions();
    this.notifySession();
    return session;
  }

  // --- Audio Decks & Lockstep Synchronization ---

  public setupAudioDecks(trackA: TrackMetadata | null, trackB: TrackMetadata | null): void {
    this.teardownAudioDecks();

    if (typeof Audio === 'undefined') return;

    this.audioA = new Audio();
    this.audioB = new Audio();

    if (trackA) {
      this.audioA.src = buildMediaUrl(trackA.filePath || (trackA as any).path || '');
      this.audioA.preload = 'auto';
    }
    if (trackB) {
      this.audioB.src = buildMediaUrl(trackB.filePath || (trackB as any).path || '');
      this.audioB.preload = 'auto';
    }

    this.applyAudioVolumes();

    // Start playback sync loop
    this.syncTimer = setInterval(() => {
      this.syncAudioPosition();
    }, 150);
  }

  private teardownAudioDecks(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.audioA) {
      this.audioA.pause();
      this.audioA.src = '';
      this.audioA = null;
    }
    if (this.audioB) {
      this.audioB.pause();
      this.audioB.src = '';
      this.audioB = null;
    }
    this.isPlaying = false;
  }

  /**
   * Perfectly synchronizes the time of both decks so switches are seamless
   */
  private syncAudioPosition(): void {
    if (!this.audioA || !this.audioB) return;

    const master = this.getActiveAudioElement();
    const slave = master === this.audioA ? this.audioB : this.audioA;

    if (master && slave) {
      const diff = Math.abs(master.currentTime - slave.currentTime);
      if (diff > 0.04) {
        slave.currentTime = master.currentTime;
      }
    }

    this.emitPlayback();
  }

  public getActiveAudioElement(): HTMLAudioElement | null {
    if (!this.currentSession) return this.audioA;

    if (this.currentStream === 'A') return this.audioA;
    if (this.currentStream === 'B') return this.audioB;

    // Stream 'X': secretly route to A or B based on current trial
    const curTrial = this.currentSession.trials[this.currentSession.currentTrialIndex];
    if (curTrial?.secretAssignment === 'B') {
      return this.audioB;
    }
    return this.audioA;
  }

  private applyAudioVolumes(): void {
    if (!this.audioA || !this.audioB || !this.currentSession) return;

    const s = this.currentSession;
    const gainA = Math.pow(10, s.levelTrimDbA / 20);
    const gainB = Math.pow(10, s.levelTrimDbB / 20);

    const activeEl = this.getActiveAudioElement();

    if (activeEl === this.audioA) {
      this.audioA.volume = Math.max(0, Math.min(1.0, 0.95 * gainA));
      this.audioB.volume = 0;
    } else {
      this.audioB.volume = Math.max(0, Math.min(1.0, 0.95 * gainB));
      this.audioA.volume = 0;
    }
  }

  public async play(): Promise<void> {
    if (!this.audioA || !this.audioB) return;
    try {
      // Sync positions before start
      const targetTime = this.audioA.currentTime;
      this.audioB.currentTime = targetTime;

      await Promise.all([this.audioA.play(), this.audioB.play()]);
      this.isPlaying = true;
      this.applyAudioVolumes();
      this.emitPlayback();
    } catch (e) {
      console.warn('ABX audio play failed:', e);
    }
  }

  public pause(): void {
    if (this.audioA) this.audioA.pause();
    if (this.audioB) this.audioB.pause();
    this.isPlaying = false;
    this.emitPlayback();
  }

  public seek(seconds: number): void {
    const sec = Math.max(0, seconds);
    if (this.audioA) this.audioA.currentTime = sec;
    if (this.audioB) this.audioB.currentTime = sec;
    this.emitPlayback();
  }

  /**
   * Switch auditioning stream ('A', 'B', or blind 'X') seamlessly in real-time
   */
  public audition(stream: ABXStreamChoice): void {
    this.currentStream = stream;
    this.applyAudioVolumes();
    this.emitPlayback();
  }

  public setLevelTrim(stream: 'A' | 'B', db: number): void {
    if (!this.currentSession) return;
    const clampedDb = Math.max(-12, Math.min(12, Math.round(db * 10) / 10));
    if (stream === 'A') {
      this.currentSession.levelTrimDbA = clampedDb;
    } else {
      this.currentSession.levelTrimDbB = clampedDb;
    }
    this.applyAudioVolumes();
    this.saveSessions();
    this.notifySession();
  }

  // --- Voting & Progression ---

  public submitChoice(userGuess: 'A' | 'B'): boolean {
    if (!this.currentSession || this.currentSession.isComplete) return false;

    const s = this.currentSession;
    const currentTrial = s.trials[s.currentTrialIndex];
    if (!currentTrial) return false;

    currentTrial.userChoice = userGuess;
    currentTrial.isCorrect = userGuess === currentTrial.secretAssignment;
    currentTrial.timestamp = Date.now();

    s.completedTrialsCount++;
    if (currentTrial.isCorrect) {
      s.correctCount++;
    }

    const stats = ABXService.analyzeResults(s.completedTrialsCount, s.correctCount);
    s.correctPercentage = stats.percentage;
    s.pValue = stats.pValue;
    s.isStatisticallySignificant = stats.isSignificant;
    s.confidenceRating = stats.interpretation;

    // Advance to next trial or finish session
    if (s.currentTrialIndex < s.totalTrials - 1) {
      s.currentTrialIndex++;
      this.currentStream = 'A'; // Reset default audition to A
      this.applyAudioVolumes();
    } else {
      s.isComplete = true;
      s.dateCompleted = Date.now();
      this.pause();
    }

    this.saveSessions();
    this.notifySession();
    return true;
  }

  public resetCurrentSession(): void {
    if (!this.currentSession) return;
    const s = this.currentSession;
    s.currentTrialIndex = 0;
    s.completedTrialsCount = 0;
    s.correctCount = 0;
    s.correctPercentage = 0;
    s.pValue = 1.0;
    s.isStatisticallySignificant = false;
    s.confidenceRating = 'Awaiting Trials';
    s.isComplete = false;

    // Reshuffle secrets
    for (const t of s.trials) {
      t.secretAssignment = Math.random() < 0.5 ? 'A' : 'B';
      t.userChoice = null;
      t.isCorrect = null;
      t.timestamp = 0;
    }

    this.currentStream = 'A';
    this.seek(0);
    this.saveSessions();
    this.notifySession();
  }

  // --- Getters & Subscriptions ---

  public getCurrentSession(): ABXSession | null {
    return this.currentSession;
  }

  public getSessions(): ABXSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.dateCreated - a.dateCreated);
  }

  public loadSession(id: string): ABXSession | null {
    const s = this.sessions.get(id);
    if (!s) return null;
    this.currentSession = s;
    this.setupAudioDecks(s.trackA, s.trackB);
    this.notifySession();
    return s;
  }

  public deleteSession(id: string): boolean {
    if (!this.sessions.has(id)) return false;
    this.sessions.delete(id);
    if (this.currentSession?.id === id) {
      this.currentSession = null;
      this.teardownAudioDecks();
    }
    this.saveSessions();
    this.notifySession();
    return true;
  }

  public subscribe(cb: (session: ABXSession | null) => void): () => void {
    this.listeners.add(cb);
    cb(this.currentSession);
    return () => this.listeners.delete(cb);
  }

  public subscribePlayback(cb: (state: { isPlaying: boolean; currentTime: number; duration: number; activeStream: ABXStreamChoice }) => void): () => void {
    this.playbackListeners.add(cb);
    this.emitPlayback();
    return () => this.playbackListeners.delete(cb);
  }

  private notifySession(): void {
    this.listeners.forEach((cb) => cb(this.currentSession));
  }

  private emitPlayback(): void {
    const el = this.getActiveAudioElement();
    const state = {
      isPlaying: this.isPlaying,
      currentTime: el?.currentTime || 0,
      duration: el?.duration || 0,
      activeStream: this.currentStream,
    };
    this.playbackListeners.forEach((cb) => cb(state));
  }
}

export const abxService = new ABXService();
