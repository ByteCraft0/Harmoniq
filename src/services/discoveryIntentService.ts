import {
  DiscoveryAction,
  DiscoveryActivity,
  DiscoveryFilters,
  DiscoveryIntent,
  DiscoveryMood,
  DiscoveryReference,
  PlaybackCommand,
} from '../types/discovery';
import { UnifiedTrack } from '../types/universalMusic';

export class DiscoveryIntentService {
  private activeSessionIntent: DiscoveryIntent | null = null;
  private lastResults: UnifiedTrack[] = [];

  // =========================================================================
  // Intent Classification & Detection
  // =========================================================================

  /**
   * Checks whether the user query represents a music discovery or playback command.
   */
  public isDiscoveryOrPlaybackIntent(query: string): boolean {
    return this.isPlaybackCommand(query) || this.isDiscoveryQuery(query);
  }

  /**
   * Checks if query matches a playback command on discovery results
   * (e.g. "play the first song", "queue all", "add second to queue").
   */
  public isPlaybackCommand(query: string): boolean {
    const q = query.toLowerCase().trim();
    if (
      /^(play|queue|add)\s+(the\s+)?(first|second|third|fourth|fifth|\d+(st|nd|rd|th)?|all|next)\s*(song|track|result)?/i.test(q) ||
      /^play\s+(track|song|result)?\s*\d+/i.test(q) ||
      /^(queue\s+all|add\s+all\s+to\s+queue|queue\s+all\s+these\s+songs)/i.test(q)
    ) {
      return true;
    }
    return false;
  }

  /**
   * Checks if query represents a natural language discovery, mood, activity, similarity, or refinement request.
   */
  public isDiscoveryQuery(query: string): boolean {
    const q = query.toLowerCase().trim();

    // Explicit command keywords
    if (
      q.startsWith('find ') ||
      q.startsWith('search ') ||
      q.startsWith('discover ') ||
      q.startsWith('show me ') ||
      q.startsWith('play something ') ||
      q.startsWith('i want ') ||
      q.startsWith('recommend ') ||
      q.startsWith('give me ') ||
      q.startsWith('listen to ')
    ) {
      return true;
    }

    // Similarity requests
    if (
      q.includes('similar to') ||
      q.includes('songs like this') ||
      q.includes('songs like') ||
      q.includes('more like this') ||
      q.includes('more like my') ||
      q.includes('more from this artist') ||
      q.includes('more songs by')
    ) {
      return true;
    }

    // Mood & activity requests
    const moodWords = ['relaxing', 'calm', 'peaceful', 'chill', 'energetic', 'upbeat', 'melancholic', 'romantic', 'atmospheric', 'lo-fi', 'instrumental', 'acoustic'];
    const activityWords = ['studying', 'study', 'coding', 'working', 'reading', 'workout', 'exercise', 'sleeping', 'sleep', 'road trip'];
    if (moodWords.some(m => q.includes(m)) || activityWords.some(a => q.includes(a))) {
      return true;
    }

    // Refinement queries (when an active discovery session exists)
    if (this.activeSessionIntent) {
      if (
        q.includes('more ') ||
        q.includes('less ') ||
        q.includes('only ') ||
        q.includes('female vocals') ||
        q.includes('male vocals') ||
        q.includes('after 20') ||
        q.includes('from the') ||
        q.includes('newer') ||
        q.includes('older') ||
        q.includes('underrated')
      ) {
        return true;
      }
    }

    return false;
  }

  // =========================================================================
  // Intent Parsing & Extraction
  // =========================================================================

  /**
   * Parses natural language user input into a validated DiscoveryIntent.
   */
  public parseIntent(rawQuery: string): DiscoveryIntent {
    const q = rawQuery.toLowerCase().trim();

    // 1. Check for Playback Commands
    if (this.isPlaybackCommand(q)) {
      const playbackCmd = this.extractPlaybackCommand(q);
      return {
        action: 'playback_action',
        confidence: 'high',
        filters: {},
        playbackCommand: playbackCmd,
        rawQuery,
      };
    }

    // 2. Check for Conversational Refinements of existing session
    if (this.activeSessionIntent && this.isRefinement(q)) {
      return this.refineActiveIntent(rawQuery);
    }

    // 3. Check for Similarity requests
    const similarityRef = this.extractSimilarityReference(q);
    if (similarityRef) {
      const filters = this.extractFilters(q);
      return {
        action: 'discover_similar',
        confidence: 'high',
        filters,
        reference: similarityRef,
        rawQuery,
      };
    }

    // 4. General / Mood / Activity / Genre Discovery
    const filters = this.extractFilters(q);
    const confidence = this.evaluateConfidence(filters, q);

    return {
      action: 'discover',
      confidence,
      filters,
      rawQuery,
    };
  }

