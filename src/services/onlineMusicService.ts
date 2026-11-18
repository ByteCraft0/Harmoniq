import { OnlineSearchResult } from '../types/online';
import { libraryService } from './libraryService';
import { TrackMetadata } from '../types/audio';

const SEARCH_CACHE = new Map<string, { timestamp: number; results: OnlineSearchResult[] }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class OnlineMusicService {
  /**
   * Search open legitimate catalogs (e.g. Internet Archive Public Audio)
   */
  public async searchOnline(
    query: string,
    filter: 'all' | 'song' | 'artist' | 'album' = 'all',
    signal?: AbortSignal
  ): Promise<OnlineSearchResult[]> {
    const cleanQ = query.trim();
    if (!cleanQ) return [];

    const cacheKey = `${filter}:${cleanQ.toLowerCase()}`;
    const cached = SEARCH_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.results;
    }

    try {
      let fieldQuery = `(title:("${cleanQ}") OR creator:("${cleanQ}") OR description:("${cleanQ}"))`;
      if (filter === 'song') {
        fieldQuery = `title:("${cleanQ}")`;
      } else if (filter === 'artist') {
        fieldQuery = `creator:("${cleanQ}")`;
      } else if (filter === 'album') {
        fieldQuery = `(album:("${cleanQ}") OR title:("${cleanQ}"))`;
      }

      const url = `https://archive.org/advancedsearch.php?q=mediatype:audio%20AND%20${encodeURIComponent(
        fieldQuery
      )}&fl[]=identifier,title,creator,album,year,description,downloads&sort[]=downloads%20desc&rows=20&output=json`;

      const response = await fetch(url, { signal });
      if (!response.ok) {
        throw new Error(`Archive.org API returned status ${response.status}`);
      }

      const data = await response.json();
      const docs = data?.response?.docs || [];

      const results: OnlineSearchResult[] = docs.map((doc: any) => {
        const id = doc.identifier || Math.random().toString(36).substring(2);
        const title = doc.title || 'Untitled Audio';
        const artist = doc.creator || 'Unknown Artist';
        const album = doc.album || undefined;
        const year = doc.year ? parseInt(doc.year, 10) : undefined;

        return {
          id: `ia_${id}`,
          title: Array.isArray(title) ? title[0] : title,
          artist: Array.isArray(artist) ? artist[0] : artist,
          album: Array.isArray(album) ? album[0] : album,
          year: isNaN(year!) ? undefined : year,
          source: 'Internet Archive',
          detailUrl: `https://archive.org/details/${id}`,
          streamUrl: `https://archive.org/download/${id}/${id}_vbr.mp3`,
          artworkUrl: `https://archive.org/services/img/${id}`,
          license: 'Public Domain / Creative Commons',
          format: 'MP3',
        };
      });

      SEARCH_CACHE.set(cacheKey, { timestamp: Date.now(), results });
      return results;
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      console.warn('Online music search API error, returning curated fallback items:', e);
      // Return curated public domain archive samples matching query if offline
      return this.getCuratedPublicDomainSamples(cleanQ);
    }
  }

  /**
   * Search local library tracks matching the query
   */
  public searchLocal(query: string): TrackMetadata[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return libraryService.getAllTracks().filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q)) ||
        (t.genre && t.genre.toLowerCase().includes(q))
    );
  }

  /**
   * Fallback curated public domain archive tracks
   */
  private getCuratedPublicDomainSamples(query: string): OnlineSearchResult[] {
    const q = query.toLowerCase();
    const curated: OnlineSearchResult[] = [
      {
        id: 'ia_beethoven_sym5',
        title: 'Symphony No. 5 in C Minor, Op. 67 - I. Allegro con brio',
        artist: 'Ludwig van Beethoven',
        album: 'Beethoven: Symphonies Nos. 5 & 7',
        year: 1808,
        source: 'Internet Archive',
        detailUrl: 'https://archive.org/details/beethovensymphon00ludw',
        streamUrl: 'https://ia800301.us.archive.org/15/items/beethovensymphon00ludw/01_AllegroConBrio.mp3',
        artworkUrl: 'https://archive.org/services/img/beethovensymphon00ludw',
        license: 'Public Domain (Musopen)',
        format: 'MP3',
      },
      {
        id: 'ia_bach_air',
        title: 'Orchestral Suite No. 3 in D major, BWV 1068 - II. Air',
        artist: 'Johann Sebastian Bach',
        album: 'Bach Orchestral Suites',
        year: 1731,
        source: 'Internet Archive',
        detailUrl: 'https://archive.org/details/bach_orchestral_suites',
        streamUrl: 'https://ia800504.us.archive.org/11/items/bach_orchestral_suites/02_Air.mp3',
        artworkUrl: 'https://archive.org/services/img/bach_orchestral_suites',
        license: 'Public Domain',
        format: 'MP3',
      },
      {
        id: 'ia_chopin_nocturne',
        title: 'Nocturne in E-flat major, Op. 9, No. 2',
        artist: 'Frédéric Chopin',
        album: 'Chopin Nocturnes',
        year: 1832,
        source: 'Internet Archive',
        detailUrl: 'https://archive.org/details/ChopinNocturneOp9No2',
        streamUrl: 'https://ia800207.us.archive.org/29/items/ChopinNocturneOp9No2/NocturneOp9No2.mp3',
        artworkUrl: 'https://archive.org/services/img/ChopinNocturneOp9No2',
        license: 'Public Domain',
        format: 'MP3',
      },
      {
        id: 'ia_clair_de_lune',
        title: 'Suite Bergamasque - III. Clair de Lune',
        artist: 'Claude Debussy',
        album: 'Debussy Piano Works',
        year: 1905,
        source: 'Internet Archive',
        detailUrl: 'https://archive.org/details/DebussyClairDeLune',
        streamUrl: 'https://ia800301.us.archive.org/20/items/DebussyClairDeLune/clairdelune.mp3',
        artworkUrl: 'https://archive.org/services/img/DebussyClairDeLune',
        license: 'Public Domain',
        format: 'MP3',
      },
    ];

    return curated.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.artist.toLowerCase().includes(q) ||
        (c.album && c.album.toLowerCase().includes(q))
    );
  }
}

export const onlineMusicService = new OnlineMusicService();
