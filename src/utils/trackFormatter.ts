import { Track } from '../types/music';

/**
 * Robust regex to strip leading track numbers, catalog indices, phone numbering,
 * or downloader prefixes (e.g., "378 ", "375,203 ", "378. ", "378 - ", "01 - ", "[378]", "#378 ").
 */
const LEADING_NUMBER_REGEX = /^(\s*#?\d+([\s,.-]+\d+)*[\s._\-–—:)]+)+/i;
const BRACKETED_NUMBER_REGEX = /^\[\s*\d+\s*\]\s*|^\(\s*\d+\s*\)\s*/;

/**
 * Suffixes commonly appended by YouTube downloaders or rippers.
 */
const JUNK_SUFFIX_REGEX =
  /\s*(\[|\()(Official\s*(Video|Audio|Music\s*Video|Lyric\s*Video|HD|HQ|4K|1080p|Remaster(ed)?)|Lyrics?|Audio|HQ|HD|Explicit|Visualizer|Live)(\]|\))\s*$/gi;

const FILE_EXTENSIONS_REGEX = /\.(mp3|wav|flac|m4a|aac|ogg|opus|wma|aiff|alac)$/i;

/**
 * Deep cleaner to strip website watermarks, rippers, bitrates, and downloader junk
 * (e.g. Masstamilan, Starmusiq, Isaimini, Tamilwire, 320kbps, 128kbps, etc.)
 */
export function cleanDownloaderJunk(text: string): string {
  if (!text) return '';
  let s = text;
  // 1. Remove bracketed website watermarks, rippers, or bitrates
  s = s.replace(/\[[^\]]*(?:masstamilan|starmusiq|isaimini|tamilwire|sensong|kuttyweb|mallumusic|atozmp3|naasong|pagalworld|mp3mad|hungama|gaana|jiosaavn|wynk|320\s*kbps|128\s*kbps|kbps|rip|official|audio|video|lyrics?|download)[^\]]*\]/gi, '');
  s = s.replace(/\([^)]*(?:masstamilan|starmusiq|isaimini|tamilwire|sensong|kuttyweb|mallumusic|atozmp3|naasong|pagalworld|mp3mad|hungama|gaana|jiosaavn|wynk|320\s*kbps|128\s*kbps|kbps|rip|official|audio|video|lyrics?|download)[^)]*\)/gi, '');
  // 2. Standalone downloader domains or tags
  s = s.replace(/\b(?:masstamilan|starmusiq|isaimini|tamilwire|sensongsmp3?|kuttyweb|mallumusic|atozmp3|naasongs?|pagalworld|mp3mad)[a-z0-9._-]*\b/gi, '');
  s = s.replace(/(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:com|dev|in|so|net|org|co|info|cc|xyz|vip)\b/gi, '');
  s = s.replace(/\b\d{2,3}\s*k(?:bps)?\b/gi, '');
  // 3. Language & media tags
  s = s.replace(/\[(?:Tamil|Telugu|Hindi|Malayalam|Kannada)\]/gi, '');
  s = s.replace(/\((?:Tamil|Telugu|Hindi|Malayalam|Kannada)\)/gi, '');
  // 4. File extensions
  s = s.replace(FILE_EXTENSIONS_REGEX, '');
  // 5. Clean repeated hyphens and edge characters
  s = s.replace(/\s*[-–—]\s*[-–—]\s*/g, ' - ');
  s = s.replace(/^[-–—:._|~/\s]+|[-–—:._|~/\s]+$/g, '');
  return s.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Strips leading numbers/indexes from a string.
 */
