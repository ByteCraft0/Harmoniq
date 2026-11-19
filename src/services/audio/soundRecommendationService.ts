import { TrackMetadata } from '../../types/audio';
import { soundProfileService } from './soundProfileService';
import { audioEngine } from '../audioEngine';
import { DSPSettings } from '../../types/dsp';
import { SoundProfile } from '../../types/soundProfile';

export interface SoundRecommendation {
  id: string;
  targetProfileId: string;
  targetProfile: SoundProfile;
  title: string;
  rationale: string;
  confidence: number; // 0.0 - 1.0
  category: 'device' | 'genre' | 'acoustic';
  deviceContext?: string;
  genreContext?: string;
}

function profileToDSPSettings(profile: SoundProfile): DSPSettings {
  return {
    enabled: true,
    eqMode: profile.mode,
    bands: [...profile.bands],
    parametricFilters: profile.parametricFilters.map((f) => ({ ...f })),
    preamp: profile.preamp,
    bassBoost: profile.bassBoost,
    treble: profile.treble,
    stereoWidth: profile.stereoWidth,
    stereoWidthEnabled: profile.stereoWidthEnabled,
    channelMode: profile.channelMode,
    monoMix: profile.channelMode === 'mono',
    activePresetId: profile.id,
    balance: 0,
    limiterEnabled: true,
  };
}

