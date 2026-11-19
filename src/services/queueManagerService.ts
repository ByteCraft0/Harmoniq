import { SavedQueue, DEFAULT_SAVED_QUEUES } from '../types/queue';
import { TrackMetadata } from '../types/audio';
import { libraryService } from './libraryService';

const STORAGE_KEY = 'harmoniq_saved_queues_v1';
const ACTIVE_QUEUE_KEY = 'harmoniq_active_saved_queue_id_v1';

export class QueueManagerService {
  private queues: Map<string, SavedQueue> = new Map();
  private activeQueueId: string | null = null;
  private listeners: Set<(queues: SavedQueue[]) => void> = new Set();

  constructor() {
    this.load();
    if (this.queues.size === 0) {
      this.initializeDefaultQueues();
    }
  }

  private load(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const q of parsed) {
              if (q && q.id) {
                this.queues.set(q.id, q);
              }
            }
          }
        }
        const active = localStorage.getItem(ACTIVE_QUEUE_KEY);
        if (active && this.queues.has(active)) {
          this.activeQueueId = active;
        } else if (this.queues.size > 0) {
          this.activeQueueId = Array.from(this.queues.keys())[0];
        }
      }
    } catch (e) {
      console.warn('Failed to load saved queues:', e);
    }
  }

  private save(): void {
    try {
      const list = Array.from(this.queues.values());
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        if (this.activeQueueId) {
          localStorage.setItem(ACTIVE_QUEUE_KEY, this.activeQueueId);
        }
      }
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.savePersistentData) {
        (window as any).harmoniqApi.savePersistentData(STORAGE_KEY, list).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to persist saved queues:', e);
    }
    this.notify();
  }

  private initializeDefaultQueues(): void {
    const now = Date.now();
    for (let i = 0; i < DEFAULT_SAVED_QUEUES.length; i++) {
      const def = DEFAULT_SAVED_QUEUES[i];
      const id = `queue_${def.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${i + 1}`;
      this.queues.set(id, {
        id,
        name: def.name,
        description: def.description,
        trackIds: [...def.trackIds],
        currentIndex: def.currentIndex,
        isShuffle: def.isShuffle,
        repeatMode: def.repeatMode,
        dateCreated: now,
        dateModified: now,
      });
    }
    this.activeQueueId = Array.from(this.queues.keys())[0];
    this.save();
  }

  private attachTracks(q: SavedQueue): SavedQueue {
    const tracks: TrackMetadata[] = q.trackIds.map((id) => {
      const found = libraryService.getTrack(id);
      if (found) return found;
      return {
        id,
        filePath: id,
        fileName: id,
        fileSize: 0,
        dateModified: Date.now(),
        title: id,
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        duration: 0,
        hasArtwork: false,
        bitrate: 0,
        sampleRate: 44100,
        channels: 2,
        codec: 'UNKNOWN',
        container: 'unknown',
        isLossless: false,
        playCount: 0,
        isFavorite: false,
      };
    });
    return { ...q, tracks };
  }

  public getAllQueues(): SavedQueue[] {
    return Array.from(this.queues.values()).map((q) => this.attachTracks(q));
  }

  public getSavedQueues(): SavedQueue[] {
    return this.getAllQueues();
  }

  public getQueue(id: string): SavedQueue | undefined {
    const q = this.queues.get(id);
    return q ? this.attachTracks(q) : undefined;
  }

  public getActiveQueue(): SavedQueue | null {
    if (!this.activeQueueId) return null;
    return this.getQueue(this.activeQueueId) || null;
  }

  public getActiveQueueId(): string | null {
    return this.activeQueueId;
  }

  public setActiveQueue(id: string): void {
    this.setActiveQueueId(id);
  }

  public setActiveQueueId(id: string): void {
    if (this.queues.has(id)) {
      this.activeQueueId = id;
      this.save();
    }
  }

  public createQueue(
    name: string,
    descriptionOrTracks?: string | (TrackMetadata | string)[],
    initialTrackIds?: (TrackMetadata | string)[]
  ): SavedQueue {
    let desc: string | undefined;
    let rawTracks: (TrackMetadata | string)[] = [];

    if (Array.isArray(descriptionOrTracks)) {
      rawTracks = descriptionOrTracks;
    } else {
      desc = descriptionOrTracks?.trim();
      if (Array.isArray(initialTrackIds)) {
        rawTracks = initialTrackIds;
      }
    }

    const trackIds = rawTracks.map((t) => (typeof t === 'string' ? t : t.id));
    const id = `queue_custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const newQueue: SavedQueue = {
      id,
      name: name.trim() || 'Untitled Queue',
      description: desc,
      trackIds,
      currentIndex: 0,
      isShuffle: false,
      repeatMode: 'all',
      dateCreated: now,
      dateModified: now,
    };

    this.queues.set(id, newQueue);
    this.activeQueueId = id;
    this.save();
    return this.attachTracks(newQueue);
  }

  public addTrackToQueue(queueId: string, track: TrackMetadata | string): boolean {
    const q = this.queues.get(queueId);
    if (!q) return false;
    const trackId = typeof track === 'string' ? track : track.id;
    q.trackIds.push(trackId);
    q.dateModified = Date.now();
    this.save();
    return true;
  }

  public removeTrackFromQueue(queueId: string, index: number): boolean {
    const q = this.queues.get(queueId);
    if (!q || index < 0 || index >= q.trackIds.length) return false;
    q.trackIds.splice(index, 1);
    q.dateModified = Date.now();
    this.save();
    return true;
  }

  public reorderQueueTracks(queueId: string, fromIndex: number, toIndex: number): boolean {
    const q = this.queues.get(queueId);
    if (
      !q ||
      fromIndex < 0 ||
      fromIndex >= q.trackIds.length ||
      toIndex < 0 ||
      toIndex >= q.trackIds.length
    ) {
      return false;
    }
    const [moved] = q.trackIds.splice(fromIndex, 1);
    q.trackIds.splice(toIndex, 0, moved);
    q.dateModified = Date.now();
    this.save();
    return true;
  }

  public renameQueue(id: string, newName: string, newDescription?: string): boolean {
    const q = this.queues.get(id);
    if (!q) return false;
    q.name = newName.trim() || q.name;
    if (newDescription !== undefined) q.description = newDescription.trim();
    q.dateModified = Date.now();
    this.save();
    return true;
  }

  public deleteQueue(id: string): boolean {
    if (!this.queues.has(id)) return false;
    this.queues.delete(id);
    if (this.activeQueueId === id) {
      const remaining = Array.from(this.queues.keys());
      this.activeQueueId = remaining.length > 0 ? remaining[0] : null;
    }
    this.save();
    return true;
  }

  public duplicateQueue(id: string, newName?: string): SavedQueue | null {
    const original = this.queues.get(id);
    if (!original) return null;

    const copyName = newName?.trim() || `${original.name} (Copy)`;
    return this.createQueue(copyName, original.description, [...original.trackIds]);
  }

  public updateQueueTracks(id: string, trackIds: string[], currentIndex?: number): boolean {
    const q = this.queues.get(id);
    if (!q) return false;
    q.trackIds = [...trackIds];
    if (typeof currentIndex === 'number') {
      q.currentIndex = Math.max(0, Math.min(currentIndex, q.trackIds.length - 1));
    }
    q.dateModified = Date.now();
    this.save();
    return true;
  }

  public updateQueueSettings(
    id: string,
    settings: { isShuffle?: boolean; repeatMode?: 'off' | 'all' | 'one' }
  ): boolean {
    const q = this.queues.get(id);
    if (!q) return false;
    if (typeof settings.isShuffle === 'boolean') q.isShuffle = settings.isShuffle;
    if (settings.repeatMode) q.repeatMode = settings.repeatMode;
    q.dateModified = Date.now();
    this.save();
    return true;
  }

  public subscribe(cb: (queues: SavedQueue[]) => void): () => void {
    this.listeners.add(cb);
    cb(this.getAllQueues());
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    const list = this.getAllQueues();
    this.listeners.forEach((cb) => cb(list));
  }
}

export const queueManagerService = new QueueManagerService();
