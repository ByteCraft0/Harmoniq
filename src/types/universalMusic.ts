import { TrackMetadata, AudioCodec } from './audio';

export type ProviderId =
  | 'local'
  | 'jamendo'
  | 'audius'
  | 'archive'
  | 'apple'
  | 'youtube'
  | 'spotify';

export type PlaybackCapability =
  | 'full_stream'    // Authorized full-length direct audio stream (Jamendo, Audius, Archive.org)
  | 'preview_stream' // Authorized 30-second audio preview (Apple / iTunes)
  | 'external_embed' // Authorized external embedded player (YouTube iframe)
  | 'local_file';    // Local storage file

export interface UnifiedTrack {
  id: string; // Unique provider-prefixed identifier, e.g. "jamendo:1928374", "audius:abc123"
  providerId: ProviderId;
  providerTrackId: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  artworkUrl?: string;
  genre?: string;
  releaseYear?: number;
  playbackCapability: PlaybackCapability;
  streamUrl?: string;
  format?: string; // 'MP3', 'AAC', 'FLAC', etc. (only when verified)
  bitrate?: number; // in kbps (e.g. 128, 256, 320, only when verified)
  license?: string; // e.g. "Creative Commons BY-SA 4.0", "Public Domain", "Copyright / 30s Preview"
  attributionText?: string;
  providerWebUrl?: string;
  streamExpiresAt?: number;
  isOnline: boolean;
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  displayName: string;
  enabled: boolean;
  requiresAuth: boolean;
  hasAuthKey: boolean;
  defaultCapability: PlaybackCapability;
  description: string;
  rateLimitDelayMs?: number;
}

export interface ProviderSearchOptions {
  filter?: 'all' | 'song' | 'artist' | 'album';
  limit?: number;
  signal?: AbortSignal;
  genre?: string;
}

export interface ProviderSearchResponse {
  providerId: ProviderId;
  success: boolean;
  tracks: UnifiedTrack[];
  totalFound?: number;
  errorMessage?: string;
  durationMs: number;
}

export interface UniversalSearchResponse {
  query: string;
  filter: 'all' | 'song' | 'artist' | 'album';
  results: UnifiedTrack[];
  localResults: UnifiedTrack[];
  providerResponses: Record<string, ProviderSearchResponse>;
  totalResults: number;
  cached: boolean;
  searchedAt: number;
}

export interface MusicProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly defaultCapability: PlaybackCapability;
  isAvailable(): Promise<boolean>;
  search(query: string, options?: ProviderSearchOptions): Promise<ProviderSearchResponse>;
  normalize(raw: unknown): UnifiedTrack | null;
}

/**
 * Converts a UnifiedTrack into Harmoniq's core TrackMetadata model.
 * Enables online tracks to be played, queued, displayed in the Mini Player,
 * and routed through the 32-bit Web Audio DSP pipeline without breaking changes.
 */
export function unifiedTrackToTrackMetadata(ut: UnifiedTrack): TrackMetadata {
  const safeCodec: AudioCodec =
    ut.format?.toUpperCase() === 'FLAC'
      ? 'FLAC'
      : ut.format?.toUpperCase() === 'AAC'
      ? 'AAC'
      : ut.format?.toUpperCase() === 'OGG'
      ? 'OGG'
      : ut.format?.toUpperCase() === 'WAV'
      ? 'WAV'
      : 'MP3';

  const metadata: TrackMetadata = {
    id: ut.id,
    filePath: ut.streamUrl || ut.providerWebUrl || '',
    fileName: `${ut.artist} - ${ut.title}`,
    fileSize: 0,
    dateModified: Date.now(),
    dateAdded: Date.now(),
    title: ut.title || 'Untitled Track',
    artist: ut.artist || 'Unknown Artist',
    album: ut.album || (ut.isOnline ? `${ut.providerId.toUpperCase()} Stream` : 'Unknown Album'),
    genre: ut.genre || undefined,
    year: ut.releaseYear || undefined,
    duration: Math.max(0, ut.duration || 0),
    hasArtwork: Boolean(ut.artworkUrl),
    artworkDataUrl: ut.artworkUrl,
    codec: safeCodec,
    container: ut.format || 'stream',
    sampleRate: 44100,
    bitrate: ut.bitrate || 128,
    channels: 2,
    isLossless: safeCodec === 'FLAC' || safeCodec === 'WAV',
    playCount: 0,
    isFavorite: false,
  };

  // Attach online metadata descriptors onto the object for UI inspectors
  (metadata as any).isOnline = ut.isOnline;
  (metadata as any).providerId = ut.providerId;
  (metadata as any).providerTrackId = ut.providerTrackId;
  (metadata as any).playbackCapability = ut.playbackCapability;
  (metadata as any).providerWebUrl = ut.providerWebUrl;
  (metadata as any).attributionText = ut.attributionText;
  (metadata as any).license = ut.license;

  return metadata;
}

/**
 * Converts a local library TrackMetadata item into a UnifiedTrack representation.
 */
export function trackMetadataToUnifiedTrack(track: TrackMetadata): UnifiedTrack {
  const isOnline = Boolean((track as any).isOnline || /^https?:\/\//i.test(track.filePath));
  const providerId: ProviderId = (track as any).providerId || (isOnline ? 'audius' : 'local');
  const providerTrackId = (track as any).providerTrackId || track.id.replace(/^[a-z]+:/i, '');
  const playbackCap: PlaybackCapability =
    (track as any).playbackCapability || (isOnline ? 'full_stream' : 'local_file');

  return {
    id: track.id,
    providerId,
    providerTrackId,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    artworkUrl: track.artworkDataUrl,
    genre: track.genre,
    releaseYear: track.year,
    playbackCapability: playbackCap,
    streamUrl: track.filePath,
    format: track.codec,
    bitrate: track.bitrate,
    license: (track as any).license || (isOnline ? 'Online Authorized Audio' : 'Local Media File'),
    attributionText: (track as any).attributionText || `${track.artist} (${isOnline ? providerId : 'Local File'})`,
    providerWebUrl: (track as any).providerWebUrl,
    isOnline,
  };
}
