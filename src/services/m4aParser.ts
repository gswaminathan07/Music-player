/**
 * Pure TypeScript ISO/IEC 14496-14 (MP4 / M4A) and Apple iTunes metadata atom parser.
 * Specifically engineered to parse AAC in M4A container (YouTube Music / iTunes format),
 * extracting embedded album cover art (covr), track title (©nam), artist (©ART),
 * album (©alb), genre, duration, sample rate, and AAC bitrate with zero external dependencies.
 */

export interface M4aMetadata {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: string;
  duration?: number; // in seconds
  sampleRate?: number; // e.g. 44100 or 48000
  channels?: number; // e.g. 2 (stereo)
  bitrate?: number; // e.g. 256000
  bitrateFormatted: string; // '256 kbps (AAC HQ)'
  codec: string; // 'AAC-LC', 'HE-AAC', or 'M4A / AAC'
  coverUrl?: string; // 'data:image/jpeg;base64,...'
  trackNumber?: number;
}

const GENRE_CODES: Record<number, string> = {
  1: 'Classic Rock',
  2: 'Country',
  3: 'Dance',
  4: 'Disco',
  5: 'Funk',
  6: 'Grunge',
  7: 'Hip-Hop',
  8: 'Jazz',
  9: 'Metal',
  10: 'New Age',
  11: 'Oldies',
  12: 'Other',
  13: 'Pop',
  14: 'R&B',
  15: 'Rap',
  16: 'Reggae',
  17: 'Rock',
  18: 'Techno',
  19: 'Industrial',
  20: 'Alternative',
  21: 'Ska',
  22: 'Death Metal',
  23: 'Pranks',
  24: 'Soundtrack',
  25: 'Euro-Techno',
  26: 'Ambient',
  27: 'Trip-Hop',
  28: 'Vocal',
  29: 'Jazz+Funk',
  30: 'Fusion',
  31: 'Trance',
  32: 'Classical',
  33: 'Instrumental',
  34: 'Acid',
  35: 'House',
  36: 'Game',
  37: 'Sound Clip',
  38: 'Gospel',
  39: 'Noise',
  40: 'Alt Rock',
  41: 'Bass',
  42: 'Soul',
  43: 'Punk',
  44: 'Space',
  45: 'Meditative',
  46: 'Instrumental Pop',
  47: 'Instrumental Rock',
  48: 'Ethnic',
  49: 'Gothic',
  50: 'Darkwave',
  51: 'Techno-Industrial',
  52: 'Electronic',
  53: 'Pop-Folk',
  54: 'Eurodance',
  55: 'Dream',
  56: 'Southern Rock',
  57: 'Comedy',
  58: 'Cult',
  59: 'Gangsta',
  60: 'Top 40',
  61: 'Christian Rap',
  62: 'Pop/Funk',
  63: 'Jungle',
  64: 'Native American',
  65: 'Cabaret',
  66: 'New Wave',
  67: 'Psychedelic',
  68: 'Rave',
  69: 'Showtunes',
  70: 'Trailer',
  71: 'Lo-Fi',
  72: 'Tribal',
  73: 'Acid Punk',
  74: 'Acid Jazz',
  75: 'Polka',
  76: 'Retro',
  77: 'Musical',
  78: 'Rock & Roll',
  79: 'Hard Rock',
  80: 'Folk',
  81: 'Folk-Rock',
  82: 'National Folk',
  83: 'Swing',
  84: 'Fast Fusion',
  85: 'Bebop',
  86: 'Latin',
  87: 'Revival',
  88: 'Celtic',
  89: 'Bluegrass',
  90: 'Avantgarde',
  91: 'Gothic Rock',
  92: 'Progressive Rock',
  93: 'Psychedelic Rock',
  94: 'Symphonic Rock',
  95: 'Slow Rock',
  96: 'Big Band',
  97: 'Chorus',
  98: 'Easy Listening',
  99: 'Acoustic',
  100: 'Humour',
  101: 'Speech',
  102: 'Chanson',
  103: 'Opera',
  104: 'Chamber Music',
  105: 'Sonata',
  106: 'Symphony',
  107: 'Booty Bass',
  108: 'Primus',
  109: 'Porn Groove',
  110: 'Satire',
  111: 'Slow Jam',
  112: 'Club',
  113: 'Tango',
  114: 'Samba',
  115: 'Folklore',
  116: 'Ballad',
  117: 'Power Ballad',
  118: 'Rhythmic Soul',
  119: 'Freestyle',
  120: 'Duet',
  121: 'Punk Rock',
  122: 'Drum Solo',
  123: 'A cappella',
  124: 'Euro-House',
  125: 'Dance Hall',
};

