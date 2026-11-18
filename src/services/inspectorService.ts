import { TrackMetadata, QualityTier } from '../types/audio';
import { DSPSettings, LimiterMetrics } from '../types/dsp';
import { InspectionReport, AudioStreamSpecs, AudioOutputSpecs, ResamplingDiagnosis, BitPerfectCheck } from '../types/inspector';

export class AudioQualityInspectorService {
  /**
   * Determine truthful quality tier based on real stream metadata, NOT file extension
   */
  public static calculateQualityTier(track: TrackMetadata): QualityTier {
    if (!track.isLossless) {
      if (track.bitrate >= 256) {
        return 'High Quality';
      }
      return 'Standard';
    }

    // For lossless audio (FLAC, ALAC, WAV, AIFF)
    const isHighBitDepth = track.bitDepth ? track.bitDepth > 16 : false;
    const isHighSampleRate = track.sampleRate > 48000;

    if (isHighBitDepth || isHighSampleRate) {
      return 'Hi-Res Lossless';
    }

    return 'Lossless';
  }

  /**
   * Format human-readable codec details
   */
  public static getCodecDetail(track: TrackMetadata): string {
    switch (track.codec) {
      case 'FLAC':
        return 'Free Lossless Audio Codec (FLAC)';
      case 'ALAC':
        return 'Apple Lossless Audio Codec (ALAC)';
      case 'WAV':
        return 'Linear PCM (WAVE)';
      case 'AIFF':
        return 'Audio Interchange File Format (AIFF)';
      case 'MP3':
        return 'MPEG-1 Audio Layer III (MP3)';
      case 'AAC':
        return 'Advanced Audio Coding (AAC-LC)';
      case 'OPUS':
        return 'Opus Interactive Audio Codec';
      case 'OGG':
        return 'Ogg Vorbis';
      default:
        return `${track.codec} Audio Stream`;
    }
  }

  /**
   * Determine channel layout string
   */
  public static getChannelLayout(channels: number): 'Mono' | 'Stereo' | '5.1 Surround' | '7.1 Surround' | 'Multichannel' {
    if (channels === 1) return 'Mono';
    if (channels === 2) return 'Stereo';
    if (channels === 6) return '5.1 Surround';
    if (channels === 8) return '7.1 Surround';
    return 'Multichannel';
  }

