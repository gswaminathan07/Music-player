import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';
import { cleanTrackMetadata } from '../utils/trackFormatter';
import { readM4aFileTags } from './m4aParser';

export interface ExtractedTags {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  coverUrl?: string;
  duration?: number;
  format?: string;
  bitrate?: string;
  codec?: string;
}

/**
 * Extracts embedded ID3 / MP4 / FLAC metadata tags directly from an audio File or Blob.
 * Prioritizes high-speed native M4A / AAC iTunes atom demuxing for YouTube Music style M4A files.
 */
export async function readAudioTags(blob: Blob): Promise<ExtractedTags | null> {
  if (!blob || !(blob instanceof Blob) || blob.size < 64) {
    return null;
  }

  // 1. Prioritize native M4A / AAC atom parser for instant metadata & embedded album art extraction
  const filename = (blob as any).name || '';
  const isM4aCandidate =
    /\.(m4a|aac|mp4)$/i.test(filename) ||
    blob.type?.includes('mp4') ||
    blob.type?.includes('m4a') ||
    blob.type?.includes('aac');

  if (isM4aCandidate) {
    try {
      const m4aTags = await readM4aFileTags(blob);
      if (m4aTags && (m4aTags.title || m4aTags.artist || m4aTags.coverUrl)) {
        const cleaned = cleanTrackMetadata(m4aTags.title || '', m4aTags.artist || '', m4aTags.album);
        return {
          title: cleaned.title,
          artist: cleaned.artist,
          album: cleaned.album || m4aTags.album,
          genre: m4aTags.genre,
          coverUrl: m4aTags.coverUrl,
          duration: m4aTags.duration,
          format: 'M4A',
          bitrate: m4aTags.bitrateFormatted || '256 kbps (AAC HQ)',
          codec: m4aTags.codec || 'AAC-LC',
        };
      }
    } catch {
      // Continue to universal fallback
    }
  }

  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 600); // 600ms safety timeout prevents loop blocking on unreadable files

    try {
      jsmediatags.read(blob, {
        onSuccess: (tag: any) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          try {
            const rawTitle = tag.tags?.title;
            const rawArtist = tag.tags?.artist;
            const album = tag.tags?.album;
            const genre = tag.tags?.genre;

            let coverUrl: string | undefined;
            if (tag.tags?.picture) {
              const { data, format } = tag.tags.picture;
              if (data && data.length > 0) {
                let binary = '';
                const bytes = new Uint8Array(data);
                const len = bytes.byteLength;
                const chunkSize = 8192;
                for (let i = 0; i < len; i += chunkSize) {
                  const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
                  binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
                }
                coverUrl = `data:${format || 'image/jpeg'};base64,${btoa(binary)}`;
              }
            }

            if (rawTitle || rawArtist) {
              const cleaned = cleanTrackMetadata(rawTitle || '', rawArtist || '', album);
              resolve({
                title: cleaned.title,
                artist: cleaned.artist,
                album: cleaned.album || album,
                genre,
                coverUrl,
              });
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        },
        onError: () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            resolve(null);
          }
        },
      });
    } catch {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}
