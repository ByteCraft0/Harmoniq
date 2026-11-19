import {
  MusicProvider,
  ProviderId,
  PlaybackCapability,
  UnifiedTrack,
  ProviderSearchOptions,
  ProviderSearchResponse,
} from '../../types/universalMusic';

export abstract class BaseMusicProvider implements MusicProvider {
  abstract readonly id: ProviderId;
  abstract readonly name: string;
  abstract readonly defaultCapability: PlaybackCapability;

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
