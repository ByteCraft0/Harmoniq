import { RadioStation } from '../types/radio';
import { TrackMetadata } from '../types/audio';
import { radioDirectoryService } from './radioDirectoryService';

export const STORAGE_RADIO_FAVORITES_KEY = 'harmoniq_mobile_radio_favorites';
export const STORAGE_RADIO_RECENT_KEY = 'harmoniq_mobile_radio_recent';
export const STORAGE_RADIO_CUSTOM_KEY = 'harmoniq_mobile_radio_custom_stations';

type RadioChangeListener = () => void;

export class MobileRadioService {
  private listeners = new Set<RadioChangeListener>();

  public subscribe(listener: RadioChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('MobileRadioService listener error:', err);
      }
    });
  }

  // --- 1. FAVORITES MANAGEMENT ---

  public getFavorites(): RadioStation[] {
    try {
      const raw = localStorage.getItem(STORAGE_RADIO_FAVORITES_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  public isFavorite(stationId: string): boolean {
    if (!stationId) return false;
    const favs = this.getFavorites();
    return favs.some((s) => s.id === stationId);
  }

  public addFavorite(station: RadioStation): void {
    if (!station || !station.id) return;
    const favs = this.getFavorites().filter((s) => s.id !== station.id);
    favs.unshift({ ...station, isFavorite: true });
    try {
      localStorage.setItem(STORAGE_RADIO_FAVORITES_KEY, JSON.stringify(favs));
      this.notify();
    } catch (e) {
      console.warn('Failed to save radio favorites:', e);
    }
  }

  public removeFavorite(stationId: string): void {
    if (!stationId) return;
    const favs = this.getFavorites().filter((s) => s.id !== stationId);
    try {
      localStorage.setItem(STORAGE_RADIO_FAVORITES_KEY, JSON.stringify(favs));
      this.notify();
    } catch (e) {
      console.warn('Failed to remove radio favorite:', e);
    }
  }

  public toggleFavorite(station: RadioStation): boolean {
    if (this.isFavorite(station.id)) {
      this.removeFavorite(station.id);
      return false;
    } else {
      this.addFavorite(station);
      return true;
    }
  }

  // --- 2. RECENTLY LISTENED HISTORY ---

  public getRecentlyPlayed(limit: number = 30): RadioStation[] {
    try {
      const raw = localStorage.getItem(STORAGE_RADIO_RECENT_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list.slice(0, limit) : [];
    } catch {
      return [];
    }
  }

  public recordPlay(station: RadioStation): void {
    if (!station || !station.id) return;
    const recent = this.getRecentlyPlayed(50).filter((s) => s.id !== station.id);
    const updatedStation: RadioStation = {
      ...station,
      lastPlayed: Date.now(),
      isFavorite: this.isFavorite(station.id),
    };
    recent.unshift(updatedStation);
    try {
      localStorage.setItem(STORAGE_RADIO_RECENT_KEY, JSON.stringify(recent));
      this.notify();
    } catch (e) {
      console.warn('Failed to record radio playback:', e);
    }
  }

  public clearRecent(): void {
    try {
      localStorage.removeItem(STORAGE_RADIO_RECENT_KEY);
      this.notify();
    } catch {}
  }

  // --- 3. CUSTOM STATION MANAGEMENT ---

  public getCustomStations(): RadioStation[] {
    try {
      const raw = localStorage.getItem(STORAGE_RADIO_CUSTOM_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  public addCustomStation(params: {
    name: string;
    streamUrl: string;
    favicon?: string;
    country?: string;
    genre?: string;
  }): { station?: RadioStation; error?: string } {
    const val = radioDirectoryService.validateStreamUrl(params.streamUrl);
    if (!val.valid) {
      return { error: val.error || 'Invalid stream URL.' };
    }

    const trimmedName = (params.name || '').trim();
    if (!trimmedName) {
      return { error: 'Station name is required.' };
    }

    const customStations = this.getCustomStations();
    const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newStation: RadioStation = {
      id,
      name: trimmedName,
      streamUrl: params.streamUrl.trim(),
      favicon: params.favicon && params.favicon.startsWith('http') ? params.favicon.trim() : undefined,
      country: params.country?.trim() || 'Custom',
      countryCode: 'CUSTOM',
      tags: params.genre ? [params.genre.trim().toLowerCase()] : ['custom'],
      codec: params.streamUrl.includes('.aac') ? 'AAC' : params.streamUrl.includes('.m3u8') ? 'HLS' : 'MP3',
      bitrate: 128,
      votes: 1,
      isCustom: true,
    };

    customStations.unshift(newStation);
    try {
      localStorage.setItem(STORAGE_RADIO_CUSTOM_KEY, JSON.stringify(customStations));
      this.notify();
      return { station: newStation };
    } catch (e: any) {
      return { error: e?.message || 'Failed to persist custom station.' };
    }
  }

  public removeCustomStation(stationId: string): void {
    const list = this.getCustomStations().filter((s) => s.id !== stationId);
    try {
      localStorage.setItem(STORAGE_RADIO_CUSTOM_KEY, JSON.stringify(list));
      this.removeFavorite(stationId);
      this.notify();
    } catch {}
  }

  // --- 4. CONVERSION TO TRACK METADATA ---

  public stationToTrackMetadata(station: RadioStation): TrackMetadata {
    const isFav = this.isFavorite(station.id);
    const countryTag = station.country ? `${station.country} • LIVE RADIO` : 'LIVE RADIO';
    const genreTag = station.tags && station.tags.length > 0
      ? station.tags.slice(0, 3).map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' / ')
      : 'Internet Radio';

    return {
      id: `radio_${station.id}`,
      filePath: station.streamUrl,
      fileName: `${station.name}.stream`,
      fileSize: 0,
      dateModified: Date.now(),
      dateAdded: Date.now(),
      title: station.name,
      artist: countryTag,
      album: genreTag,
      albumArtist: 'Harmoniq Live Radio',
      genre: station.tags[0] || 'Radio',
      duration: 0, // Live stream: duration is 0
      codec: (station.codec?.toUpperCase() as any) || 'MP3',
      container: station.streamUrl.includes('.m3u8') ? 'hls' : 'stream',
      sampleRate: 44100,
      bitrate: station.bitrate || 128,
      channels: 2,
      isLossless: false,
      playCount: 0,
      isFavorite: isFav,
      isOnline: true,
      hasArtwork: Boolean(station.favicon),
      artworkDataUrl: station.favicon,
    };
  }

  public isRadioTrack(track: TrackMetadata | null): boolean {
    if (!track) return false;
    return (
      track.id.startsWith('radio_') ||
      track.filePath.startsWith('http://') ||
      track.filePath.startsWith('https://') ||
      track.artist.includes('LIVE RADIO')
    );
  }
}

export const mobileRadioService = new MobileRadioService();
