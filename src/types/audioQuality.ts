import { AudioCodec, QualityTier } from './audio';

export type AudioSourceType =
  | 'local'
  | 'full_stream'
  | 'preview'
  | 'podcast'
  | 'radio';

export type MetadataConfidence = 'verified' | 'estimated' | 'unknown';

export interface SourceStreamSpecs {
  codec: AudioCodec;
  codecDetail: string;
  container: string;
  bitrateKbps: number;
  sampleRateHz: number;
  bitDepthBits?: number; // In bits. Undefined / null for perceptual lossy audio
  channels: number;
  channelLayout: string;
  isLossless: boolean;
  qualityTier: QualityTier;
  sourceType: AudioSourceType;
  metadataConfidence: MetadataConfidence;
}

export interface DecodedStreamSpecs {
  decodedSampleRateHz: number;
  decodedChannels: number;
  bufferSizeSamples: number;
}

export interface ProcessingPipelineSpecs {
  isDspEnabled: boolean;
  activeDspStages: string[];
  isResampling: boolean;
  sourceSampleRateHz: number;
  outputSampleRateHz: number;
  resamplingExplanation: string;
  preampDb: number;
  replayGainApplied: boolean;
  limiterActive: boolean;
}

export interface OutputEndpointSpecs {
  deviceName: string;
  driverMode: string;
  outputSampleRateHz: number;
  outputChannels: number;
  latencyMs: number;
}

export interface BitPerfectTransparency {
  isBitPerfect: boolean;
  status: 'active' | 'resampled' | 'processed' | 'shared_mode' | 'lossy_source';
  explanation: string;
  reasons: string[];
}

export interface TruthfulAudioQualityReport {
  timestamp: number;
  source: SourceStreamSpecs;
  decoded: DecodedStreamSpecs;
  processing: ProcessingPipelineSpecs;
  output: OutputEndpointSpecs;
  bitPerfect: BitPerfectTransparency;
}
