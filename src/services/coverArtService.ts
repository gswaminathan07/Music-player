import { offlineStorage } from './offlineStorage';

/**
 * Official Cover Art Retrieval & High-Resolution Image Service
 *
 * 1. Checks backend `/api/cover-art` which queries iTunes and Deezer official releases.
 * 2. Directly fallbacks to iTunes Client Search API if server is unreachable.
 * 3. Transforms all cover art URLs to maximum available resolution (1200x1200 master quality).
 * 4. Caches all discovered artwork locally in IndexedDB KV store so it works offline.
 * 5. Generates high-resolution 1200x1200 procedural picture disc artwork when tracks have no online artwork.
 */

// In-memory cache for instantaneous synchronous/hook access
const memoryCoverCache = new Map<string, string>();

/**
 * Enhances any cover art URL to maximum high-resolution quality
 */
export function getHighQualityCoverUrl(url: string | undefined): string {
  if (!url) return '';

  // Apple Music / iTunes CDN: convert low-res 100x100 or 600x600 to 1200x1200 ultra crisp master
  if (url.includes('mzstatic.com') || url.includes('apple.com')) {
    return url.replace(/\/\d+x\d+bb\.(jpg|jpeg|png)/, '/1200x1200bb.jpg');
  }

  // Deezer CDN: convert to 1000x1000 master
  if (url.includes('dzcdn.net') || url.includes('deezer.com')) {
    return url.replace(/\/\d+x\d+-\d+-\d+-\d+-\d+\.jpg/, '/1000x1000-000000-80-0-0.jpg');
  }

  // Unsplash CDN: maximize width and high quality
  if (url.includes('unsplash.com')) {
    const base = url.split('?')[0];
    return `${base}?auto=format&fit=crop&w=1200&q=95`;
  }

  return url;
}

import { cleanDownloaderJunk } from '../utils/trackFormatter';

export interface IdentifiedTrackInfo {
  coverUrl: string;
  album?: string;
  artist?: string;
  title?: string;
  source?: string;
  year?: number;
}

function cleanQueryString(text: string): string {
  return cleanDownloaderJunk(text);
}

function getCacheKey(title: string, artist?: string, album?: string): string {
  const t = cleanQueryString(title).toLowerCase();
  const a = (artist || '').toLowerCase().trim();
  const alb = (album || '').toLowerCase().trim();
  return `cov_${t}_${a}_${alb}`;
}

/**
 * Searches iTunes API directly from browser as client-side fallback
 */
