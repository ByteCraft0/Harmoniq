import { RadioStation, RadioCountry, RadioGenre, RadioSearchParams } from '../types/radio';

const MIRROR_SERVERS = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
];

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class RadioDirectoryService {
  private activeServerIndex = 0;
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
  private readonly REQUEST_TIMEOUT_MS = 8000; // 8 seconds

  private getActiveBaseUrl(): string {
    return MIRROR_SERVERS[this.activeServerIndex % MIRROR_SERVERS.length];
  }

  private rotateServer(): void {
    this.activeServerIndex = (this.activeServerIndex + 1) % MIRROR_SERVERS.length;
  }

  /**
   * Safe fetch with automatic mirror rotation and timeout.
   */
  private async fetchWithFallback<T>(path: string, options?: RequestInit): Promise<T> {
    const attempts = MIRROR_SERVERS.length;
    let lastError: any = null;

    for (let i = 0; i < attempts; i++) {
      const baseUrl = this.getActiveBaseUrl();
      const url = `${baseUrl}${path}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'User-Agent': 'Harmoniq/1.0.0 (https://harmoniq.audio)',
            Accept: 'application/json',
            ...(options?.headers || {}),
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data as T;
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
        // Rotate to next mirror on failure or timeout
        this.rotateServer();
      }
    }

    throw lastError || new Error('All Radio Browser API mirrors failed to respond.');
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache<T>(key: string, data: T): void {
    // Keep cache bounded to 100 entries to prevent memory growth
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Normalizes raw API station payload into typed RadioStation
   */
  public parseStation(raw: any): RadioStation | null {
    if (!raw || typeof raw !== 'object') return null;

    const streamUrl = (raw.url_resolved || raw.url || '').trim();
    if (!streamUrl || (!streamUrl.startsWith('http://') && !streamUrl.startsWith('https://'))) {
      return null;
    }

    const tags: string[] = typeof raw.tags === 'string'
      ? raw.tags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
      : Array.isArray(raw.tags) ? raw.tags : [];

    return {
      id: raw.stationuuid || raw.id || `station_${Math.random().toString(36).substring(2, 9)}`,
      name: (raw.name || 'Unknown Radio').trim(),
      streamUrl,
      homepageUrl: raw.homepage || undefined,
      favicon: raw.favicon && raw.favicon.startsWith('http') ? raw.favicon : undefined,
      country: raw.country ? raw.country.trim() : undefined,
      countryCode: raw.countrycode ? raw.countrycode.trim() : undefined,
      tags,
      codec: raw.codec ? raw.codec.trim().toUpperCase() : 'MP3',
      bitrate: typeof raw.bitrate === 'number' && raw.bitrate > 0 ? raw.bitrate : 128,
      votes: typeof raw.votes === 'number' ? raw.votes : 0,
      clickCount: typeof raw.clickcount === 'number' ? raw.clickcount : 0,
      isCustom: false,
    };
  }

  /**
   * Get featured stations (high voted & checked)
   */
  public async getFeaturedStations(limit: number = 20): Promise<RadioStation[]> {
    const cacheKey = `featured_${limit}`;
    const cached = this.getCached<RadioStation[]>(cacheKey);
    if (cached) return cached;

    const raw = await this.fetchWithFallback<any[]>(
      `/json/stations/topvote/${limit}?hidebroken=true`
    );

    const stations = (raw || [])
      .map((r) => this.parseStation(r))
      .filter((s): s is RadioStation => s !== null);

    this.setCache(cacheKey, stations);
    return stations;
  }

  /**
   * Get top clicked / popular stations
   */
  public async getPopularStations(limit: number = 20): Promise<RadioStation[]> {
    const cacheKey = `popular_${limit}`;
    const cached = this.getCached<RadioStation[]>(cacheKey);
    if (cached) return cached;

    const raw = await this.fetchWithFallback<any[]>(
      `/json/stations/topclick/${limit}?hidebroken=true`
    );

    const stations = (raw || [])
      .map((r) => this.parseStation(r))
      .filter((s): s is RadioStation => s !== null);

    this.setCache(cacheKey, stations);
    return stations;
  }

  /**
   * Search stations by name, country, or tag
   */
  public async searchStations(params: RadioSearchParams): Promise<RadioStation[]> {
    const queryParts: string[] = ['hidebroken=true'];
    const limit = Math.min(params.limit || 25, 50);
    queryParts.push(`limit=${limit}`);

    if (params.offset && params.offset > 0) {
      queryParts.push(`offset=${params.offset}`);
    }
    if (params.order) {
      queryParts.push(`order=${params.order}&reverse=true`);
    } else {
      queryParts.push('order=votes&reverse=true');
    }

    if (params.name && params.name.trim()) {
      queryParts.push(`name=${encodeURIComponent(params.name.trim())}`);
    }
    if (params.country && params.country.trim()) {
      queryParts.push(`country=${encodeURIComponent(params.country.trim())}`);
    }
    if (params.countryCode && params.countryCode.trim()) {
      queryParts.push(`countrycode=${encodeURIComponent(params.countryCode.trim().toUpperCase())}`);
    }
    if (params.tag && params.tag.trim()) {
      queryParts.push(`tag=${encodeURIComponent(params.tag.trim().toLowerCase())}`);
    }

    const path = `/json/stations/search?${queryParts.join('&')}`;
    const raw = await this.fetchWithFallback<any[]>(path);

    return (raw || [])
      .map((r) => this.parseStation(r))
      .filter((s): s is RadioStation => s !== null);
  }

  /**
   * Browse top countries with station counts
   */
  public async getCountries(limit: number = 40): Promise<RadioCountry[]> {
    const cacheKey = `countries_${limit}`;
    const cached = this.getCached<RadioCountry[]>(cacheKey);
    if (cached) return cached;

    const raw = await this.fetchWithFallback<any[]>(
      `/json/countries?order=stationcount&reverse=true&limit=${limit}`
    );

    const countries: RadioCountry[] = (raw || [])
      .filter((c) => c && c.name && typeof c.stationcount === 'number' && c.stationcount > 10)
      .map((c) => ({
        name: c.name.trim(),
        code: (c.iso_3166_1 || c.code || '').trim(),
        stationCount: c.stationcount,
      }));

    this.setCache(cacheKey, countries);
    return countries;
  }

  /**
   * Browse top genres / tags
   */
  public async getGenres(limit: number = 40): Promise<RadioGenre[]> {
    const cacheKey = `genres_${limit}`;
    const cached = this.getCached<RadioGenre[]>(cacheKey);
    if (cached) return cached;

    const raw = await this.fetchWithFallback<any[]>(
      `/json/tags?order=stationcount&reverse=true&limit=${limit}`
    );

    const genres: RadioGenre[] = (raw || [])
      .filter((g) => g && g.name && typeof g.stationcount === 'number' && g.stationcount > 20)
      .map((g) => ({
        name: g.name.trim().toLowerCase(),
        stationCount: g.stationcount,
      }));

    this.setCache(cacheKey, genres);
    return genres;
  }

  /**
   * Validate stream URL security & format
   */
  public validateStreamUrl(url: string): { valid: boolean; error?: string } {
    if (!url || typeof url !== 'string') {
      return { valid: false, error: 'Stream URL is required.' };
    }
    const trimmed = url.trim();
    if (trimmed.length < 8) {
      return { valid: false, error: 'Stream URL is too short.' };
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          valid: false,
          error: `Unsupported protocol "${parsed.protocol}". Only HTTP and HTTPS streams are permitted.`,
        };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format.' };
    }
  }

  /**
   * Clear in-memory cache
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

export const radioDirectoryService = new RadioDirectoryService();
