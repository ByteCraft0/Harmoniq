import { QualityTier, AudioCodec } from './audio';

export interface AudioStreamSpecs {
  codec: AudioCodec;
  codecDetail: string; // e.g. "FLAC (Free Lossless Audio Codec)", "MP3 Layer III"
  container: string; // e.g. "FLAC", "MPEG", "M4A / QuickTime", "RIFF / WAVE"
  bitrateKbps: number;
  sampleRateHz: number;
  bitDepthBits?: number;
  channels: number;
  channelLayout: 'Mono' | 'Stereo' | '5.1 Surround' | '7.1 Surround' | 'Multichannel';
  durationSec: number;
  fileSizeBytes: number;
  isLossless: boolean;
  filePath: string;
  qualityTier: QualityTier;
}

export interface AudioOutputSpecs {
  deviceName: string;
  driverMode: 'WASAPI Shared' | 'WASAPI Exclusive' | 'ASIO' | 'Default Device';
  outputSampleRateHz: number;
  outputBitDepthBits: number;
  isExclusiveSupported: boolean;
  isExclusiveActive: boolean;
  systemMixerSampleRateHz: number;
  bufferSizeSamples: number;
  latencyMs: number;
}

export interface BitPerfectCheck {
  isBitPerfect: boolean;
  sampleRateMatched: boolean;
  volumeUnity: boolean; // Volume is at 100% (0 dB)
  dspBypassed: boolean; // EQ & tone controls bypassed or flat
  replayGainDisabled: boolean; // ReplayGain is off or 0 dB gain
  exclusiveModeActive: boolean; // Device in exclusive mode to bypass Windows audio engine
  reasons: string[]; // Explanations if not bit-perfect
}

export interface ResamplingDiagnosis {
  isResampling: boolean;
  sourceSampleRateHz: number;
  targetSampleRateHz: number;
  reason?: string;
  explanation: string;
}

export interface InspectionReport {
  timestamp: number;
  source: AudioStreamSpecs;
  output: AudioOutputSpecs;
  resampling: ResamplingDiagnosis;
  bitPerfect: BitPerfectCheck;
  dspStatus: {
    isBypassed: boolean;
    activeFiltersCount: number;
    preampDb: number;
    bassBoostDb: number;
    trebleDb: number;
    limiterActive: boolean;
  };
}
