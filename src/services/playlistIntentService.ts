import {
  GeneratedPlaylistPreview,
  PlaylistAssistantAction,
  PlaylistEditOperation,
  PlaylistIntent,
  PlaylistPreferences,
  PlaylistSourceType,
} from '../types/playlistAssistant';
import { UnifiedTrack } from '../types/universalMusic';

export class PlaylistIntentService {
  private activePreview: GeneratedPlaylistPreview | null = null;
  private previewHistoryStack: GeneratedPlaylistPreview[] = [];

  // =========================================================================
  // Intent Classification & Detection
  // =========================================================================

  /**
   * Determines whether the given query is a playlist-related conversational request.
   */
  public isPlaylistIntent(query: string): boolean {
    const q = query.toLowerCase().trim();

    // 1. Direct playlist creation & generation keywords
    if (
      q.includes('create a playlist') ||
      q.includes('create playlist') ||
      q.includes('make me a playlist') ||
      q.includes('make a playlist') ||
      q.includes('make playlist') ||
      q.includes('build a playlist') ||
      q.includes('build playlist') ||
      q.includes('generate a playlist') ||
      q.includes('generate playlist') ||
      q.includes('new playlist') ||
      /playlist\s+for\s+/i.test(q) ||
      /playlist\s+with\s+\d+/i.test(q)
    ) {
      return true;
    }

    // 2. Save confirmation for active playlist preview
    if (
      q === 'save' ||
      q === 'save it' ||
      q === 'save playlist' ||
      q.startsWith('save as') ||
      q.startsWith('save this as') ||
      q.startsWith('save it as') ||
      q.startsWith('save playlist as') ||
      q.startsWith('save this playlist')
    ) {
      return true;
    }

    // 3. Inspection of active preview or existing playlists
    if (
      q.includes('show playlist details') ||
      q.includes('inspect playlist') ||
      q.includes('what is in this playlist') ||
      q.includes('summarize playlist')
    ) {
      return true;
    }

    // 4. Preview cancellation / undo
    if (
      q === 'cancel' ||
      q === 'discard' ||
      q.includes('cancel playlist') ||
      q.includes('discard playlist') ||
      q.includes('cancel preview') ||
      q === 'undo' ||
      q.includes('undo change')
    ) {
      return true;
    }

    // 5. Refinement or editing (especially when an active preview exists)
    if (this.activePreview) {
      if (
        q.startsWith('add ') ||
        q.startsWith('remove ') ||
        q.startsWith('replace ') ||
        q.startsWith('rename ') ||
        q.startsWith('make it ') ||
        q.startsWith('change name to ') ||
        q.startsWith('call it ') ||
        q.includes('more songs') ||
        q.includes('fewer songs') ||
        q.includes('more acoustic') ||
        q.includes('more electronic') ||
        q.includes('more instrumental') ||
        q.includes('without vocals')
      ) {
        return true;
      }
    }

    // 6. Direct editing of existing playlists (e.g. "add songs to my Study playlist")
    if (
      (q.includes('to my') || q.includes('from my')) &&
      q.includes('playlist')
    ) {
      return true;
    }

    return false;
  }

  // =========================================================================
  // Intent Parsing
  // =========================================================================

