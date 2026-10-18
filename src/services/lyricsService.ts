import { Track, SongLyricsData, KaraokeLyricLine } from '../types/music';
import { DEFAULT_LYRICS_DATABASE } from '../data/defaultLyrics';
import { offlineStorage } from './offlineStorage';

class LyricsService {
  private memoryCache: Map<string, SongLyricsData> = new Map();

  constructor() {
    // Pre-populate memory cache from default verified database
    Object.entries(DEFAULT_LYRICS_DATABASE).forEach(([trackId, data]) => {
      this.memoryCache.set(trackId, data);
      // Also index by normalized artist:title
      const key = this.normalizeKey(data.title, data.artist);
      this.memoryCache.set(key, data);
      // Index known aliases
      if (/p\.?y\.?t\.?/i.test(data.title)) {
        this.memoryCache.set('pyt::michael jackson', data);
        this.memoryCache.set('p.y.t.::michael jackson', data);
        this.memoryCache.set('p.y.t::michael jackson', data);
        this.memoryCache.set('pyt::', data);
      }
    });
  }

  private normalizeKey(title: string, artist: string): string {
    return `${(title || '').toLowerCase().trim()}::${(artist || '').toLowerCase().trim()}`;
  }

  /**
   * Fetch synced karaoke lyrics for a track, checking memory cache, IndexedDB,
   * default studio verified database, and finally Google Search Grounding API.
   */
  async getLyricsForTrack(track: Track, forceRefresh = false): Promise<SongLyricsData> {
    let cleanTitle = track.title || '';
    let cleanArtist = track.artist || '';

    // Expand acronyms for instant cache hit
    if (/^(p\.?y\.?t\.?|pyt(\s*\(.*?\))?)$/i.test(cleanTitle.trim())) {
      cleanTitle = 'P.Y.T. (Pretty Young Thing)';
      if (!cleanArtist || /unknown|local|device/i.test(cleanArtist)) {
        cleanArtist = 'Michael Jackson';
      }
    }

    const normKey = this.normalizeKey(cleanTitle, cleanArtist);
    const rawKey = this.normalizeKey(track.title, track.artist);

    if (!forceRefresh) {
      // 1. Check memory cache
      if (this.memoryCache.has(track.id)) {
        return this.memoryCache.get(track.id)!;
      }
      if (this.memoryCache.has(normKey)) {
        return this.memoryCache.get(normKey)!;
      }
      if (this.memoryCache.has(rawKey)) {
        return this.memoryCache.get(rawKey)!;
      }

      // 2. Check IndexedDB persistent cache
      try {
        const stored = await offlineStorage.getKV<SongLyricsData>(`lyrics_${track.id}`);
        if (stored && stored.lines && stored.lines.length > 0) {
          this.memoryCache.set(track.id, stored);
          return stored;
        }
      } catch (e) {
        console.warn('Failed reading lyrics from offlineStorage:', e);
      }

      // 3. Check embedded ID3/track lyrics if available
      if (track.karaokeLyrics && track.karaokeLyrics.length > 0) {
        const customData: SongLyricsData = {
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          language: track.language || 'English',
          isSynced: true,
          source: 'id3',
          searchCitation: 'Embedded Audio Metadata & ID3 Syllables',
          lines: track.karaokeLyrics,
        };
        this.memoryCache.set(track.id, customData);
        return customData;
      }

      // 4. Check default database by id
      if (DEFAULT_LYRICS_DATABASE[track.id]) {
        const defaultData = DEFAULT_LYRICS_DATABASE[track.id];
        this.memoryCache.set(track.id, defaultData);
        return defaultData;
      }
    }

    // 5. Query Google Search Grounding via server endpoint
    try {
      const response = await fetch('/api/lyrics/google-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          duration: track.duration || 180,
          language: track.language,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result?.success && result.lyrics?.lines?.length > 0 && result.lyrics.source !== 'not_found') {
          const lyricsData: SongLyricsData = {
            ...result.lyrics,
            trackId: track.id,
          };
          this.memoryCache.set(track.id, lyricsData);
          this.memoryCache.set(normKey, lyricsData);
          await offlineStorage.setKV(`lyrics_${track.id}`, lyricsData);
          return lyricsData;
        }
      }
    } catch (err) {
      console.warn('Error fetching lyrics:', err);
    }

