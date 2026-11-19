import { WaveformData } from '../types/waveform';
import { TrackMetadata } from '../types/audio';
import { buildMediaUrl } from './audioEngine';

const STORAGE_WAVEFORM_CACHE_KEY = 'harmoniq_waveform_cache_v1';
const MAX_PERSISTED_WAVEFORMS = 150;
const DEFAULT_BAR_COUNT = 240;

export class WaveformService {
  private cache: Map<string, WaveformData> = new Map();
  private pendingPromises: Map<string, Promise<WaveformData>> = new Map();
  private listeners: Set<(trackId: string, data: WaveformData) => void> = new Set();
  private offlineAudioCtx: AudioContext | null = null;

  constructor() {
    this.loadCache();
  }

  private loadCache(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_WAVEFORM_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            for (const [id, data] of Object.entries(parsed)) {
              if (data && (data as any).peaks) {
                this.cache.set(id, data as WaveformData);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load waveform cache:', e);
    }
  }

  private saveCache(): void {
    try {
      const obj: Record<string, WaveformData> = {};
      const entries = Array.from(this.cache.entries()).slice(-MAX_PERSISTED_WAVEFORMS);
      for (const [id, data] of entries) {
        obj[id] = data;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_WAVEFORM_CACHE_KEY, JSON.stringify(obj));
      }
    } catch (e) {
      console.warn('Failed to persist waveform cache:', e);
    }
  }

  public getCachedWaveform(trackId: string): WaveformData | undefined {
    return this.cache.get(trackId);
  }

  /**
   * Pure deterministic peak and RMS downsampling algorithm
   */
  public downsampleChannel(
    channelData: Float32Array,
    bucketCount = DEFAULT_BAR_COUNT
  ): { peaks: number[]; rms: number[] } {
    const totalSamples = channelData.length;
    if (totalSamples === 0) {
      return {
        peaks: new Array(bucketCount).fill(0.1),
        rms: new Array(bucketCount).fill(0.05),
      };
    }

    const blockSize = Math.max(1, Math.floor(totalSamples / bucketCount));
    const peaks: number[] = [];
    const rms: number[] = [];
    let globalMax = 0.001;

    for (let i = 0; i < bucketCount; i++) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, totalSamples);
      let localMax = 0;
      let sumSquares = 0;
      let count = 0;

      for (let j = start; j < end; j++) {
        const val = Math.abs(channelData[j]);
        if (val > localMax) localMax = val;
        sumSquares += val * val;
        count++;
      }

      if (localMax > globalMax) globalMax = localMax;
      peaks.push(localMax);
      rms.push(count > 0 ? Math.sqrt(sumSquares / count) : 0);
    }

    // Normalize peak values to [0.05, 1.0] for visually pleasant, non-zero rendering
    const normalizedPeaks = peaks.map((p) => {
      const norm = p / globalMax;
      return Math.max(0.06, Math.min(1.0, Math.round(norm * 1000) / 1000));
    });

    const normalizedRms = rms.map((r) => {
      const norm = r / globalMax;
      return Math.max(0.03, Math.min(1.0, Math.round(norm * 1000) / 1000));
    });

    return { peaks: normalizedPeaks, rms: normalizedRms };
  }

  /**
   * Deterministic acoustic profile generator for streams or files where decode fails
   */
  public generateFallbackEnvelope(track: TrackMetadata, barCount = DEFAULT_BAR_COUNT): WaveformData {
    const peaks: number[] = [];
    const rms: number[] = [];
    const duration = track.duration || 180;

    // Generate a natural musical dynamic arc: intro build-up, verses, choruses, bridge, outro
    for (let i = 0; i < barCount; i++) {
      const progress = i / barCount;
      const arc = Math.sin(progress * Math.PI); // general arc

      // Add pseudo-random harmonic structure using track ID hash
      let hash = 0;
      const str = `${track.id}_${i}`;
      for (let c = 0; c < str.length; c++) {
        hash = (hash << 5) - hash + str.charCodeAt(c);
        hash |= 0;
      }
      const pseudo = (Math.abs(hash) % 1000) / 1000;

      const peakVal = Math.max(0.08, Math.min(0.98, arc * 0.6 + pseudo * 0.4));
      peaks.push(Math.round(peakVal * 1000) / 1000);
      rms.push(Math.round(peakVal * 0.65 * 1000) / 1000);
    }

    return {
      trackId: track.id,
      duration,
      peaks,
      rms,
      sampleRate: track.sampleRate || 44100,
      channels: track.channels || 2,
      generatedAt: Date.now(),
      isEstimated: true,
    };
  }

  /**
   * Asynchronously retrieves or decodes the waveform for a given track.
   * Never blocks UI, never interrupts playing audio.
   */
  public async getWaveform(track: TrackMetadata, barCount = DEFAULT_BAR_COUNT): Promise<WaveformData> {
    if (!track || !track.id) {
      return this.generateFallbackEnvelope(track, barCount);
    }

    // 1. Check in-memory / persistent cache
    const cached = this.cache.get(track.id);
    if (cached && cached.peaks && cached.peaks.length > 0) {
      return cached;
    }

    // 2. Check in-flight promise to avoid redundant concurrent decodes
    if (this.pendingPromises.has(track.id)) {
      return this.pendingPromises.get(track.id)!;
    }

    const decodePromise = this.doDecode(track, barCount);
    this.pendingPromises.set(track.id, decodePromise);

    try {
      const result = await decodePromise;
      this.cache.set(track.id, result);
      this.saveCache();
      this.notify(track.id, result);
      return result;
    } finally {
      this.pendingPromises.delete(track.id);
    }
  }

  private async doDecode(track: TrackMetadata, barCount: number): Promise<WaveformData> {
    const filePath = track.filePath || (track as any).path;
    if (!filePath || filePath.startsWith('http://') || filePath.startsWith('https://')) {
      // Remote stream or podcast: use fallback acoustic profile
      return this.generateFallbackEnvelope(track, barCount);
    }

    try {
      const mediaUrl = buildMediaUrl(filePath);
      const res = await fetch(mediaUrl);
      if (!res.ok) {
        throw new Error(`Fetch failed: ${res.statusText}`);
      }

      const arrayBuffer = await res.arrayBuffer();

      // Lazy init AudioContext for decoding
      if (!this.offlineAudioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        this.offlineAudioCtx = new AudioCtxClass();
      }

      const audioBuffer = await this.offlineAudioCtx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);

      const { peaks, rms } = this.downsampleChannel(channelData, barCount);

      return {
        trackId: track.id,
        duration: audioBuffer.duration,
        peaks,
        rms,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        generatedAt: Date.now(),
        isEstimated: false,
      };
    } catch (e) {
      // Decode failed or unsupported codec in browser: gracefully fall back to envelope
      return this.generateFallbackEnvelope(track, barCount);
    }
  }

  public subscribe(cb: (trackId: string, data: WaveformData) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(trackId: string, data: WaveformData): void {
    this.listeners.forEach((cb) => cb(trackId, data));
  }
}

export const waveformService = new WaveformService();