  /**
   * Parses natural language query into a strongly typed PlaylistIntent.
   */
  public parseIntent(rawQuery: string): PlaylistIntent {
    const q = rawQuery.toLowerCase().trim();

    // 1. Cancel / Discard / Undo
    if (
      q === 'cancel' ||
      q === 'discard' ||
      q.includes('cancel playlist') ||
      q.includes('discard playlist') ||
      q.includes('cancel preview')
    ) {
      return {
        action: 'cancel',
        preferences: {},
        rawQuery,
      };
    }

    if (
      q === 'undo' ||
      q.includes('undo change') ||
      q.includes('undo last') ||
      q === 'revert'
    ) {
      return {
        action: 'edit',
        editOperation: {
          type: 'undo',
        },
        preferences: {},
        rawQuery,
      };
    }

    // 2. Save confirmation
    if (
      q === 'save' ||
      q === 'save it' ||
      q === 'save playlist' ||
      q.startsWith('save as') ||
      q.startsWith('save this as') ||
      q.startsWith('save it as') ||
      q.startsWith('save playlist as') ||
      q.startsWith('save this playlist')
    ) {
      let customName: string | undefined = undefined;
      const match = rawQuery.match(/save\s+(?:this\s+)?(?:playlist\s+)?as\s+["']?([^"']+)["']?/i);
      if (match && match[1]) {
        customName = match[1].trim();
      }

      return {
        action: 'save',
        name: customName || this.activePreview?.name,
        preferences: {},
        rawQuery,
      };
    }

    // 3. Inspect
    if (
      q.includes('inspect playlist') ||
      q.includes('show playlist details') ||
      q.includes('summarize playlist') ||
      q.includes('what is in this playlist')
    ) {
      return {
        action: 'inspect',
        preferences: {},
        rawQuery,
      };
    }

    // 4. Conversational Refinement of active preview
    if (this.activePreview && (this.isRefinementQuery(q) || this.isEditQuery(q))) {
      return this.parseRefinementOrEdit(rawQuery);
    }

    // 5. Existing Playlist Direct Edit (e.g. "Add instrumental songs to my Study playlist")
    const existingEdit = this.parseExistingPlaylistEdit(rawQuery);
    if (existingEdit) {
      return existingEdit;
    }

    // 6. New Playlist Creation Request
    return this.parseCreationIntent(rawQuery);
  }

  /**
   * Parses a new playlist creation request.
   */
  public parseCreationIntent(rawQuery: string): PlaylistIntent {
    const q = rawQuery.toLowerCase().trim();
    const preferences: PlaylistPreferences = {};

    // A. Target Track Count ("with 30 relaxing songs", "with 20 songs", "15 tracks")
    const countMatch =
      q.match(/\b(\d+)\s+(?:[a-zA-Z-]+\s+)?(?:songs?|tracks?)\b/i) ||
      q.match(/\b(\d+)\s*(?:songs?|tracks?)\b/i);
    if (countMatch) {
      preferences.targetCount = Math.max(3, Math.min(100, parseInt(countMatch[1], 10)));
    } else {
      preferences.targetCount = 15; // Sensible default
    }

    // B. Source Type
    let sourceType: PlaylistSourceType = 'universal_discovery';
    if (q.includes('my favorites') || q.includes('favorite tracks') || q.includes('starred')) {
      sourceType = 'favorites';
    } else if (
      q.includes('current song') ||
      q.includes('current track') ||
      q.includes('what i am listening to') ||
      q.includes("what i'm listening to")
    ) {
      sourceType = 'current_track';
    } else if (q.includes('local library') || q.includes('my local files') || q.includes('my library')) {
      sourceType = 'local_library';
    } else if (q.includes('similar to my') && q.includes('playlist')) {
      sourceType = 'existing_playlist';
    }

    // C. Moods
    const detectedMoods: string[] = [];
    if (q.includes('relax') || q.includes('calm') || q.includes('soothing') || q.includes('peaceful')) {
      detectedMoods.push('relaxing');
      preferences.energy = 'low';
    }
    if (q.includes('chill') || q.includes('lo-fi') || q.includes('downtempo')) {
      detectedMoods.push('chill');
    }
    if (q.includes('energetic') || q.includes('workout') || q.includes('gym') || q.includes('running')) {
      detectedMoods.push('energetic');
      preferences.energy = 'high';
    }
    if (q.includes('happy') || q.includes('joyful') || q.includes('upbeat')) {
      detectedMoods.push('happy');
    }
    if (q.includes('melancholic') || q.includes('sad')) {
      detectedMoods.push('melancholic');
    }
    if (q.includes('romantic')) detectedMoods.push('romantic');
    if (q.includes('atmospheric') || q.includes('ambient') || q.includes('dreamy')) {
      detectedMoods.push('atmospheric');
    }
    if (detectedMoods.length > 0) {
      preferences.moods = detectedMoods;
    }

    // D. Activities
    const detectedActivities: string[] = [];
    if (q.includes('coding') || q.includes('programming') || q.includes('developer')) {
      detectedActivities.push('coding');
    }
    if (q.includes('study') || q.includes('studying') || q.includes('homework')) {
      detectedActivities.push('studying');
    }
    if (q.includes('road trip') || q.includes('driving') || q.includes('travel')) {
      detectedActivities.push('road trip');
    }
    if (q.includes('sleep') || q.includes('bedtime') || q.includes('sleeping')) {
      detectedActivities.push('sleeping');
    }
    if (q.includes('working') || q.includes('focus') || q.includes('deep work')) {
      detectedActivities.push('working');
    }
    if (detectedActivities.length > 0) {
      preferences.activities = detectedActivities;
    }

    // E. Genres
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
      'soundtrack',
    ];
    const detectedGenres: string[] = [];
    for (const g of knownGenres) {
      const reg = new RegExp(`\\b${g}\\b`, 'i');
      if (reg.test(q)) detectedGenres.push(g);
    }
    if (detectedGenres.length > 0) {
      preferences.genres = detectedGenres;
    }