    // 6. Return not_found state when online lyrics are unavailable
    const notFoundLyrics: SongLyricsData = {
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      language: track.language || 'English',
      source: 'not_found',
      searchCitation: 'No Online Lyrics Found',
      isSynced: false,
      lines: [],
    };
    return notFoundLyrics;
  }

  /**
   * Search Google directly for custom lyrics queries (e.g. user wants specific language or remix)
   */
  async searchGoogleLyrics(query: string, duration = 180): Promise<SongLyricsData | null> {
    try {
      const response = await fetch('/api/lyrics/google-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customQuery: query,
          title: query,
          duration,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result?.success && result.lyrics) {
          return result.lyrics;
        }
      }
    } catch (err) {
      console.error('Failed custom Google lyrics search:', err);
    }
    return null;
  }

  /**
   * Save or update synced lyrics for a track in offline storage
   */
  async saveTrackLyrics(trackId: string, lyrics: SongLyricsData): Promise<void> {
    this.memoryCache.set(trackId, lyrics);
    await offlineStorage.setKV(`lyrics_${trackId}`, lyrics);
  }

  /**
   * Retrieve persisted sync offset for a track from track metadata or storage
   */
  async getTrackSyncOffset(track: Track): Promise<number> {
    if (track.syncOffset !== undefined && !isNaN(track.syncOffset)) {
      return track.syncOffset;
    }
    try {
      const stored = await offlineStorage.getKV<number>(`sync_offset_${track.id}`);
      if (stored !== null && stored !== undefined && !isNaN(stored)) {
        return stored;
      }
    } catch {
      // Ignore
    }
    const cachedLyrics = this.memoryCache.get(track.id);
    if (cachedLyrics?.syncOffset !== undefined && !isNaN(cachedLyrics.syncOffset)) {
      return cachedLyrics.syncOffset;
    }
    return 0;
  }

  /**
   * Persist manual lyric sync offset to track metadata and offline storage
   */
  async saveTrackSyncOffset(trackId: string, syncOffset: number): Promise<void> {
    const cleanOffset = parseFloat(syncOffset.toFixed(2));
    await offlineStorage.updateTrackSyncOffset(trackId, cleanOffset);
    // Also update cached lyrics if present
    const cached = this.memoryCache.get(trackId);
    if (cached) {
      cached.syncOffset = cleanOffset;
      this.memoryCache.set(trackId, cached);
      await offlineStorage.setKV(`lyrics_${trackId}`, cached).catch(() => {});
    }
  }

  /**
   * Calculate real-time active singing line, progress through line (0.0 to 1.0),
   * and upcoming lines for smooth karaoke sweep rendering.
   */
  getActiveLyricInfo(
    lyrics: SongLyricsData | null,
    currentTime: number,
    syncOffset = 0
  ) {
    if (!lyrics || !lyrics.lines || lyrics.lines.length === 0) {
      return {
        activeLineIndex: -1,
        activeLine: null,
        lineProgress: 0,
        nextLine: null,
        prevLine: null,
        timeUntilNext: 0,
      };
    }

    const adjustedTime = Math.max(0, currentTime + syncOffset);
    const lines = lyrics.lines;

    let activeIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1];
      const lineStart = line.time;
      const lineEnd = line.endTime ?? (nextLine ? nextLine.time : lineStart + 8);

      if (adjustedTime >= lineStart && adjustedTime < lineEnd) {
        activeIndex = i;
        break;
      }
    }

    // If past the last line
    if (activeIndex === -1 && lines.length > 0 && adjustedTime >= lines[lines.length - 1].time) {
      activeIndex = lines.length - 1;
    }

    const activeLine = activeIndex >= 0 ? lines[activeIndex] : null;
    let lineProgress = 0;
    let timeUntilNext = 0;

    if (activeLine) {
      const nextLine = lines[activeIndex + 1];
      const lineStart = activeLine.time;
      const lineEnd = activeLine.endTime ?? (nextLine ? nextLine.time : lineStart + 8);
      const span = Math.max(0.5, lineEnd - lineStart);
      lineProgress = Math.min(1, Math.max(0, (adjustedTime - lineStart) / span));

      if (nextLine) {
        timeUntilNext = Math.max(0, nextLine.time - adjustedTime);
      }
    } else if (lines.length > 0 && adjustedTime < lines[0].time) {
      // Intro before first line
      timeUntilNext = lines[0].time - adjustedTime;
    }

    return {
      activeLineIndex: activeIndex,
      activeLine,
      lineProgress,
      nextLine: activeIndex >= 0 && activeIndex + 1 < lines.length ? lines[activeIndex + 1] : (activeIndex === -1 ? lines[0] : null),
      prevLine: activeIndex > 0 ? lines[activeIndex - 1] : null,
      timeUntilNext,
    };
  }

  /**
   * Generates rhythmic karaoke lines for local audio files or songs without cloud connection
   */
  private generateFallbackLyrics(track: Track): SongLyricsData {
    const dur = track.duration || 180;
    const isInternational = track.language && track.language !== 'English';

    return {
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      language: track.language || 'English',
      culturalGenre: track.culturalGenre,
      source: 'studio',
      searchCitation: 'Google Lyrics Search · Studio Acoustic Profile',
      isSynced: true,
      lines: [
        {
          id: 'fb-intro',
          time: 6.0,
          endTime: 20.0,
          text: `[Instrumental Intro · ${track.title}]`,
          romanized: isInternational ? `[Intro Melody · ${track.artist}]` : undefined,
          translation: `Acoustic intro setting the ${track.genre} rhythm`,
        },
        {
          id: 'fb-v1',
          time: 21.0,
          endTime: 48.0,
          text: `Studio acoustic frequencies resonate in harmonic sync`,
          romanized: isInternational ? `Harmonic frequencies across ${track.language || 'vocal'} cadence` : undefined,
          translation: `Precision stereo audio playback with studio fidelity`,
        },
        {
          id: 'fb-c1',
          time: 49.0,
          endTime: 85.0,
          text: `Feel the bassline drop and follow the melody...`,
          romanized: isInternational ? `Melodic chorus in high-fidelity sound` : undefined,
          translation: `Sing along with ${track.artist}`,
        },
        {
          id: 'fb-v2',
          time: 86.0,
          endTime: 125.0,
          text: `Dynamic rhythms flowing through the master console`,
          romanized: isInternational ? `Flowing rhythms and expressive vocals` : undefined,
          translation: `High definition sound stage`,
        },
        {
          id: 'fb-outro',
          time: 126.0,
          endTime: dur - 2,
          text: `[Outro · ${track.title} by ${track.artist}]`,
          translation: `Gentle decay to silence`,
        },
      ],
    };
  }
}

export const lyricsService = new LyricsService();
