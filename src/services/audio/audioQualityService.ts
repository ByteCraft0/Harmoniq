import { TrackMetadata, AudioCodec, QualityTier } from '../../types/audio';
import { DSPSettings, LimiterMetrics } from '../../types/dsp';
import {
  TruthfulAudioQualityReport,
  SourceStreamSpecs,
  DecodedStreamSpecs,
  ProcessingPipelineSpecs,
  OutputEndpointSpecs,
  BitPerfectTransparency,
  AudioSourceType,
  MetadataConfidence,
} from '../../types/audioQuality';

export class AudioQualityService {
  public static calculateQualityTier(track: TrackMetadata): QualityTier {
    if (!track.isLossless) {
      if (track.bitrate >= 256) return 'High Quality';
      return 'Standard';
    }

    const isHighBitDepth = track.bitDepth ? track.bitDepth > 16 : false;
    const isHighSampleRate = track.sampleRate > 48000;
    if (isHighBitDepth || isHighSampleRate) return 'Hi-Res Lossless';

    return 'Lossless';
  }

  public static getCodecDetail(codec: AudioCodec): string {
    switch (codec) {
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
        return `${codec} Audio Stream`;
    }
  }

  public static getChannelLayout(channels: number): string {
    if (channels === 1) return 'Mono';
    if (channels === 2) return 'Stereo';
    if (channels === 6) return '5.1 Surround';
    if (channels === 8) return '7.1 Surround';
    return `${channels} Channels`;
  }

  public static determineSourceType(track: TrackMetadata): AudioSourceType {
    if (track.playbackCapability === 'preview') return 'preview';
    if (track.genre?.toLowerCase().includes('podcast')) return 'podcast';
    if (track.genre?.toLowerCase().includes('radio')) return 'radio';
    if (track.isOnline) return 'full_stream';
    return 'local';
  }

