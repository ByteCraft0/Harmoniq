import { RadioStation, RadioPlaybackState, RadioStatus } from '../types/online';

const STORAGE_CUSTOM_STATIONS = 'harmoniq_custom_radio_stations_v1';
const STORAGE_FAVORITE_IDS = 'harmoniq_radio_favorites_v1';

export const CURATED_RADIO_STATIONS: RadioStation[] = [
  {
    id: 'soma_groovesalad',
    name: 'SomaFM: Groove Salad',
    streamUrl: 'https://ice2.somafm.com/groovesalad-128-mp3',
    genre: 'Ambient / Chillout',
    country: 'USA',
    bitrate: 128,
    codec: 'MP3',
    logoUrl: 'https://somafm.com/img3/groovesalad-400.jpg',
    description: 'A nicely chilled plate of ambient/downtempo beats and grooves.',
  },
  {
    id: 'soma_dronezone',
    name: 'SomaFM: Drone Zone',
    streamUrl: 'https://ice2.somafm.com/dronezone-128-mp3',
    genre: 'Ambient / Space',
    country: 'USA',
    bitrate: 128,
    codec: 'MP3',
    logoUrl: 'https://somafm.com/img3/dronezone-400.jpg',
    description: 'Served best chilled, safe with most medications. Atmospheric textures.',
  },
  {
    id: 'soma_secretagent',
    name: 'SomaFM: Secret Agent',
    streamUrl: 'https://ice2.somafm.com/secretagent-128-mp3',
    genre: 'Spy / Lounge',
    country: 'USA',
    bitrate: 128,
    codec: 'MP3',
    logoUrl: 'https://somafm.com/img3/secretagent-400.jpg',
    description: 'The soundtrack for your stylish, mysterious life. Spy music and lounge.',
  },
  {
    id: 'soma_indiepop',
    name: 'SomaFM: Indie Pop Rocks!',
    streamUrl: 'https://ice2.somafm.com/indiepop-128-mp3',
    genre: 'Indie Rock',
    country: 'USA',
    bitrate: 128,
    codec: 'MP3',
    logoUrl: 'https://somafm.com/img3/indiepop-400.jpg',
    description: 'New and classic favorite indie pop tracks.',
  },
  {
    id: 'swiss_classic',
    name: 'Radio Swiss Classic',
    streamUrl: 'https://stream.srg-ssr.ch/m/rsc_de/mp3_128',
    genre: 'Classical',
    country: 'Switzerland',
    bitrate: 128,
    codec: 'MP3',
    description: 'Pure classical music without advertising or speech.',
  },
  {
    id: 'swiss_jazz',
    name: 'Radio Swiss Jazz',
    streamUrl: 'https://stream.srg-ssr.ch/m/rsj/mp3_128',
    genre: 'Jazz / Soul',
    country: 'Switzerland',
    bitrate: 128,
    codec: 'MP3',
    description: 'The world of jazz, soul, and blues around the clock.',
  },
  {
    id: 'linn_classical',
    name: 'Linn Classical',
    streamUrl: 'http://radio.linn.co.uk:8004/autodj',
    genre: 'Classical / Audiophile',
    country: 'UK',
    bitrate: 320,
    codec: 'MP3',
    description: 'High-quality audiophile classical broadcast.',
  },
  {
    id: 'linn_jazz',
    name: 'Linn Jazz',
    streamUrl: 'http://radio.linn.co.uk:8000/autodj',
    genre: 'Jazz / Audiophile',
    country: 'UK',
    bitrate: 320,
    codec: 'MP3',
    description: 'Precision jazz recordings streamed in high-fidelity 320kbps.',
  },
];

export class RadioService {
  private audioElement: HTMLAudioElement | null = null;
  private state: RadioPlaybackState = {
    currentStation: null,
    status: 'idle',
    volume: 0.8,
  };
  private listeners: Set<(state: RadioPlaybackState) => void> = new Set();
  private customStations: RadioStation[] = [];
  private favoriteIds: Set<string> = new Set();

  constructor() {
    this.loadPersisted();
    this.initAudio();
  }