  /**
   * Extracts playback command from natural language query.
   */
  public extractPlaybackCommand(query: string): PlaybackCommand {
    const q = query.toLowerCase().trim();

    if (q.includes('queue all') || q.includes('add all to queue') || q.includes('queue all tracks')) {
      return { action: 'queue_all' };
    }

    // Determine target index
    let targetIndex = 0;
    if (q.includes('first') || q.includes(' 1') || q.includes('track 1') || q.includes('song 1') || q.includes('result 1')) {
      targetIndex = 0;
    } else if (q.includes('second') || q.includes(' 2') || q.includes('track 2') || q.includes('song 2') || q.includes('result 2')) {
      targetIndex = 1;
    } else if (q.includes('third') || q.includes(' 3') || q.includes('track 3') || q.includes('song 3') || q.includes('result 3')) {
      targetIndex = 2;
    } else if (q.includes('fourth') || q.includes(' 4') || q.includes('track 4') || q.includes('song 4') || q.includes('result 4')) {
      targetIndex = 3;
    } else if (q.includes('fifth') || q.includes(' 5') || q.includes('track 5') || q.includes('song 5') || q.includes('result 5')) {
      targetIndex = 4;
    } else {
      const match = q.match(/\b(\d+)\b/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > 0) targetIndex = num - 1;
      }
    }

    let action: PlaybackCommand['action'] = 'play_index';
    if (q.includes('play next')) {
      action = 'play_next_index';
    } else if (q.includes('queue') || q.includes('add')) {
      action = 'queue_index';
    }