  public static generateReport(
    track: TrackMetadata | null | undefined,
    audioCtx: AudioContext | null,
    dspSettings: DSPSettings,
    limiterMetrics: LimiterMetrics,
    volume: number,
    replayGainActive: boolean,
    activeDeviceLabel = 'Default Windows Audio Endpoint'
  ): TruthfulAudioQualityReport | null {
    if (!track) return null;

    const outputSampleRateHz = audioCtx?.sampleRate || 48000;
    const baseLatency = typeof (audioCtx as any)?.baseLatency === 'number' && (audioCtx as any).baseLatency > 0
      ? (audioCtx as any).baseLatency
      : undefined;
    const outputLatency = typeof (audioCtx as any)?.outputLatency === 'number' && (audioCtx as any).outputLatency > 0
      ? (audioCtx as any).outputLatency
      : 0;

    const bufferSizeSamples = baseLatency !== undefined
      ? Math.round(baseLatency * outputSampleRateHz)
      : 512;
    const latencyMs = baseLatency !== undefined
      ? Math.round((baseLatency + outputLatency) * 1000 * 10) / 10
      : Math.round(((512 / outputSampleRateHz) * 1000) * 10) / 10;

    const isLossless = !!track.isLossless;
    const qualityTier = this.calculateQualityTier(track);
    const sourceType = this.determineSourceType(track);
    const metadataConfidence: MetadataConfidence = track.sampleRate > 0 && track.bitrate > 0 ? 'verified' : 'estimated';

    // 1. Source Specifications
    const source: SourceStreamSpecs = {
      codec: track.codec,
      codecDetail: this.getCodecDetail(track.codec),
      container: track.container || track.codec.toLowerCase(),
      bitrateKbps: track.bitrate || 0,
      sampleRateHz: track.sampleRate || 44100,
      bitDepthBits: isLossless ? track.bitDepth : undefined, // Lossy codecs do not have discrete PCM bit depth
      channels: track.channels || 2,
      channelLayout: this.getChannelLayout(track.channels || 2),
      isLossless,
      qualityTier,
      sourceType,
      metadataConfidence,
    };

    // 2. Decoded Specifications
    const decoded: DecodedStreamSpecs = {
      decodedSampleRateHz: track.sampleRate || outputSampleRateHz,
      decodedChannels: track.channels || 2,
      bufferSizeSamples,
    };

    // 3. Processing Pipeline Specifications
    const activeDspStages: string[] = [];
    if (dspSettings.enabled) {
      if (dspSettings.eqMode === 'graphic') {
        const activeGraphic = dspSettings.bands.filter((b) => Math.abs(b) >= 0.1).length;
        if (activeGraphic > 0) activeDspStages.push(`10-Band Graphic EQ (${activeGraphic} active bands)`);
      } else {
        const activeParametric = dspSettings.parametricFilters.filter((f) => f.enabled).length;
        if (activeParametric > 0) activeDspStages.push(`Parametric EQ Studio (${activeParametric} active filters)`);
      }

      if (Math.abs(dspSettings.preamp) >= 0.1) activeDspStages.push(`Preamp (${dspSettings.preamp > 0 ? '+' : ''}${dspSettings.preamp.toFixed(1)} dB)`);
      if (Math.abs(dspSettings.bassBoost) >= 0.1) activeDspStages.push(`Bass Boost (+${dspSettings.bassBoost.toFixed(1)} dB)`);
      if (Math.abs(dspSettings.treble) >= 0.1) activeDspStages.push(`Treble (${dspSettings.treble > 0 ? '+' : ''}${dspSettings.treble.toFixed(1)} dB)`);
      if (dspSettings.stereoWidthEnabled && Math.abs((dspSettings.stereoWidth ?? 100) - 100) > 1) {
        activeDspStages.push(`Mid-Side Stereo Width (${dspSettings.stereoWidth}%)`);
      }
      if (dspSettings.channelMode && dspSettings.channelMode !== 'stereo') {
        activeDspStages.push(`Channel Matrix (${dspSettings.channelMode})`);
      }
      if (dspSettings.limiterEnabled && limiterMetrics.isClippingPrevented) {
        activeDspStages.push(`Anti-Clipping Limiter (-${limiterMetrics.gainReductionDb.toFixed(1)} dB reduction)`);
      }
    }

    const isResampling = (track.sampleRate || 44100) !== outputSampleRateHz;
    let resamplingExplanation = 'Source sample rate matches output hardware rate. No resampling needed.';
    if (isResampling) {
      resamplingExplanation = `Resampling active: Source (${((track.sampleRate || 44100) / 1000).toFixed(1)} kHz) is converted to ${outputSampleRateHz / 1000} kHz by Chromium Audio Renderer.`;
    }

    const processing: ProcessingPipelineSpecs = {
      isDspEnabled: dspSettings.enabled && activeDspStages.length > 0,
      activeDspStages,
      isResampling,
      sourceSampleRateHz: track.sampleRate || 44100,
      outputSampleRateHz,
      resamplingExplanation,
      preampDb: dspSettings.preamp,
      replayGainApplied: replayGainActive,
      limiterActive: limiterMetrics.isClippingPrevented,
    };

    // 4. Output Endpoint Specifications (Truthful description: Windows Shared Mode)
    const output: OutputEndpointSpecs = {
      deviceName: activeDeviceLabel,
      driverMode: 'Windows Shared Mode (WASAPI Shared) via Chromium Audio Engine',
      outputSampleRateHz,
      outputChannels: 2,
      latencyMs,
    };

    // 5. Truthful Bit-Perfect Transparency Check
    const bitPerfectReasons: string[] = [];
    if (!isLossless) {
      bitPerfectReasons.push(`Lossy Source: ${track.codec} compression discards psychoacoustic frequency components.`);
    }
    if (isResampling) {
      bitPerfectReasons.push(`Sample Rate Conversion: Source ${(track.sampleRate / 1000).toFixed(1)} kHz resampled to ${outputSampleRateHz / 1000} kHz.`);
    }
    if (Math.abs(volume - 1.0) > 0.005) {
      bitPerfectReasons.push(`Digital Volume Attenuation: Current volume at ${Math.round(volume * 100)}% (100% required for bit-perfect unity).`);
    }
    if (processing.isDspEnabled) {
      bitPerfectReasons.push(`Active DSP Processing: ${activeDspStages.join(', ')}.`);
    }
    if (replayGainActive) {
      bitPerfectReasons.push('ReplayGain volume normalization is actively scaling digital sample values.');
    }
    // Shared Mode mixer explanation
    bitPerfectReasons.push('Windows Shared Mode: Audio is processed through the Windows audio mixer rather than hardware exclusive lock.');

    let status: 'active' | 'resampled' | 'processed' | 'shared_mode' | 'lossy_source' = 'shared_mode';
    let explanation = 'Audio is routed through Windows Shared Mode. Audio stream is high-fidelity but not bit-perfect due to system mixing.';

    if (!isLossless) {
      status = 'lossy_source';
      explanation = 'Source audio is lossy perceptual audio (MP3/AAC/OGG). Bit-perfect transmission is not applicable.';
    } else if (processing.isDspEnabled) {
      status = 'processed';
      explanation = 'Audio is actively shaped by Equalizer and DSP stages.';
    } else if (isResampling) {
      status = 'resampled';
      explanation = 'Audio sample rate is resampled to match output hardware endpoint.';
    }

    const bitPerfect: BitPerfectTransparency = {
      isBitPerfect: false, // Truthful: Web Audio API on Chromium Windows shared mode does not bypass the OS mixer
      status,
      explanation,
      reasons: bitPerfectReasons,
    };

    return {
      timestamp: Date.now(),
      source,
      decoded,
      processing,
      output,
      bitPerfect,
    };
  }
}
