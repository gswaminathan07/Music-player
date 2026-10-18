import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';
import { cleanTrackMetadata } from '../utils/trackFormatter';

export interface ExtractedTags {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  coverUrl?: string;
}

/**
 * Extracts embedded ID3 / MP4 / FLAC metadata tags directly from an audio File or Blob.
 */
export async function readAudioTags(blob: Blob): Promise<ExtractedTags | null> {
  if (!blob || !(blob instanceof Blob) || blob.size < 64) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      jsmediatags.read(blob, {
        onSuccess: (tag: any) => {
          try {
            const rawTitle = tag.tags.title;
            const rawArtist = tag.tags.artist;
            const album = tag.tags.album;
            const genre = tag.tags.genre;

            let coverUrl: string | undefined;
            if (tag.tags.picture) {
              const { data, format } = tag.tags.picture;
              if (data && data.length > 0) {
                // Convert uint8 array to base64
                let binary = '';
                const bytes = new Uint8Array(data);
                const len = bytes.byteLength;
                // Chunked processing to avoid call stack limits on large images
                const chunkSize = 8192;
                for (let i = 0; i < len; i += chunkSize) {
                  const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
                  binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
                }
                coverUrl = `data:${format || 'image/jpeg'};base64,${btoa(binary)}`;
              }
            }

            // Clean the extracted metadata
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
          resolve(null);
        },
      });
    } catch {
      resolve(null);
    }
  });
}