    // F. Acoustic / Instrumental / Vocals
    if (q.includes('acoustic') || q.includes('unplugged')) {
      preferences.isAcoustic = true;
    }
    if (q.includes('instrumental') || q.includes('no vocals') || q.includes('without singing')) {
      preferences.isInstrumental = true;
      preferences.vocalPreference = 'instrumental';
    }
    if (q.includes('female vocal') || q.includes('female singer')) {
      preferences.vocalPreference = 'female';
    } else if (q.includes('male vocal') || q.includes('male singer')) {
      preferences.vocalPreference = 'male';
    }

    // G. Generate Suggested Name
    let suggestedName = '';
    if (preferences.activities && preferences.activities.length > 0) {
      const act = preferences.activities[0];
      suggestedName = act === 'coding' ? 'Late-Night Coding' : act === 'studying' ? 'Deep Study Session' : act === 'road trip' ? 'Highway Horizon Road Trip' : `${act.charAt(0).toUpperCase() + act.slice(1)} Mix`;
    } else if (preferences.moods && preferences.moods.length > 0) {
      const m = preferences.moods[0];
      suggestedName = m === 'relaxing' ? 'Evening Relaxation' : m === 'chill' ? 'Chillout Vibes' : m === 'energetic' ? 'High Energy Drive' : `${m.charAt(0).toUpperCase() + m.slice(1)} Harmony`;
    } else if (preferences.genres && preferences.genres.length > 0) {
      suggestedName = `${preferences.genres[0].charAt(0).toUpperCase() + preferences.genres[0].slice(1)} Essentials`;
    } else if (sourceType === 'favorites') {
      suggestedName = 'Personal Favorites Blend';
    } else {
      suggestedName = 'Harmoniq Discovery Playlist';
    }