  private loadPersisted(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const rawCustom = localStorage.getItem(STORAGE_CUSTOM_STATIONS);
        if (rawCustom) {
          this.customStations = JSON.parse(rawCustom);
        }
        const rawFavs = localStorage.getItem(STORAGE_FAVORITE_IDS);
        if (rawFavs) {
          this.favoriteIds = new Set(JSON.parse(rawFavs));
        }
      }
    } catch (e) {
      console.warn('Failed to load radio preferences:', e);
    }
  }

  private saveCustomStations(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_CUSTOM_STATIONS, JSON.stringify(this.customStations));
      }
    } catch (e) {
      console.warn('Failed to save custom stations:', e);
    }
  }

  private saveFavorites(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_FAVORITE_IDS, JSON.stringify(Array.from(this.favoriteIds)));
      }
    } catch (e) {
      console.warn('Failed to save radio favorites:', e);
    }
  }

  private initAudio(): void {
    if (typeof Audio === 'undefined') return;

    this.audioElement = new Audio();
    this.audioElement.volume = this.state.volume;

    this.audioElement.addEventListener('loadstart', () => {
      this.updateState({ status: 'connecting' });
    });

    this.audioElement.addEventListener('waiting', () => {
      this.updateState({ status: 'buffering' });
    });

    this.audioElement.addEventListener('playing', () => {
      this.updateState({ status: 'playing', errorMessage: undefined });
    });

    this.audioElement.addEventListener('pause', () => {
      if (this.state.status === 'playing') {
        this.updateState({ status: 'idle' });
      }
    });

    this.audioElement.addEventListener('error', () => {
      const err = this.audioElement?.error?.message || 'Failed to connect to stream';
      this.updateState({ status: 'error', errorMessage: err });
    });
  }

  private updateState(partial: Partial<RadioPlaybackState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((cb) => cb(this.state));
  }

  public subscribe(cb: (state: RadioPlaybackState) => void): () => void {
    this.listeners.add(cb);
    cb(this.state);
    return () => this.listeners.delete(cb);
  }

  public getState(): RadioPlaybackState {
    return this.state;
  }

  public getAllStations(): RadioStation[] {
    const all = [...CURATED_RADIO_STATIONS, ...this.customStations];
    return all.map((s) => ({
      ...s,
      isFavorite: this.favoriteIds.has(s.id),
    }));
  }

  public toggleFavorite(stationId: string): void {
    if (this.favoriteIds.has(stationId)) {
      this.favoriteIds.delete(stationId);
    } else {
      this.favoriteIds.add(stationId);
    }
    this.saveFavorites();
    this.updateState({});
  }

  public addCustomStation(station: Omit<RadioStation, 'id' | 'isCustom'>): RadioStation {
    const newStation: RadioStation = {
      ...station,
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      isCustom: true,
    };
    this.customStations.push(newStation);
    this.saveCustomStations();
    this.updateState({});
    return newStation;
  }

  public removeCustomStation(stationId: string): boolean {
    const idx = this.customStations.findIndex((s) => s.id === stationId);
    if (idx !== -1) {
      if (this.state.currentStation?.id === stationId) {
        this.stop();
      }
      this.customStations.splice(idx, 1);
      this.favoriteIds.delete(stationId);
      this.saveCustomStations();
      this.saveFavorites();
      this.updateState({});
      return true;
    }
    return false;
  }

  public playStation(station: RadioStation): void {
    if (!this.audioElement) {
      this.initAudio();
    }
    if (!this.audioElement) return;

    this.audioElement.pause();
    this.audioElement.src = station.streamUrl;
    this.updateState({
      currentStation: station,
      status: 'connecting',
      errorMessage: undefined,
    });

    this.audioElement.play().catch((err) => {
      this.updateState({
        status: 'error',
        errorMessage: err.message || 'Stream playback error',
      });
    });
  }

  public togglePlayPause(): void {
    if (!this.audioElement || !this.state.currentStation) return;
    if (this.state.status === 'playing') {
      this.audioElement.pause();
      this.updateState({ status: 'idle' });
    } else {
      this.audioElement.play().catch((err) => {
        this.updateState({ status: 'error', errorMessage: err.message });
      });
    }
  }

  public stop(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
    }
    this.updateState({ currentStation: null, status: 'idle', errorMessage: undefined });
  }

  public setVolume(vol: number): void {
    const clean = Math.max(0, Math.min(1, vol));
    if (this.audioElement) {
      this.audioElement.volume = clean;
    }
    this.updateState({ volume: clean });
  }
}

export const radioService = new RadioService();