class AtomReader {
  private view: DataView;
  public pos: number = 0;
  public length: number;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.length = buffer.byteLength;
  }

  readUint32(): number {
    if (this.pos + 4 > this.length) return 0;
    const val = this.view.getUint32(this.pos, false);
    this.pos += 4;
    return val;
  }

  readUint16(): number {
    if (this.pos + 2 > this.length) return 0;
    const val = this.view.getUint16(this.pos, false);
    this.pos += 2;
    return val;
  }

  readUint8(): number {
    if (this.pos + 1 > this.length) return 0;
    const val = this.view.getUint8(this.pos);
    this.pos += 1;
    return val;
  }

  readFourCC(): string {
    if (this.pos + 4 > this.length) return '';
    let str = '';
    for (let i = 0; i < 4; i++) {
      str += String.fromCharCode(this.view.getUint8(this.pos + i));
    }
    this.pos += 4;
    return str;
  }

  readString(len: number): string {
    if (this.pos + len > this.length) len = Math.max(0, this.length - this.pos);
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.pos, len);
    this.pos += len;
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes).trim();
    } catch {
      let res = '';
      for (let i = 0; i < bytes.length; i++) {
        res += String.fromCharCode(bytes[i]);
      }
      return res.trim();
    }
  }

  readBytes(len: number): Uint8Array {
    if (this.pos + len > this.length) len = Math.max(0, this.length - this.pos);
    const bytes = new Uint8Array(this.view.buffer.slice(this.pos, this.pos + len));
    this.pos += len;
    return bytes;
  }
}

/**
 * Checks if a binary buffer is an ISO/IEC 14496-14 M4A container (M4A, M4B, MP42, isom, dash).
 */
export function isM4aBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false;
  const reader = new AtomReader(buffer.slice(0, 32));
  const size = reader.readUint32();
  const type = reader.readFourCC();
  if (type !== 'ftyp') return false;

  const brand = reader.readFourCC();
  const validBrands = ['M4A ', 'M4B ', 'mp41', 'mp42', 'isom', 'dash', 'qt  ', '3gp4', 'MSNV'];
  return validBrands.some((b) => brand.includes(b.trim()));
}

/**
 * Parses M4A metadata atoms from an ArrayBuffer slice.
 */
export function parseM4aBuffer(buffer: ArrayBuffer): Partial<M4aMetadata> {
  const result: Partial<M4aMetadata> = {
    codec: 'AAC-LC',
    bitrateFormatted: '256 kbps (AAC HQ)',
  };

  const reader = new AtomReader(buffer);

  while (reader.pos + 8 <= reader.length) {
    const atomStart = reader.pos;
    const atomSize = reader.readUint32();
    const atomType = reader.readFourCC();

    if (atomSize < 8 && atomSize !== 0) break;
    const atomEnd = atomSize === 0 ? reader.length : Math.min(reader.length, atomStart + atomSize);

    if (atomType === 'moov') {
      parseMoovAtom(reader, atomEnd, result);
    }

    reader.pos = atomEnd;
  }

  return result;
}

function parseMoovAtom(reader: AtomReader, moovEnd: number, result: Partial<M4aMetadata>) {
  while (reader.pos + 8 <= moovEnd) {
    const atomStart = reader.pos;
    const atomSize = reader.readUint32();
    const atomType = reader.readFourCC();

    if (atomSize < 8 && atomSize !== 0) break;
    const atomEnd = atomSize === 0 ? moovEnd : Math.min(moovEnd, atomStart + atomSize);

    if (atomType === 'mvhd') {
      // Movie header: version (1), flags (3), creation (4/8), mod (4/8), timescale (4), duration (4/8)
      const version = reader.readUint8();
      reader.pos += 3; // flags
      if (version === 1) {
        reader.pos += 16; // 64-bit creation and modification times
        const timescale = reader.readUint32();
        const durationHi = reader.readUint32();
        const durationLo = reader.readUint32();
        const duration = durationHi * 4294967296 + durationLo;
        if (timescale > 0) result.duration = Math.round((duration / timescale) * 10) / 10;
      } else {
        reader.pos += 8; // 32-bit creation and modification times
        const timescale = reader.readUint32();
        const duration = reader.readUint32();
        if (timescale > 0) result.duration = Math.round((duration / timescale) * 10) / 10;
      }
    } else if (atomType === 'trak') {
      parseTrakAtom(reader, atomEnd, result);
    } else if (atomType === 'udta') {
      parseUdtaAtom(reader, atomEnd, result);
    }

    reader.pos = atomEnd;
  }
}