  /**
   * Generate complete, real-time diagnostic inspection report
   */
  public static inspectCurrentPlayback(
    track: TrackMetadata | null,
    audioCtx: AudioContext | null,
    dspSettings: DSPSettings,
    limiterMetrics: LimiterMetrics,
    volume: number,
    replayGainActive: boolean,
    activeDeviceLabel = 'Default Windows Audio Endpoint',
    isExclusiveRequested = false
  ): InspectionReport | null {
    if (!track) return null;

    const qualityTier = this.calculateQualityTier(track);
    const outputSampleRate = audioCtx?.sampleRate || 48000;
    const outputBitDepth = 24; // Standard Windows Audio Engine 24/32-bit float pipeline

    // 1. Source File Specs
    const source: AudioStreamSpecs = {
      codec: track.codec,
      codecDetail: this.getCodecDetail(track),
      container: track.container || track.codec,
      bitrateKbps: track.bitrate,
      sampleRateHz: track.sampleRate,
      bitDepthBits: track.bitDepth,
      channels: track.channels,
      channelLayout: this.getChannelLayout(track.channels),
      durationSec: track.duration,
      fileSizeBytes: track.fileSize,
      isLossless: track.isLossless,
      filePath: track.filePath,
      qualityTier,
    };

    // 2. Output Device Specs
    const output: AudioOutputSpecs = {
      deviceName: activeDeviceLabel,
      driverMode: isExclusiveRequested ? 'WASAPI Exclusive' : 'WASAPI Shared',
      outputSampleRateHz: outputSampleRate,
      outputBitDepthBits: outputBitDepth,
      isExclusiveSupported: true,
      isExclusiveActive: isExclusiveRequested,
      systemMixerSampleRateHz: 48000,
      bufferSizeSamples: 512,
      latencyMs: Math.round(((512 / outputSampleRate) * 1000) * 10) / 10,
    };

    // 3. Resampling Analysis
    const isResampling = track.sampleRate !== outputSampleRate;
    let resamplingExplanation = 'No resampling required: Source sample rate matches output hardware rate.';
    if (isResampling) {
      resamplingExplanation = `Resampling active: Source audio (${(track.sampleRate / 1000).toFixed(1)} kHz) is resampled to ${(outputSampleRate / 1000).toFixed(1)} kHz by Windows Audio Engine.`;
    }

    const resampling: ResamplingDiagnosis = {
      isResampling,
      sourceSampleRateHz: track.sampleRate,
      targetSampleRateHz: outputSampleRate,
      reason: isResampling ? 'Sample rate mismatch between source stream and output endpoint format' : undefined,
      explanation: resamplingExplanation,
    };

    // 4. Bit-Perfect Verification
    const bitPerfectReasons: string[] = [];
    const sampleRateMatched = !isResampling;
    const volumeUnity = Math.abs(volume - 1.0) < 0.001;
    
    // Check if DSP is actively altering audio
    const isBypassed = !dspSettings.enabled;
    const isFlat =
      dspSettings.bands.every((b) => Math.abs(b) < 0.1) &&
      Math.abs(dspSettings.preamp) < 0.1 &&
      Math.abs(dspSettings.bassBoost) < 0.1 &&
      Math.abs(dspSettings.treble) < 0.1 &&
      Math.abs(dspSettings.balance) < 0.01 &&
      !dspSettings.monoMix;

    const dspClean = isBypassed || isFlat;
    const replayGainClean = !replayGainActive;
    const exclusiveModeActive = isExclusiveRequested;

    if (!sampleRateMatched) {
      bitPerfectReasons.push(`Sample Rate Mismatch (${track.sampleRate} Hz source vs ${outputSampleRate} Hz output)`);
    }
    if (!volumeUnity) {
      bitPerfectReasons.push(`Digital Volume Attenuation active (${Math.round(volume * 100)}% instead of 100% Unity Gain)`);
    }
    if (!dspClean) {
      bitPerfectReasons.push('Equalizer or tone controls are actively modifying frequency spectrum');
    }
    if (!replayGainClean) {
      bitPerfectReasons.push('ReplayGain volume normalization is actively applying gain correction');
    }
    if (!exclusiveModeActive) {
      bitPerfectReasons.push('Windows Shared Mode mixer (WASAPI Shared) mixes streams through the Windows Audio Engine');
    }

    const isBitPerfect =
      track.isLossless &&
      sampleRateMatched &&
      volumeUnity &&
      dspClean &&
      replayGainClean &&
      exclusiveModeActive;

    const bitPerfect: BitPerfectCheck = {
      isBitPerfect,
      sampleRateMatched,
      volumeUnity,
      dspBypassed: dspClean,
      replayGainDisabled: replayGainClean,
      exclusiveModeActive,
      reasons: bitPerfectReasons,
    };

    // Count active non-zero filters
    const activeFiltersCount = dspSettings.enabled
      ? dspSettings.bands.filter((b) => Math.abs(b) >= 0.1).length +
        (Math.abs(dspSettings.bassBoost) >= 0.1 ? 1 : 0) +
        (Math.abs(dspSettings.treble) >= 0.1 ? 1 : 0)
      : 0;

    return {
      timestamp: Date.now(),
      source,
      output,
      resampling,
      bitPerfect,
      dspStatus: {
        isBypassed: !dspSettings.enabled,
        activeFiltersCount,
        preampDb: dspSettings.preamp,
        bassBoostDb: dspSettings.bassBoost,
        trebleDb: dspSettings.treble,
        limiterActive: limiterMetrics.isClippingPrevented,
      },
    };
  }
}