    return {
      action: 'create',
      name: suggestedName,
      sourceType,
      preferences,
      rawQuery,
    };
  }

  /**
   * Helper to parse numbers in numeric or written form ("5", "five").
   */
  private parseWordNumber(w: string, fallback: number = 5): number {
    const map: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    };
    if (map[w.toLowerCase()]) return map[w.toLowerCase()];
    const n = parseInt(w, 10);
    return isNaN(n) ? fallback : n;
  }

  /**
   * Parses refinement or edit queries when an active playlist preview exists.
   */
  private parseRefinementOrEdit(rawQuery: string): PlaylistIntent {
    const q = rawQuery.toLowerCase().trim();

    // 0. Undo
    if (q === 'undo' || q.includes('undo change') || q.includes('undo last')) {
      return {
        action: 'edit',
        editOperation: {
          type: 'undo',
        },
        preferences: {},
        rawQuery,
      };
    }

    // 1. Rename
    const renameMatch = rawQuery.match(/(?:change\s+name\s+to|rename\s+(?:this\s+)?(?:playlist\s+)?to|call\s+it)\s+["']?([^"']+)["']?/i);
    if (renameMatch && renameMatch[1]) {
      return {
        action: 'edit',
        editOperation: {
          type: 'rename',
          newName: renameMatch[1].trim(),
        },
        preferences: {},
        rawQuery,
      };
    }

    // 2. Replace tracks ("replace the last 5 songs with something calmer", "replace the last five songs")
    const replaceMatch = q.match(/replace\s+(?:the\s+)?(?:last\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)|first\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten))\s*(?:songs?|tracks?)?(?:\s+with\s+(.+))?/i);
    if (replaceMatch) {
      const countStr = replaceMatch[1] || replaceMatch[2] || '5';
      const count = this.parseWordNumber(countStr, 5);
      const withPart = (replaceMatch[3] || '').toLowerCase();
      const replacePrefs: PlaylistPreferences = {};
      if (withPart.includes('calmer') || withPart.includes('relax') || withPart.includes('chill')) {
        replacePrefs.energy = 'low';
        replacePrefs.moods = ['relaxing'];
      }
      if (withPart.includes('acoustic')) replacePrefs.isAcoustic = true;
      if (withPart.includes('instrumental')) replacePrefs.isInstrumental = true;
      return {
        action: 'edit',
        editOperation: {
          type: 'replace_tracks',
          countToAdd: count,
        },
        preferences: replacePrefs,
        rawQuery,
      };
    }

    // 3. Add more tracks ("add 5 more songs", "add more instrumental tracks", "add 10 songs")
    const addCountMatch = q.match(/add\s+(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?(?:more\s+)?(acoustic|instrumental|ambient|rock|pop|jazz|electronic)?\s*(?:songs?|tracks?)/i);
    if (addCountMatch && (addCountMatch[1] || q.startsWith('add '))) {
      const count = addCountMatch[1] ? this.parseWordNumber(addCountMatch[1], 5) : 5;
      const genreKeyword = addCountMatch[2] ? addCountMatch[2].toLowerCase() : undefined;
      const addPrefs: PlaylistPreferences = {};
      if (genreKeyword === 'acoustic' || q.includes('acoustic')) addPrefs.isAcoustic = true;
      if (genreKeyword === 'instrumental' || q.includes('instrumental')) addPrefs.isInstrumental = true;
      if (genreKeyword && !['acoustic', 'instrumental'].includes(genreKeyword)) {
        addPrefs.genres = [genreKeyword];
      }
      return {
        action: 'edit',
        editOperation: {
          type: 'add_tracks',
          countToAdd: count,
        },
        preferences: addPrefs,
        rawQuery,
      };
    }

    // 4. Remove tracks by index ("remove the last 3 songs", "remove song 2", "remove track 1")
    const removeMatch = q.match(/remove\s+(?:the\s+)?(?:last\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)|first\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)|track\s+(\d+)|song\s+(\d+))/i);
    if (removeMatch) {
      const idxStr = removeMatch[1] || removeMatch[2] || removeMatch[3] || removeMatch[4] || '1';
      const idx = this.parseWordNumber(idxStr, 1);
      return {
        action: 'edit',
        editOperation: {
          type: 'remove_tracks',
          targetIndex: idx > 0 ? idx - 1 : 0,
        },
        preferences: {},
        rawQuery,
      };
    }

    // 5. Remove by quality ("remove energetic songs", "remove vocal tracks")
    if (q.includes('remove energetic') || q.includes('fewer energetic') || q.includes('less energetic')) {
      return {
        action: 'refine',
        preferences: {
          energy: 'low',
          moods: ['relaxing'],
        },
        rawQuery,
      };
    }

    // 6. Attribute refinement: "more acoustic", "make it electronic", "only instrumental"
    const refinedPrefs: PlaylistPreferences = {};
    if (q.includes('acoustic')) refinedPrefs.isAcoustic = true;
    if (q.includes('instrumental') || q.includes('remove vocals') || q.includes('no vocals') || q.includes('without vocals')) {
      refinedPrefs.isInstrumental = true;
      refinedPrefs.vocalPreference = 'instrumental';
    }
    if (q.includes('electronic')) refinedPrefs.genres = ['electronic'];
    if (q.includes('calmer') || q.includes('relaxing') || q.includes('chill')) {
      refinedPrefs.energy = 'low';
      refinedPrefs.moods = ['relaxing'];
    }

    return {
      action: 'refine',
      preferences: refinedPrefs,
      rawQuery,
    };
  }

  /**
   * Parses edits targeted at existing saved library playlists.
   */
  private parseExistingPlaylistEdit(rawQuery: string): PlaylistIntent | null {
    const q = rawQuery.toLowerCase().trim();
    // e.g. "Add instrumental songs to my Study playlist"
    const toMatch = rawQuery.match(/add\s+(.+?)\s+to\s+my\s+["']?([^"']+)["']?\s+playlist/i);
    if (toMatch) {
      return {
        action: 'edit',
        referencePlaylistName: toMatch[2].trim(),
        editOperation: {
          type: 'add_tracks',
        },
        preferences: {
          genres: toMatch[1].toLowerCase().includes('instrumental') ? ['instrumental'] : undefined,
          isInstrumental: toMatch[1].toLowerCase().includes('instrumental'),
        },
        rawQuery,
      };
    }

    // e.g. "Rename my playlist Study to Deep Focus"
    const renameMatch = rawQuery.match(/rename\s+(?:my\s+)?playlist\s+["']?([^"']+)["']?\s+to\s+["']?([^"']+)["']?/i);
    if (renameMatch) {
      return {
        action: 'edit',
        referencePlaylistName: renameMatch[1].trim(),
        editOperation: {
          type: 'rename',
          newName: renameMatch[2].trim(),
        },
        preferences: {},
        rawQuery,
      };
    }

    return null;
  }

  private isRefinementQuery(q: string): boolean {
    return (
      q.includes('more ') ||
      q.includes('less ') ||
      q.includes('calmer') ||
      q.includes('energetic') ||
      q.includes('only instrumental') ||
      q.includes('without vocals')
    );
  }

  private isEditQuery(q: string): boolean {
    return (
      q.startsWith('add ') ||
      q.startsWith('remove ') ||
      q.startsWith('replace ') ||
      q.startsWith('rename ') ||
      q.startsWith('change name') ||
      q.startsWith('call it')
    );
  }

  // =========================================================================
  // Active Preview Session Management & Undo Support
  // =========================================================================

  public setActivePreview(preview: GeneratedPlaylistPreview | null): void {
    if (preview) {
      if (this.activePreview) {
        this.previewHistoryStack.push(JSON.parse(JSON.stringify(this.activePreview)));
        if (this.previewHistoryStack.length > 5) this.previewHistoryStack.shift();
      }
      this.activePreview = preview;
    } else {
      this.activePreview = null;
    }
  }

  public getActivePreview(): GeneratedPlaylistPreview | null {
    return this.activePreview;
  }

  public undo(): boolean {
    if (this.previewHistoryStack.length > 0) {
      this.activePreview = this.previewHistoryStack.pop() || null;
      return true;
    }
    return false;
  }

  public clearSession(): void {
    this.activePreview = null;
    this.previewHistoryStack = [];
  }

  public renameActivePreview(newName: string): void {
    if (this.activePreview && newName.trim()) {
      this.previewHistoryStack.push(JSON.parse(JSON.stringify(this.activePreview)));
      this.activePreview.name = newName.trim();
    }
  }

  public removeTrackFromActivePreview(trackId: string): void {
    if (this.activePreview) {
      this.previewHistoryStack.push(JSON.parse(JSON.stringify(this.activePreview)));
      this.activePreview.tracks = this.activePreview.tracks.filter(t => t.id !== trackId);
      this.recalculateComposition(this.activePreview);
    }
  }

  public updatePreviewTracks(newTracks: UnifiedTrack[]): void {
    if (this.activePreview) {
      this.previewHistoryStack.push(JSON.parse(JSON.stringify(this.activePreview)));
      this.activePreview.tracks = newTracks;
      this.recalculateComposition(this.activePreview);
    }
  }

  public recalculateComposition(preview: GeneratedPlaylistPreview): void {
    let localCount = 0;
    let onlineFullCount = 0;
    let previewCount = 0;
    let totalDur = 0;

    for (const t of preview.tracks) {
      totalDur += t.duration || 0;
      if (t.playbackCapability === 'local_file' || t.providerId === 'local') {
        localCount++;
      } else if (t.playbackCapability === 'full_stream') {
        onlineFullCount++;
      } else if (t.playbackCapability === 'preview_stream') {
        previewCount++;
      }
    }

    preview.totalDuration = totalDur;
    preview.composition = {
      localCount,
      onlineFullCount,
      previewCount,
      excludedExternalCount: preview.composition?.excludedExternalCount || 0,
    };
  }
}

export const playlistIntentService = new PlaylistIntentService();