    return {
      action,
      targetIndex: Math.max(0, targetIndex),
    };
  }

  /**
   * Checks if query is a conversational refinement of the previous search.
   */
  private isRefinement(q: string): boolean {
    const refinementPrefixes = [
      'more ',
      'less ',
      'only ',
      'with ',
      'without ',
      'released after',
      'after 20',
      'before 20',
      'from the',
      'newer',
      'older',
      'female vocals',
      'male vocals',
      'underrated',
      'instrumental only',
      'acoustic only',
    ];
    return refinementPrefixes.some(p => q.startsWith(p) || q.includes(p));
  }

  /**
   * Merges refinement query into the current active discovery session.
   */
  public refineActiveIntent(rawQuery: string): DiscoveryIntent {
    const baseIntent = this.activeSessionIntent || {
      action: 'discover',
      confidence: 'high',
      filters: {},
      rawQuery: '',
    };

    const newFilters = this.extractFilters(rawQuery);
    const mergedFilters: DiscoveryFilters = {
      ...baseIntent.filters,
      ...newFilters,
    };

    // Merge array fields
    if (newFilters.genres && baseIntent.filters.genres) {
      mergedFilters.genres = Array.from(new Set([...baseIntent.filters.genres, ...newFilters.genres]));
    }
    if (newFilters.moods && baseIntent.filters.moods) {
      mergedFilters.moods = Array.from(new Set([...baseIntent.filters.moods, ...newFilters.moods]));
    }
    if (newFilters.activities && baseIntent.filters.activities) {
      mergedFilters.activities = Array.from(new Set([...baseIntent.filters.activities, ...newFilters.activities]));
    }

    const refinedIntent: DiscoveryIntent = {
      action: 'refine',
      confidence: 'high',
      filters: mergedFilters,
      reference: baseIntent.reference,
      rawQuery,
    };

    this.activeSessionIntent = refinedIntent;
    return refinedIntent;
  }

  /**
   * Extracts similarity references from query (e.g., "songs like current track", "similar to Queen").
   */
  public extractSimilarityReference(q: string): DiscoveryReference | undefined {
    if (
      q.includes('current song') ||
      q.includes('current track') ||
      q.includes('what i am listening to') ||
      q.includes("what i'm listening to") ||
      q.includes('this song') ||
      q.includes('songs like this') ||
      q.includes('more like this')
    ) {
      return { type: 'current_track' };
    }

    if (q.includes('this artist') || q.includes('current artist') || q.includes('more from this artist')) {
      return { type: 'current_artist' };
    }

    if (q.includes('this album') || q.includes('current album')) {
      return { type: 'current_album' };
    }

    if (q.includes('my playlist') || q.includes('current playlist') || q.includes('study playlist') || q.includes('queue')) {
      return { type: 'playlist' };
    }

    // Specific named track reference: e.g. "similar to Bohemian Rhapsody" or "songs like Shape of You"
    const match = q.match(/(?:similar to|songs like|more like|music like)\s+(.+?)(?:$|\s+(?:by|from|with|in))/i);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (!['this', 'current', 'my playlist'].includes(candidate)) {
        return {
          type: 'track_title',
          title: candidate,
        };
      }
    }

    return undefined;
  }

  /**
   * Extracts structured discovery filters (genres, moods, activities, release years, etc.)
   */
  public extractFilters(query: string): DiscoveryFilters {
    const q = query.toLowerCase().trim();
    const filters: DiscoveryFilters = {};

    // 1. Moods
    const detectedMoods: DiscoveryMood[] = [];
    if (q.includes('relax') || q.includes('calm') || q.includes('soothing') || q.includes('serene')) {
      detectedMoods.push('relaxing');
    }
    if (q.includes('peaceful')) detectedMoods.push('peaceful');
    if (q.includes('chill') || q.includes('lo-fi') || q.includes('ambient') || q.includes('downtempo')) {
      detectedMoods.push('chill');
    }
    if (q.includes('energetic') || q.includes('energy') || q.includes('pump up') || q.includes('fast pace') || q.includes('upbeat')) {
      detectedMoods.push('energetic');
      filters.energy = 'high';
    }
    if (q.includes('happy') || q.includes('joyful') || q.includes('cheerful') || q.includes('uplifting')) {
      detectedMoods.push('happy');
    }
    if (q.includes('sad') || q.includes('sorrow') || q.includes('crying') || q.includes('heartbreak')) {
      detectedMoods.push('sad');
      filters.energy = 'low';
    }
    if (q.includes('melanchol')) detectedMoods.push('melancholic');
    if (q.includes('romantic') || q.includes('love song')) detectedMoods.push('romantic');
    if (q.includes('motivat') || q.includes('inspiring') || q.includes('epic')) detectedMoods.push('motivational');
    if (q.includes('atmospheric') || q.includes('ethereal') || q.includes('dreamy') || q.includes('cinematic')) {
      detectedMoods.push('atmospheric');
    }
    if (detectedMoods.length > 0) {
      filters.moods = detectedMoods;
    }

    // 2. Activities
    const detectedActivities: DiscoveryActivity[] = [];
    if (q.includes('studying') || q.includes('study') || q.includes('homework') || q.includes('revision')) {
      detectedActivities.push('studying');
    }
    if (q.includes('coding') || q.includes('programming') || q.includes('developer') || q.includes('hack')) {
      detectedActivities.push('coding');
    }
    if (q.includes('reading') || q.includes('book')) detectedActivities.push('reading');
    if (q.includes('working') || q.includes('work') || q.includes('focus') || q.includes('office')) {
      detectedActivities.push('working');
    }
    if (q.includes('travelling') || q.includes('travel') || q.includes('road trip') || q.includes('driving')) {
      detectedActivities.push('travelling');
    }
    if (q.includes('exercis') || q.includes('workout') || q.includes('gym') || q.includes('running') || q.includes('cardio')) {
      detectedActivities.push('exercising');
      filters.energy = 'high';
    }
    if (q.includes('sleeping') || q.includes('sleep') || q.includes('bedtime') || q.includes('insomnia')) {
      detectedActivities.push('sleeping');
      filters.energy = 'low';
    }
    if (q.includes('background') || q.includes('dinner') || q.includes('cafe')) {
      detectedActivities.push('background');
    }
    if (detectedActivities.length > 0) {
      filters.activities = detectedActivities;
    }

    // 3. Genres
    const knownGenres = [
      'acoustic',
      'rock',
      'pop',
      'jazz',
      'classical',
      'electronic',
      'lo-fi',
      'hip hop',
      'metal',
      'folk',
      'indie',
      'ambient',
      'blues',
      'reggae',
      'soul',
      'edm',
      'r&b',
      'punk',
      'techno',
      'house',
      'bollywood',
      'punjabi',
      'hindi',
      'soundtrack',
    ];
    const detectedGenres: string[] = [];
    for (const genre of knownGenres) {
      // Check whole word or token
      const regex = new RegExp(`\\b${genre}\\b`, 'i');
      if (regex.test(q)) {
        detectedGenres.push(genre);
      }
    }
    if (detectedGenres.length > 0) {
      filters.genres = detectedGenres;
    }

    // 4. Acoustic & Instrumental
    if (q.includes('acoustic') || q.includes('unplugged')) {
      filters.isAcoustic = true;
    }
    if (q.includes('instrumental') || q.includes('no vocals') || q.includes('without singing') || q.includes('no singing')) {
      filters.isInstrumental = true;
      filters.vocalPreference = 'instrumental';
    }

    // 5. Vocal Preferences
    if (q.includes('female vocal') || q.includes('female singer') || q.includes('women vocal') || q.includes('woman singer')) {
      filters.vocalPreference = 'female';
    } else if (q.includes('male vocal') || q.includes('male singer') || q.includes('man singer')) {
      filters.vocalPreference = 'male';
    }

    // 6. Release Year & Period Filtering
    const afterYearMatch = q.match(/(?:after|since|newer than)\s+(19\d\d|20\d\d)/i);
    if (afterYearMatch) {
      filters.yearMin = parseInt(afterYearMatch[1], 10);
    }

    const beforeYearMatch = q.match(/(?:before|prior to|older than)\s+(19\d\d|20\d\d)/i);
    if (beforeYearMatch) {
      filters.yearMax = parseInt(beforeYearMatch[1], 10);
    }

    // Decades
    if (q.includes('80s') || q.includes('eighties')) {
      filters.yearMin = 1980;
      filters.yearMax = 1989;
    } else if (q.includes('90s') || q.includes('nineties')) {
      filters.yearMin = 1990;
      filters.yearMax = 1999;
    } else if (q.includes('2000s')) {
      filters.yearMin = 2000;
      filters.yearMax = 2009;
    } else if (q.includes('newer') || q.includes('recent') || q.includes('latest')) {
      filters.yearMin = 2020;
    }

    // 7. Popularity / Underrated
    if (q.includes('underrated') || q.includes('hidden gem') || q.includes('less popular') || q.includes('indie gem')) {
      filters.popularityFilter = 'underrated';
    } else if (q.includes('popular') || q.includes('top hits') || q.includes('famous') || q.includes('bestseller')) {
      filters.popularityFilter = 'popular';
    }

    // 8. Local Only
    if (q.includes('local only') || q.includes('from my library only') || q.includes('my local files only')) {
      filters.localOnly = true;
    }

    // 9. Query text extraction (stripping common boilerplate command prefixes)
    let cleanedText = q
      .replace(/^(find|search|discover|show me|play something|i want|recommend|give me|listen to)\s+/i, '')
      .replace(/\b(songs|music|tracks|tunes|audio)\b/gi, '')
      .replace(/\b(for studying|for coding|for working|for workout|suitable for)\b/gi, '')
      .replace(/\b(released after \d{4}|after \d{4}|from the \d{2}s)\b/gi, '')
      .trim();

    if (cleanedText) {
      filters.query = cleanedText;
    }

    return filters;
  }

  /**
   * Evaluates intent confidence.
   */
  private evaluateConfidence(filters: DiscoveryFilters, raw: string): 'high' | 'medium' | 'low' {
    const hasGenres = filters.genres && filters.genres.length > 0;
    const hasMoods = filters.moods && filters.moods.length > 0;
    const hasActivities = filters.activities && filters.activities.length > 0;
    const hasYear = filters.yearMin !== undefined || filters.yearMax !== undefined;
    const hasQuery = Boolean(filters.query && filters.query.length >= 3);

    if (hasGenres || hasMoods || hasActivities || hasYear) {
      return 'high';
    }
    if (hasQuery) {
      return 'medium';
    }
    if (raw.length < 3) {
      return 'low';
    }
    return 'medium';
  }

  // =========================================================================
  // Session & Result Management
  // =========================================================================

  public setSession(intent: DiscoveryIntent, results: UnifiedTrack[] = []): void {
    this.activeSessionIntent = intent;
    this.lastResults = [...results];
  }

  public getActiveSession(): DiscoveryIntent | null {
    return this.activeSessionIntent;
  }

  public getLastResults(): UnifiedTrack[] {
    return [...this.lastResults];
  }

  public clearSession(): void {
    this.activeSessionIntent = null;
    this.lastResults = [];
  }
}

export const discoveryIntentService = new DiscoveryIntentService();