function parseTrakAtom(reader: AtomReader, trakEnd: number, result: Partial<M4aMetadata>) {
  while (reader.pos + 8 <= trakEnd) {
    const atomStart = reader.pos;
    const atomSize = reader.readUint32();
    const atomType = reader.readFourCC();

    if (atomSize < 8 && atomSize !== 0) break;
    const atomEnd = atomSize === 0 ? trakEnd : Math.min(trakEnd, atomStart + atomSize);

    if (atomType === 'mdia') {
      parseMdiaAtom(reader, atomEnd, result);
    }

    reader.pos = atomEnd;
  }
}

function parseMdiaAtom(reader: AtomReader, mdiaEnd: number, result: Partial<M4aMetadata>) {
  while (reader.pos + 8 <= mdiaEnd) {
    const atomStart = reader.pos;
    const atomSize = reader.readUint32();
    const atomType = reader.readFourCC();

    if (atomSize < 8 && atomSize !== 0) break;
    const atomEnd = atomSize === 0 ? mdiaEnd : Math.min(mdiaEnd, atomStart + atomSize);

    if (atomType === 'mdhd') {
      const version = reader.readUint8();
      reader.pos += 3; // flags
      if (version === 1) {
        reader.pos += 16;
        const timescale = reader.readUint32();
        const durationHi = reader.readUint32();
        const durationLo = reader.readUint32();
        const duration = durationHi * 4294967296 + durationLo;
        if (timescale > 0) result.duration = Math.round((duration / timescale) * 10) / 10;
      } else {
        reader.pos += 8;
        const timescale = reader.readUint32();
        const duration = reader.readUint32();
        if (timescale > 0) result.duration = Math.round((duration / timescale) * 10) / 10;
      }
    } else if (atomType === 'minf') {
      parseMinfAtom(reader, atomEnd, result);
    }

    reader.pos = atomEnd;
  }
}

function parseMinfAtom(reader: AtomReader, minfEnd: number, result: Partial<M4aMetadata>) {
  while (reader.pos + 8 <= minfEnd) {
    const atomStart = reader.pos;
    const atomSize = reader.readUint32();
    const atomType = reader.readFourCC();

    if (atomSize < 8 && atomSize !== 0) break;
    const atomEnd = atomSize === 0 ? minfEnd : Math.min(minfEnd, atomStart + atomSize);

    if (atomType === 'stbl') {
      parseStblAtom(reader, atomEnd, result);
    }

    reader.pos = atomEnd;
  }
}

function parseStblAtom(reader: AtomReader, stblEnd: number, result: Partial<M4aMetadata>) {
  while (reader.pos + 8 <= stblEnd) {
    const atomStart = reader.pos;
    const atomSize = reader.readUint32();
    const atomType = reader.readFourCC();

    if (atomSize < 8 && atomSize !== 0) break;
    const atomEnd = atomSize === 0 ? stblEnd : Math.min(stblEnd, atomStart + atomSize);

    if (atomType === 'stsd') {
      // Sample Description Atom
      reader.pos += 8; // version + flags (4) + entry count (4)
      if (reader.pos + 8 <= atomEnd) {
        const entrySize = reader.readUint32();
        const format = reader.readFourCC();
        if (format === 'mp4a') {
          result.codec = 'AAC-LC';
          reader.pos += 16; // reserved + data reference index + inner reserved
          const channels = reader.readUint16();
          reader.pos += 2; // sample size
          reader.pos += 4; // pre-defined + reserved
          const sampleRate = reader.readUint16(); // sample rate integer portion
          if (channels > 0) result.channels = channels;
          if (sampleRate > 0) result.sampleRate = sampleRate;

          // Parse esds for explicit AAC bitrate descriptor
          if (reader.pos + 8 < atomStart + entrySize) {
            parseEsdsAtom(reader, atomStart + entrySize, result);
          }
        }
      }
    }

    reader.pos = atomEnd;
  }
}

