import { AppView } from '../context/LibraryContext';
import { UnifiedTrack } from './universalMusic';
import { GeneratedPlaylistPreview } from './playlistAssistant';

export type AIProviderId = 'gemini' | 'openai' | 'groq' | 'local';

export type PulseOrbState =
  | 'idle'
  | 'hover'
  | 'listening'
  | 'processing'
  | 'responding'
  | 'error'
  | 'inactive';

export interface AssistantAction {
  id: string;
  label: string;
  actionType: 'navigate' | 'copy' | 'retry' | 'custom';
  target?: AppView;
  payload?: any;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  actions?: AssistantAction[];
  error?: boolean;
  audioPlaying?: boolean;
  discoveryResults?: UnifiedTrack[];
  discoverySummary?: string;
  playlistPreview?: GeneratedPlaylistPreview;
}

export interface AssistantConfig {
  enabled: boolean;
  provider: AIProviderId;
  apiKey?: string;
  model?: string;
  speechEnabled: boolean; // Text-to-speech spoken responses
  speechVoiceUri?: string;
  speechVolume: number; // 0.0 to 1.0
  speechRate: number; // 0.5 to 2.0
  speechLang: string;
  reducedMotion: boolean;
  saveHistory: boolean;
}

export const DEFAULT_ASSISTANT_CONFIG: AssistantConfig = {
  enabled: true,
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-1.5-flash',
  speechEnabled: false,
  speechVolume: 0.85,
  speechRate: 1.0,
  speechLang: 'en-US',
  reducedMotion: false,
  saveHistory: true,
};

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: 'audio' | 'library' | 'ui' | 'system' | 'online';
  keywords: string[];
  summary: string;
  steps?: string[];
  tips?: string[];
  route?: AppView;
  actionLabel?: string;
}

export interface SpeechRecognitionResultState {
  transcript: string;
  isFinal: boolean;
}

// ============================================================================
// Phase 5A.1: Context-Aware Assistant Telemetry & State Models
// ============================================================================

export interface HarmoniqPlaybackContext {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime?: number;
  duration?: number;
  repeatMode?: string;
  shuffleEnabled?: boolean;
}

export interface HarmoniqTrackContext {
  id?: string;
  title: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
  duration?: number;
  source: 'local' | 'online';
  provider?: string;
  isPreview?: boolean;
  playbackCapability?: string;
}

export interface HarmoniqAudioContext {
  format?: string;
  codec?: string;
  bitrate?: number;
  sampleRate?: number;
  bitDepth?: number;
  channels?: number;
  isLossless?: boolean;
  isBitPerfect?: boolean;
  activeDSP?: string[];
}

export interface HarmoniqQueueContext {
  totalTracks: number;
  currentIndex?: number;
  nextTrack?: {
    title: string;
    artist?: string;
  };
}

export interface HarmoniqAssistantContext {
  playback: HarmoniqPlaybackContext;
  currentTrack?: HarmoniqTrackContext;
  audio: HarmoniqAudioContext;
  queue: HarmoniqQueueContext;
  contextTimestamp: number;
}

