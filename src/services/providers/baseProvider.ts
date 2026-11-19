import {
  MusicProvider,
  ProviderId,
  PlaybackCapability,
  UnifiedTrack,
  ProviderSearchOptions,
  ProviderSearchResponse,
  ProviderCapabilityAudit,
} from '../../types/universalMusic';

export abstract class BaseMusicProvider implements MusicProvider {
  abstract readonly id: ProviderId;
  abstract readonly name: string;
  abstract readonly defaultCapability: PlaybackCapability;

  /**
   * Capability audit descriptor for the provider
   */
  getCapabilityAudit(): ProviderCapabilityAudit {
    const destinationUrls: Record<string, string> = {
      jamendo: 'https://www.jamendo.com',
      audius: 'https://audius.co',
      archive: 'https://archive.org/details/audio',
      local: 'local://library',
    };

    const attributions: Record<string, string> = {
      jamendo: 'Jamendo Music (Creative Commons / Royalty Free)',
      audius: 'Audius Decentralized Music Network',
      archive: 'Internet Archive Community Audio',
      local: 'Local Audio Library',
    };

    return {
      providerId: this.id,
      name: this.name,
      searchAvailable: true,
      metadataAvailable: true,
      playbackCapability: this.defaultCapability,
      requiresAuth: false,
      developerRegistration: 'Standard open developer/community access',
      officialDestinationUrl: destinationUrls[this.id] || 'https://harmoniq.app',
      providerAttribution: attributions[this.id] || this.name,
      geographicAvailability: 'Global',
      rateLimits: 'Open tier rate limits',
      commercialRestrictions: 'Subject to respective catalog licensing / CC terms',
      desktopCompatibility: 'Fully compatible with direct HTML5 / Web Audio playback in desktop player',
    };
  }

  /**
   * Check whether the provider's API endpoint is reachable or enabled
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Search provider catalog
   */
  abstract search(query: string, options?: ProviderSearchOptions): Promise<ProviderSearchResponse>;

  /**
   * Convert provider-specific response object into normalized UnifiedTrack
   */
  abstract normalize(raw: unknown): UnifiedTrack | null;

  /**
   * Safe duration parsing (converts ms or seconds into positive integer seconds)
   */
  protected parseDuration(val: unknown): number {
    if (typeof val === 'number') {
      // If greater than 10000, likely milliseconds
      if (val > 10000) return Math.round(val / 1000);
      return Math.max(0, Math.round(val));
    }
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        if (parsed > 10000) return Math.round(parsed / 1000);
        return Math.max(0, Math.round(parsed));
      }
    }
    return 0;
  }

  /**
   * Format provider error into consistent structure
   */
  protected createErrorResponse(
    error: unknown,
    durationMs: number = 0
  ): ProviderSearchResponse {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : 'Unknown provider error';

    return {
      providerId: this.id,
      success: false,
      tracks: [],
      errorMessage: message,
      durationMs,
    };
  }
}