function parseEsdsAtom(reader: AtomReader, esdsEnd: number, result: Partial<M4aMetadata>) {
  while (reader.pos + 8 <= esdsEnd) {
    const atomStart = reader.pos;
    const atomSize = reader.readUint32();
    const atomType = reader.readFourCC();

    if (atomSize < 8 && atomSize !== 0) break;
    const atomEnd = atomSize === 0 ? esdsEnd : Math.min(esdsEnd, atomStart + atomSize);

    if (atomType === 'esds') {
      reader.pos += 4; // version + flags
      // Search for DecoderConfigDescriptor tag (0x04)
      while (reader.pos + 13 <= atomEnd) {
        const tag = reader.readUint8();
        if (tag === 0x04) {
          reader.pos += 1; // length
          const objectTypeIndication = reader.readUint8();
          if (objectTypeIndication === 0x40) {
            result.codec = 'AAC-LC';
          } else if (objectTypeIndication === 0x66 || objectTypeIndication === 0x67) {
            result.codec = 'AAC';
          }
          reader.pos += 5; // stream type + buffer size
          const maxBitrate = reader.readUint32();
          const avgBitrate = reader.readUint32();
          const bitrate = avgBitrate || maxBitrate;
          if (bitrate > 0) {
            result.bitrate = bitrate;
            const kbps = Math.round(bitrate / 1000);
            result.bitrateFormatted = `${kbps} kbps (AAC HQ)`;
          }
          break;
        }
      }
    }

    reader.pos = atomEnd;
  }
}

function parseUdtaAtom(reader: AtomReader, udtaEnd: number, result: Partial<M4aMetadata>) {
  while (reader.pos + 8 <= udtaEnd) {
    const atomStart = reader.pos;
    const atomSize = reader.readUint32();
    const atomType = reader.readFourCC();

    if (atomSize < 8 && atomSize !== 0) break;
    const atomEnd = atomSize === 0 ? udtaEnd : Math.min(udtaEnd, atomStart + atomSize);

    if (atomType === 'meta') {
      // meta atom has 4 bytes version + flags!
      reader.pos += 4;
      parseMetaAtom(reader, atomEnd, result);
    }

    reader.pos = atomEnd;
  }
}

function parseMetaAtom(reader: AtomReader, metaEnd: number, result: Partial<M4aMetadata>) {
  while (reader.pos + 8 <= metaEnd) {
    const atomStart = reader.pos;
    const atomSize = reader.readUint32();
    const atomType = reader.readFourCC();

    if (atomSize < 8 && atomSize !== 0) break;
    const atomEnd = atomSize === 0 ? metaEnd : Math.min(metaEnd, atomStart + atomSize);

    if (atomType === 'ilst') {
      parseIlstAtom(reader, atomEnd, result);
    }

    reader.pos = atomEnd;
  }
}