export class SoundRecommendationService {
  private originalSettingsBeforeAudition: DSPSettings | null = null;
  private auditioningRecommendationId: string | null = null;
  private listeners: Set<() => void> = new Set();

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    this.listeners.forEach((cb) => cb());
  }

  public getAuditioningId(): string | null {
    return this.auditioningRecommendationId;
  }

  /**
   * Recommend a sound profile tailored to the current track and audio device
   */
  public getRecommendationForContext(
    track: TrackMetadata | null,
    deviceLabel = ''
  ): SoundRecommendation | null {
    const profiles = soundProfileService.getAllProfiles();
    if (profiles.length === 0) return null;

    const lowerDevice = (deviceLabel || '').toLowerCase();
    const isHeadphones =
      lowerDevice.includes('headphone') ||
      lowerDevice.includes('airpod') ||
      lowerDevice.includes('wh-1000') ||
      lowerDevice.includes('buds') ||
      lowerDevice.includes('iem') ||
      lowerDevice.includes('ear') ||
      lowerDevice.includes('sennheiser');

    const isSpeakers =
      lowerDevice.includes('speaker') ||
      lowerDevice.includes('realtek') ||
      lowerDevice.includes('line out') ||
      lowerDevice.includes('monitor');

    const genre = (track?.genre || '').toLowerCase();

    // 1. Genre-specific contextual recommendations
    if (genre.includes('acoustic') || genre.includes('folk') || genre.includes('singer')) {
      const target =
        soundProfileService.getProfileById('vocal_acoustic') ||
        soundProfileService.getProfileById('acoustic_clarity') ||
        profiles[0];
      return {
        id: `rec_genre_${target.id}`,
        targetProfileId: target.id,
        targetProfile: target,
        title: 'Acoustic & Vocal Warmth',
        rationale: `Tailored for ${track?.genre || 'Acoustic'} recordings. Enhances natural vocal presence, string timber, and upper harmonic decay without harshness.`,
        confidence: 0.92,
        category: 'genre',
        genreContext: track?.genre,
      };
    }

    if (genre.includes('hip-hop') || genre.includes('rap') || genre.includes('electronic') || genre.includes('edm') || genre.includes('dance')) {
      const target =
        soundProfileService.getProfileById('club_bass') ||
        soundProfileService.getProfileById('bass_boost') ||
        profiles[0];
      return {
        id: `rec_genre_${target.id}`,
        targetProfileId: target.id,
        targetProfile: target,
        title: 'Dynamic Sub-Bass & Punch',
        rationale: `Recommended for ${track?.genre || 'Electronic/Hip-Hop'} energy. Delivers deep sub-bass extension while preserving vocal clarity and transient attack.`,
        confidence: 0.9,
        category: 'genre',
        genreContext: track?.genre,
      };
    }

    if (genre.includes('classical') || genre.includes('orchestral') || genre.includes('symphony') || genre.includes('instrumental')) {
      const target =
        soundProfileService.getProfileById('classical_concert') ||
        soundProfileService.getProfileById('orchestral_hall') ||
        soundProfileService.getProfileById('neutral_reference') ||
        profiles[0];
      return {
        id: `rec_genre_${target.id}`,
        targetProfileId: target.id,
        targetProfile: target,
        title: 'Orchestral Soundstage & Spatial Air',
        rationale: `Optimized for ${track?.genre || 'Classical'} dynamics. Preserves natural instrument timber and widens spatial stereo imaging for concert hall realism.`,
        confidence: 0.95,
        category: 'genre',
        genreContext: track?.genre,
      };
    }

    if (genre.includes('rock') || genre.includes('metal') || genre.includes('punk')) {
      const target =
        soundProfileService.getProfileById('rock_drive') ||
        soundProfileService.getProfileById('warm_analog') ||
        profiles[0];
      return {
        id: `rec_genre_${target.id}`,
        targetProfileId: target.id,
        targetProfile: target,
        title: 'Rock Drive & Midrange Power',
        rationale: `Accentuates electric guitars, snare attack, and kick drum impact while smoothing harsh upper-mid sibilance.`,
        confidence: 0.88,
        category: 'genre',
        genreContext: track?.genre,
      };
    }

    // 2. Device-specific recommendations
    if (isHeadphones) {
      const target =
        soundProfileService.getProfileById('harman_headphone') ||
        soundProfileService.getProfileById('audiophile_critical') ||
        profiles[0];
      return {
        id: `rec_dev_${target.id}`,
        targetProfileId: target.id,
        targetProfile: target,
        title: 'Harman Target Headphone Compensation',
        rationale: `Calibrated for headphone listening on ${deviceLabel || 'Headphones'}. Applies Harman target curve compensation for balanced sub-bass and natural pinna gain.`,
        confidence: 0.85,
        category: 'device',
        deviceContext: deviceLabel,
      };
    }

    if (isSpeakers) {
      const target =
        soundProfileService.getProfileById('neutral_reference') ||
        soundProfileService.getProfileById('open_air_clarity') ||
        profiles[0];
      return {
        id: `rec_dev_${target.id}`,
        targetProfileId: target.id,
        targetProfile: target,
        title: 'Flat Speaker Reference',
        rationale: `Provides uncolored, linear frequency response tuned for speaker playback into the room.`,
        confidence: 0.82,
        category: 'device',
        deviceContext: deviceLabel,
      };
    }

    // 3. High-resolution reference fallback
    const neutralTarget =
      soundProfileService.getProfileById('neutral_reference') ||
      soundProfileService.getProfileById('studio_master') ||
      profiles[0];

    return {
      id: `rec_acoustic_${neutralTarget.id}`,
      targetProfileId: neutralTarget.id,
      targetProfile: neutralTarget,
      title: 'Studio Reference Accuracy',
      rationale: `Neutral studio curve ensuring bit-transparent fidelity and genuine dynamic range for ${track?.title || 'current playback'}.`,
      confidence: 0.8,
      category: 'acoustic',
    };
  }

  /**
   * Preview/audition recommendation non-destructively
   */
  public auditionRecommendation(
    recommendation: SoundRecommendation,
    currentSettings: DSPSettings
  ): void {
    if (this.auditioningRecommendationId === null) {
      this.originalSettingsBeforeAudition = { ...currentSettings };
    }
    this.auditioningRecommendationId = recommendation.id;

    // Apply recommended profile to engine
    audioEngine.applyDSPSettings(profileToDSPSettings(recommendation.targetProfile));
    this.emit();
  }

  /**
   * Revert preview back to user original settings
   */
  public revertAudition(): DSPSettings | null {
    if (this.originalSettingsBeforeAudition) {
      const restored = { ...this.originalSettingsBeforeAudition };
      audioEngine.applyDSPSettings(restored);
      this.originalSettingsBeforeAudition = null;
      this.auditioningRecommendationId = null;
      this.emit();
      return restored;
    }
    this.auditioningRecommendationId = null;
    this.emit();
    return null;
  }

  /**
   * Permanently commit the recommendation
   */
  public applyRecommendation(recommendation: SoundRecommendation): void {
    audioEngine.applyDSPSettings(profileToDSPSettings(recommendation.targetProfile));
    this.originalSettingsBeforeAudition = null;
    this.auditioningRecommendationId = null;
    this.emit();
  }
}

export const soundRecommendationService = new SoundRecommendationService();