export function stripLeadingNumbers(str: string): string {
  if (!str) return '';
  let cleaned = cleanDownloaderJunk(str);

  // Strip file extension if present
  cleaned = cleaned.replace(FILE_EXTENSIONS_REGEX, '').trim();

  // Strip bracketed numbers like [01] or (378)
  cleaned = cleaned.replace(BRACKETED_NUMBER_REGEX, '').trim();

  // Strip leading numbering like "378 ", "378. ", "378 - ", "375,203 ", "01 - ", etc.
  cleaned = cleaned.replace(LEADING_NUMBER_REGEX, '').trim();

  // Check again for standalone leading numbers followed by space or hyphen (e.g. "378 Drake")
  cleaned = cleaned.replace(/^#?\d{1,6}\s+[-–—]?\s*/, '').trim();

  // If the whole string is just numbers and punctuation (e.g. "378" or "375,203"), blank it out
  if (/^#?[\d\s,.-]+$/.test(cleaned)) {
    return '';
  }

  // Clean trailing hyphens or separators left behind
  cleaned = cleaned.replace(/^[-–—:._|~]\s*/, '').trim();

  return cleaned;
}

/**
 * Known common artist name separators in song titles.
 */
const SEPARATORS = [
  ' - ',
  ' – ',
  ' — ',
  ' ~ ',
  ' | ',
  ' / ',
  ' _-_ ',
  ': ',
];

const KNOWN_SINGLE_NAME_ARTISTS = new Set([
  'thamarai',
  'karthik',
  'anirudh',
  'aravind',
  'chithra',
  'spb',
  'yesudas',
  'hariharan',
  'tiwa',
  'adele',
  'drake',
  'eminem',
  'beyonce',
  'rihanna',
  'madonna',
  'prince',
  'sting',
  'lorde',
  'sia',
  'usher',
  'enya',
]);

/**
 * Cleans and separates raw title and artist into pristine, separated fields.
 * Scans through title text to extract artist names and move them to the artist field.
 */
export function cleanTrackMetadata(
  rawTitle: string,
  rawArtist?: string,
  rawAlbum?: string
): { title: string; artist: string; album?: string } {
  let titleStr = (rawTitle || '').trim();
  let artistStr = (rawArtist || '').trim();

  // 1. Strip file extension from title if present
  titleStr = titleStr.replace(FILE_EXTENSIONS_REGEX, '').trim();

  // 2. Remove junk downloader tags like (Official Video), [Lyrics], etc.
  titleStr = titleStr.replace(JUNK_SUFFIX_REGEX, '').trim();

  // 3. Normalize common underscore separators
  if (titleStr.includes('_-_')) {
    titleStr = titleStr.replace(/_-_/g, ' - ');
  }

  // 4. Strip leading numbers from title (e.g. "378", "375,203", "378 - ")
  titleStr = stripLeadingNumbers(titleStr);

  const isDefaultArtist =
    !artistStr ||
    artistStr === 'Local Artist' ||
    artistStr === 'Unknown Artist' ||
    artistStr === 'Device Music' ||
    artistStr === 'Unknown' ||
    artistStr === 'Track Artist';

  // 5. Handle semicolon-delimited artist sequences embedded in titles:
  // e.g. "Shaun Martin;Geno Young All In A Days' Work"
  // e.g. "Mathieu Fiset;Larnell Lewis;Jordan Rudess One More !!!"
  // e.g. "John Murphy;David Fleming Theme from Superman (Official Trailer V..."
  // e.g. "Harris Jayaraj;K. S. Chithra;Thamarai Idhuthaanaa"
  // e.g. "Nivas K Prasanna;K. S. Chithra;Sriram Parthasarathy Konji Pesida Ven..."
  // e.g. "Harris Jayaraj;Vijay Prakash;Gana Bala;Vignesh Shivan Adhaaru Adha..."
  // e.g. "Harris Jayaraj;Karthik;Emcee Jesz;Thamarai Mazhai Vara Pogudhae"
  if (titleStr.includes(';')) {
    const parts = titleStr.split(';');
    const prefixArtists = parts
      .slice(0, -1)
      .map((p) => stripLeadingNumbers(p.trim().replace(/_/g, ' ')))
      .filter(Boolean);
    const lastPart = parts[parts.length - 1].trim();

    const words = lastPart.split(/\s+/);
    if (words.length > 0) {
      let artistWordCount = 2;
      const firstWordLower = words[0].toLowerCase().replace(/[^a-z]/g, '');

      if (words.length <= 2) {
        artistWordCount = 1;
      } else if (KNOWN_SINGLE_NAME_ARTISTS.has(firstWordLower)) {
        artistWordCount = 1;
      } else if (words.length >= 4) {
        artistWordCount = 2;
      } else {
        artistWordCount = 1;
      }

      const lastArtist = stripLeadingNumbers(words.slice(0, artistWordCount).join(' ').trim());
      const remainingTitle = words.slice(artistWordCount).join(' ').trim();

      const allArtists = [...prefixArtists, lastArtist].filter(Boolean);
      if (allArtists.length > 0 && remainingTitle) {
        artistStr = allArtists.join(', ');
        titleStr = remainingTitle;
      } else if (allArtists.length > 0) {
        artistStr = allArtists.join(', ');
      }
    }
  }

  // 6. Look for standard separators ("Artist - Title" or "Artist / Title" or "Artist: Title")
  let matchedSep: string | null = null;
  for (const sep of SEPARATORS) {
    if (titleStr.includes(sep)) {
      matchedSep = sep;
      break;
    }
  }

  // Also handle tight hyphens if no spaced separator exists: e.g. "378.Drake-Hotline Bling"
  if (!matchedSep && /[a-zA-Z0-9]-[a-zA-Z0-9]/.test(titleStr)) {
    const hyphenIdx = titleStr.indexOf('-');
    const before = titleStr.slice(0, hyphenIdx).trim();
    const after = titleStr.slice(hyphenIdx + 1).trim();
    if (
      before.length > 1 &&
      after.length > 1 &&
      !before.toLowerCase().endsWith('lo') &&
      !before.toLowerCase().endsWith('sci') &&
      !before.toLowerCase().endsWith('mid')
    ) {
      matchedSep = '-';
    }
  }

  if (matchedSep) {
    const parts = titleStr.split(matchedSep);
    const candidateArtist = stripLeadingNumbers(parts[0].trim().replace(/_/g, ' '));
    const candidateTitle = parts.slice(1).join(matchedSep).trim().replace(/_/g, ' ');

    if (candidateArtist && candidateTitle) {
      if (isDefaultArtist) {
        artistStr = candidateArtist;
        titleStr = candidateTitle;
      } else {
        if (candidateArtist.toLowerCase() === artistStr.toLowerCase()) {
          titleStr = candidateTitle;
        } else {
          artistStr = candidateArtist;
          titleStr = candidateTitle;
        }
      }
    }
  } else if (titleStr.toLowerCase().includes(' by ')) {
    // Format: "Title by Artist"
    const match = titleStr.match(/^(.*?)\s+by\s+(.*?)$/i);
    if (match && match[1] && match[2]) {
      titleStr = match[1].trim();
      const extractedArtist = stripLeadingNumbers(match[2].trim());
      if (extractedArtist && isDefaultArtist) {
        artistStr = extractedArtist;
      }
    }
  }

  // 7. Handle single underscore delimited filenames like "Drake_Gods_Plan"
  if (isDefaultArtist && titleStr.includes('_') && !titleStr.includes(' ')) {
    const parts = titleStr.split('_');
    if (parts.length >= 2) {
      const candidateArtist = stripLeadingNumbers(parts[0]);
      const candidateTitle = parts.slice(1).join(' ');
      if (candidateArtist && candidateTitle) {
        artistStr = candidateArtist;
        titleStr = candidateTitle;
      }
    }
  }

  // 8. If artistStr has semicolons (from ID3 tags like "Shaun Martin;Geno Young"), normalize to ", "
  if (artistStr.includes(';')) {
    artistStr = artistStr
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
  }

  // 9. Strip leading numbers from artist as well
  artistStr = stripLeadingNumbers(artistStr);

  // 10. If artist is still embedded inside title at start, remove it
  if (artistStr && titleStr.toLowerCase().startsWith(artistStr.toLowerCase())) {
    const rest = titleStr.slice(artistStr.length).trim();
    if (rest.startsWith('-') || rest.startsWith(':') || rest.startsWith('–') || rest.startsWith('—')) {
      titleStr = rest.replace(/^[-:–—\s]+/, '').trim();
    } else if (rest.length > 0) {
      titleStr = rest;
    }
  }

  // 11. If artist contains file underscores, clean them
  if (artistStr.includes('_')) {
    artistStr = artistStr.replace(/_/g, ' ');
  }

  // 12. Clean leftover underscores in title if any
  if (titleStr.includes('_')) {
    titleStr = titleStr.replace(/_/g, ' ');
  }

  // 13. Strip any leftover junk suffix or edge punctuation
  titleStr = titleStr.replace(JUNK_SUFFIX_REGEX, '').trim();
  titleStr = titleStr.replace(/^[-–—:_|~/\\]\s*/, '').trim();
  titleStr = titleStr.replace(/\s*[-–—:_|~/\\]+$/, '').trim();

  artistStr = artistStr.replace(/^[-–—:_|~/\\]\s*/, '').trim();
  artistStr = artistStr.replace(/\s*[-–—:_|~/\\]+$/, '').trim();

  // Strip leading numbers one final time
  titleStr = stripLeadingNumbers(titleStr);
  artistStr = stripLeadingNumbers(artistStr);

  // 14. Fallbacks
  if (!titleStr) {
    titleStr = 'Audio Track';
  }
  if (!artistStr) {
    artistStr = 'Local Artist';
  }

  // Also clean album if provided
  let albumStr = rawAlbum ? cleanDownloaderJunk(rawAlbum).trim() : undefined;
  if (albumStr && (/masstamilan|starmusiq|isaimini|tamilwire|sensong|kuttyweb|320\s*kbps|128\s*kbps/i.test(albumStr) || albumStr.length < 2)) {
    albumStr = undefined;
  }

  return { title: titleStr, artist: artistStr, album: albumStr };
}

/**
 * Sanitizes an existing Track object in place or returns a cleaned copy.
 */
export function sanitizeTrack(track: Track): Track {
  const { title, artist, album } = cleanTrackMetadata(track.title, track.artist, track.album);
  return {
    ...track,
    title,
    artist,
    album: album || track.album || '',
  };
}