function parseIlstAtom(reader: AtomReader, ilstEnd: number, result: Partial<M4aMetadata>) {
  while (reader.pos + 8 <= ilstEnd) {
    const itemStart = reader.pos;
    const itemSize = reader.readUint32();
    const itemType = reader.readFourCC();

    if (itemSize < 8 && itemSize !== 0) break;
    const itemEnd = itemSize === 0 ? ilstEnd : Math.min(ilstEnd, itemStart + itemSize);

    // Look for child 'data' atom
    let dataPos = reader.pos;
    while (dataPos + 8 <= itemEnd) {
      reader.pos = dataPos;
      const dataSize = reader.readUint32();
      const dataType = reader.readFourCC();

      if (dataSize < 8 && dataSize !== 0) break;
      const subDataEnd = dataSize === 0 ? itemEnd : Math.min(itemEnd, dataPos + dataSize);

      if (dataType === 'data') {
        const typeIndicator = reader.readUint32(); // 1 = UTF-8, 13 = JPEG, 14 = PNG, 0 = implicit
        reader.pos += 4; // 4 bytes locale / reserved
        const payloadLength = subDataEnd - reader.pos;

        if (payloadLength > 0) {
          if (itemType === '©nam') {
            result.title = reader.readString(payloadLength);
          } else if (itemType === '©ART' || itemType === 'aART') {
            if (!result.artist || itemType === '©ART') {
              result.artist = reader.readString(payloadLength);
            }
          } else if (itemType === '©alb') {
            result.album = reader.readString(payloadLength);
          } else if (itemType === '©gen') {
            result.genre = reader.readString(payloadLength);
          } else if (itemType === 'gnre') {
            if (payloadLength >= 2) {
              const genreId = reader.readUint16();
              if (GENRE_CODES[genreId]) result.genre = GENRE_CODES[genreId];
            }
          } else if (itemType === '©day') {
            result.year = reader.readString(payloadLength);
          } else if (itemType === 'trkn') {
            if (payloadLength >= 4) {
              reader.pos += 2; // 2 bytes padding
              const trackNum = reader.readUint16();
              if (trackNum > 0) result.trackNumber = trackNum;
            }
          } else if (itemType === 'covr') {
            // Album artwork data (JPEG or PNG)
            const rawBytes = reader.readBytes(payloadLength);
            const format =
              typeIndicator === 14 || (rawBytes[0] === 0x89 && rawBytes[1] === 0x50)
                ? 'image/png'
                : 'image/jpeg';

            // Convert to Base64 in chunks
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < rawBytes.byteLength; i += chunkSize) {
              const chunk = rawBytes.subarray(i, Math.min(i + chunkSize, rawBytes.byteLength));
              binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
            }
            result.coverUrl = `data:${format};base64,${btoa(binary)}`;
          }
        }
        break;
      }
      dataPos = subDataEnd;
    }

    reader.pos = itemEnd;
  }
}

/**
 * High-performance asynchronous M4A tag extractor.
 * Reads initial 1MB of the file (sufficient for 99.9% of M4A files) and parses all iTunes atoms.
 */
export async function readM4aFileTags(blob: Blob): Promise<M4aMetadata | null> {
  if (!blob || !(blob instanceof Blob) || blob.size < 64) return null;

  try {
    // 1MB slice to capture header and moov atom quickly
    const sliceSize = Math.min(blob.size, 1024 * 1024);
    const slice = blob.slice(0, sliceSize);
    const buffer = await slice.arrayBuffer();

    if (!isM4aBuffer(buffer)) {
      // If brand check doesn't pass in the first 32 bytes, check if file extension is m4a/mp4
      const name = (blob as any).name || '';
      if (!/\.(m4a|aac|mp4)$/i.test(name)) {
        return null;
      }
    }

    const partial = parseM4aBuffer(buffer);

    // If moov atom was not found at the front (some encoders place it at the tail),
    // probe the last 512KB of the file
    if (!partial.title && !partial.artist && blob.size > sliceSize) {
      const tailSize = Math.min(blob.size, 512 * 1024);
      const tailSlice = blob.slice(blob.size - tailSize, blob.size);
      const tailBuffer = await tailSlice.arrayBuffer();
      const tailPartial = parseM4aBuffer(tailBuffer);
      Object.assign(partial, tailPartial);
    }

    const duration = partial.duration;
    // Fallback bitrate calculation if not in esds
    let bitrateFormatted = partial.bitrateFormatted || '256 kbps (AAC HQ)';
    if (!partial.bitrate && duration && duration > 0) {
      const calculatedBps = Math.round((blob.size * 8) / duration);
      const kbps = Math.round(calculatedBps / 1000);
      if (kbps >= 64 && kbps <= 512) {
        bitrateFormatted = `${kbps} kbps (AAC HQ)`;
      }
    }

    return {
      title: partial.title,
      artist: partial.artist,
      album: partial.album,
      genre: partial.genre,
      year: partial.year,
      duration: partial.duration,
      sampleRate: partial.sampleRate || 44100,
      channels: partial.channels || 2,
      bitrate: partial.bitrate || 256000,
      bitrateFormatted,
      codec: partial.codec || 'AAC-LC',
      coverUrl: partial.coverUrl,
      trackNumber: partial.trackNumber,
    };
  } catch (err) {
    console.warn('M4A parsing notice:', err);
    return null;
  }
}