async function searchItunesDirect(
  query: string,
  entity: 'song' | 'album' = 'song'
): Promise<IdentifiedTrackInfo | null> {
  const tryFetch = async (countryParam: string) => {
    try {
      const encoded = encodeURIComponent(query);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(
        `https://itunes.apple.com/search?term=${encoded}&entity=${entity}&limit=1${countryParam}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (!res.ok) return null;
      const data = await res.json();
      if (data.results && data.results.length > 0 && data.results[0].artworkUrl100) {
        const item = data.results[0];
        return {
          coverUrl: getHighQualityCoverUrl(item.artworkUrl100),
          album: item.collectionName,
          artist: item.artistName,
          title: item.trackName,
          source: `itunes-client${countryParam}`,
          year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  // 1. Try with country=IN first (covers Tamil/Indian music)
  const inResult = await tryFetch('&country=IN');
  if (inResult) return inResult;

  // 2. Try global
  return await tryFetch('');
}

/**
 * Generates an ultra high-resolution (1000x1000) procedural studio vinyl picture disc artwork
 */
export function generateProceduralCover(
  title: string,
  artist: string,
  genre: string = 'Electronic'
): string {
  if (typeof document === 'undefined') return '';

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Deterministic hash based on track attributes
    const str = `${title}-${artist}-${genre}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }

    const palettes = [
      ['#09090b', '#18181b', '#f97316', '#fb923c', '#fdba74'], // Obsidian & Warm Amber
      ['#09090b', '#1c1917', '#ef4444', '#f87171', '#fca5a5'], // Charcoal & Deep Crimson
      ['#050811', '#0f172a', '#06b6d4', '#22d3ee', '#67e8f9'], // Midnight Abyss & Electric Cyan
      ['#0a0712', '#181124', '#8b5cf6', '#a855f7', '#c084fc'], // Studio Violet & Neon Orchid
      ['#050a08', '#0c1a14', '#10b981', '#34d399', '#6ee7b7'], // Analog Tape & Studio Emerald
      ['#120e06', '#1c1508', '#eab308', '#facc15', '#fde047'], // Antique Brass & Pure Gold
    ];

    const pIndex = Math.abs(hash) % palettes.length;
    const [bgDark, bgMid, accent, accentLight, accentGlow] = palettes[pIndex];

    // 1. Base Rich Radial Gradient
    const grad = ctx.createRadialGradient(500, 500, 50, 500, 500, 560);
    grad.addColorStop(0, bgMid);
    grad.addColorStop(0.7, bgDark);
    grad.addColorStop(1, '#050505');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1000, 1000);

    // 2. High-Precision Studio Picture-Disc Circular Bands
    ctx.save();
    for (let i = 1; i <= 14; i++) {
      const radius = 90 + i * 28;
      ctx.beginPath();
      ctx.arc(500, 500, radius, 0, Math.PI * 2);
      ctx.strokeStyle = i % 3 === 0 ? accent : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = i % 3 === 0 ? 2 : 1;
      ctx.stroke();
    }
    ctx.restore();

    // 3. Dynamic Acoustic Diagonal Beam
    ctx.save();
    const beamGrad = ctx.createLinearGradient(100, 900, 900, 100);
    beamGrad.addColorStop(0, 'transparent');
    beamGrad.addColorStop(0.48, 'rgba(255, 255, 255, 0.02)');
    beamGrad.addColorStop(0.5, accentGlow);
    beamGrad.addColorStop(0.52, 'rgba(255, 255, 255, 0.02)');
    beamGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = beamGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(80, 920);
    ctx.lineTo(920, 80);
    ctx.stroke();
    ctx.restore();

    // 4. Strobe Marks on outer rim (classic Technics 1200 style)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    const strobeCount = 72;
    for (let i = 0; i < strobeCount; i++) {
      const angle = (i * 2 * Math.PI) / strobeCount;
      const x = 500 + Math.cos(angle) * 475;
      const y = 500 + Math.sin(angle) * 475;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 5. Center Badge with Track Metadata
    ctx.save();
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(500, 500, 170, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Secondary inner gold/accent ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(500, 500, 155, 0, Math.PI * 2);
    ctx.stroke();

    // Official vinyl record label typography
    ctx.fillStyle = accentLight;
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('33⅓ RPM · STEREO', 500, 420);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    const displayTitle = title.length > 22 ? title.slice(0, 20) + '…' : title;
    ctx.fillText(displayTitle, 500, 475);

    ctx.fillStyle = accent;
    ctx.font = '600 24px system-ui, -apple-system, sans-serif';
    const displayArtist = artist.length > 26 ? artist.slice(0, 24) + '…' : artist;
    ctx.fillText(displayArtist, 500, 520);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '18px monospace';
    ctx.fillText(genre.toUpperCase(), 500, 565);

    // Center Spindle Hole cutout graphic
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.arc(500, 500, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();

    return canvas.toDataURL('image/jpeg', 0.95);
  } catch {
    return '';
  }
}

// In-memory track metadata cache for fast identification lookups
const memoryTrackInfoCache = new Map<string, IdentifiedTrackInfo>();

/**
 * Accurately identifies a song and which official album/soundtrack it is from,
 * retrieving high-resolution 1200x1200 official album cover art.
 * Specially tuned for English songs and Tamil/regional Indian songs.
 */
export async function identifyTrackOnline(
  title: string,
  artist?: string,
  album?: string
): Promise<IdentifiedTrackInfo | null> {
  const cleanTitle = cleanQueryString(title);
  const cleanArtist =
    artist && !/^(unknown|local artist|device music|track artist|unknown artist|masstamilan|starmusiq)$/i.test(artist)
      ? artist.trim()
      : '';
  const cleanAlbum = album ? cleanQueryString(album) : '';

  const cacheKey = getCacheKey(cleanTitle, cleanArtist, cleanAlbum);

  // 1. Check in-memory metadata cache
  if (memoryTrackInfoCache.has(cacheKey)) {
    return memoryTrackInfoCache.get(cacheKey)!;
  }

  // 2. Check IndexedDB persistent store
  try {
    const cachedInfo = await offlineStorage.getKV<IdentifiedTrackInfo>(`track_info_${cacheKey}`);
    if (cachedInfo && cachedInfo.coverUrl) {
      cachedInfo.coverUrl = getHighQualityCoverUrl(cachedInfo.coverUrl);
      memoryTrackInfoCache.set(cacheKey, cachedInfo);
      memoryCoverCache.set(cacheKey, cachedInfo.coverUrl);
      return cachedInfo;
    }
  } catch {
    // Continue
  }

  // 3. Query backend /api/cover-art endpoint (with multi-region iTunes IN/Global & Deezer)
  if (cleanTitle || cleanAlbum) {
    try {
      const params = new URLSearchParams();
      if (cleanTitle) params.set('title', cleanTitle);
      if (cleanArtist) params.set('artist', cleanArtist);
      if (cleanAlbum) params.set('album', cleanAlbum);

      const res = await fetch(`/api/cover-art?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.coverUrl) {
          const highRes = getHighQualityCoverUrl(data.coverUrl);
          const identified: IdentifiedTrackInfo = {
            coverUrl: highRes,
            album: data.album,
            artist: data.artist,
            title: data.title || cleanTitle,
            source: data.source,
            year: data.year,
          };
          memoryTrackInfoCache.set(cacheKey, identified);
          memoryCoverCache.set(cacheKey, highRes);
          offlineStorage.setKV(`track_info_${cacheKey}`, identified).catch(() => {});
          offlineStorage.setKV(`cover_art_${cacheKey}`, highRes).catch(() => {});
          return identified;
        }
      }
    } catch {
      // Backend request failed, proceed to client fallback
    }

    // 4. Client-side direct query to iTunes (with country=IN for Tamil music)
    try {
      const query = cleanArtist ? `${cleanArtist} ${cleanAlbum || cleanTitle}` : cleanTitle;
      if (query && query.length >= 2) {
        // Try album search first
        if (cleanAlbum && cleanArtist) {
          const albumRes = await searchItunesDirect(`${cleanArtist} ${cleanAlbum}`, 'album');
          if (albumRes) {
            memoryTrackInfoCache.set(cacheKey, albumRes);
            memoryCoverCache.set(cacheKey, albumRes.coverUrl);
            offlineStorage.setKV(`track_info_${cacheKey}`, albumRes).catch(() => {});
            offlineStorage.setKV(`cover_art_${cacheKey}`, albumRes.coverUrl).catch(() => {});
            return albumRes;
          }
        }

        // Try song search
        const songRes = await searchItunesDirect(query, 'song');
        if (songRes) {
          memoryTrackInfoCache.set(cacheKey, songRes);
          memoryCoverCache.set(cacheKey, songRes.coverUrl);
          offlineStorage.setKV(`track_info_${cacheKey}`, songRes).catch(() => {});
          offlineStorage.setKV(`cover_art_${cacheKey}`, songRes.coverUrl).catch(() => {});
          return songRes;
        }
      }
    } catch {
      // Continue
    }
  }

  return null;
}

/**
 * Finds or retrieves official high-resolution album or disk cover art for a track
 */
export async function fetchCoverArtForTrack(
  title: string,
  artist?: string,
  album?: string,
  genre?: string
): Promise<string> {
  const cleanTitle = cleanQueryString(title);
  const cleanArtist =
    artist && !/^(unknown|local artist|device music|track artist|unknown artist|masstamilan|starmusiq)$/i.test(artist)
      ? artist.trim()
      : '';
  const cleanAlbum = album ? cleanQueryString(album) : '';

  const cacheKey = getCacheKey(cleanTitle, cleanArtist, cleanAlbum);

  // 1. Check in-memory cover cache
  if (memoryCoverCache.has(cacheKey)) {
    return memoryCoverCache.get(cacheKey)!;
  }

  // 2. Identify track online (checks IndexedDB & APIs)
  const identified = await identifyTrackOnline(title, artist, album);
  if (identified && identified.coverUrl) {
    return identified.coverUrl;
  }

  // 3. Fallback: High-resolution Studio Vinyl Picture-Disc procedural canvas
  const procedural = generateProceduralCover(cleanTitle || title, cleanArtist || 'Studio Master', genre);
  if (procedural) {
    memoryCoverCache.set(cacheKey, procedural);
    offlineStorage.setKV(`cover_art_${cacheKey}`, procedural).catch(() => {});
    return procedural;
  }

  return '';
}
