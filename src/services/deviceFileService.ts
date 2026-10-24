import { Track, TrackMood } from '../types/music';
import { offlineStorage } from './offlineStorage';
import { cleanTrackMetadata } from '../utils/trackFormatter';
import { readAudioTags } from './audioTagReader';
import { fetchCoverArtForTrack, identifyTrackOnline } from './coverArtService';
import { cloudSyncService } from './cloudSyncService';

const AUDIO_EXTENSIONS = /\.(mp3|wav|flac|m4a|aac|ogg|oga|opus|aiff|aif|alac|wma|weba|mid|midi|mp4)$/i;

export interface ScanProgress {
  current: number;
  total: number;
  filename: string;
  percent: number;
}

export const isAndroidDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
};

export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ''
  );
};

const AUDIO_ACCEPT_TYPES =
  'audio/*,audio/mpeg,audio/mp3,audio/flac,audio/x-flac,audio/wav,audio/x-wav,audio/m4a,audio/x-m4a,audio/aac,audio/ogg,audio/opus,.mp3,.flac,.wav,.m4a,.aac,.ogg,.opus,.aiff,.alac,.wma';

export interface ProcessResult {
  successTracks: Track[];
  failedFiles: Array<{ file: File; reason: string }>;
}

class DeviceFileService {
  /**
   * Prompts user to select audio files from device storage using native file picker.
   */
  async selectDeviceFiles(): Promise<File[]> {
    // 1. Try modern File System Access API on desktop when available outside iframe
    if ('showOpenFilePicker' in window && !isMobileDevice()) {
      try {
        const pickerOpts = {
          multiple: true,
          types: [
            {
              description: 'Audio Files',
              accept: {
                'audio/*': ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.aiff'],
              },
            },
          ],
        };
        const handles = await (window as any).showOpenFilePicker(pickerOpts);
        const files: File[] = [];
        for (const handle of handles) {
          const file = await handle.getFile();
          files.push(file);
        }
        if (files.length > 0) return files;
      } catch (err: any) {
        if (err.name === 'AbortError') return [];
        // SecurityError in iframe or not allowed - continue to universal fallback
      }
    }

    // 2. Universal input fallback - attaches properly to DOM for rock-solid Android/iOS support
    return new Promise<File[]>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = AUDIO_ACCEPT_TYPES;

      // Keep hidden in DOM to prevent mobile browser garbage collection
      input.style.position = 'fixed';
      input.style.top = '-1000px';
      input.style.left = '-1000px';
      input.style.opacity = '0';
      input.style.pointerEvents = 'none';
      document.body.appendChild(input);

      let resolved = false;
      const cleanup = () => {
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
        window.removeEventListener('focus', onFocusCheck);
      };

      input.onchange = () => {
        if (resolved) return;
        resolved = true;
        const fileList = input.files ? Array.from(input.files) : [];
        cleanup();
        resolve(fileList);
      };

      input.oncancel = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve([]);
      };

      // Fallback for Android browsers where oncancel might not fire
      const onFocusCheck = () => {
        setTimeout(() => {
          if (!resolved && (!input.files || input.files.length === 0)) {
            // Give extra grace period for slow Android file picker return
          }
        }, 800);
      };
      window.addEventListener('focus', onFocusCheck, { once: true });

      // Trigger native file picker
      input.click();
    });
  }

  /**
   * Prompts user to pick an entire folder (e.g. /Music folder) from their device.
   * On Android, browsers DO NOT support webkitdirectory or showDirectoryPicker (Chromium returns 0 files).
   * For Android, we seamlessly launch the native file picker in multi-file mode so users can
   * navigate into their Music folder and "Select All" with 1 tap.
   */
  async selectDeviceFolder(): Promise<File[]> {
    const isAndroid = isAndroidDevice();
    const isMobile = isMobileDevice();

    // On Desktop non-mobile: try modern Directory Picker API first
    if ('showDirectoryPicker' in window && !isMobile) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const files: File[] = [];
        await this.scanDirectoryHandle(dirHandle, files);
        if (files.length > 0) return files;
      } catch (err: any) {
        if (err.name === 'AbortError') return [];
        // Falls through to webkitdirectory on desktop
      }
    }

    // Android/Mobile browsers DO NOT support webkitdirectory (Chrome for Android returns 0 files).
    // Instead, on mobile/Android we open multi-file selection allowing users to select their Music folder tracks!
    const useWebkitDirectory = !isAndroid && !isMobile;

    return new Promise<File[]>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = AUDIO_ACCEPT_TYPES;

      if (useWebkitDirectory) {
        (input as any).webkitdirectory = true;
        (input as any).directory = true;
      }

      input.style.position = 'fixed';
      input.style.top = '-1000px';
      input.style.left = '-1000px';
      input.style.opacity = '0';
      input.style.pointerEvents = 'none';
      document.body.appendChild(input);

      let resolved = false;
      const cleanup = () => {
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      };

      input.onchange = () => {
        if (resolved) return;
        resolved = true;
        const fileList = input.files ? Array.from(input.files) : [];
        cleanup();
        resolve(fileList);
      };

      input.oncancel = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve([]);
      };

      input.click();
    });
  }

  private async scanDirectoryHandle(dirHandle: any, fileList: File[]) {
    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          try {
            const file = await entry.getFile();
            if (this.isAudio(file)) {
              fileList.push(file);
            }
          } catch {
            // Ignore unreadable individual file
          }
        } else if (entry.kind === 'directory') {
          await this.scanDirectoryHandle(entry, fileList);
        }
      }
    } catch {
      // Ignore scan directory errors
    }
  }

  private isAudio(file: File): boolean {
    if (file.type && (file.type.startsWith('audio/') || file.type.includes('flac') || file.type.includes('ogg') || file.type.includes('wav') || file.type.includes('mpeg') || file.type.includes('aac'))) {
      return true;
    }
    return AUDIO_EXTENSIONS.test(file.name);
  }

  /**
   * Fast, reliable acoustic heuristics extracted instantly from file naming & tags.
   */
  private extractMetadataFromFilename(filename: string): {
    title: string;
    artist: string;
    album: string;
    genre: string;
    mood: TrackMood;
    bpm: number;
    vibeSummary: string;
  } {
    const { title, artist } = cleanTrackMetadata(filename);
    const album = '';

    const lower = filename.toLowerCase();
    let genre = 'Electronic';
    let mood: TrackMood = 'Chill';
    let bpm = 110;
    let vibeSummary = 'Direct device audio file';

    if (lower.includes('lofi') || lower.includes('lo-fi') || lower.includes('chill') || lower.includes('coffee')) {
      genre = 'Lo-Fi Hip Hop';
      mood = 'Chill';
      bpm = 85;
      vibeSummary = 'Relaxing Lo-Fi beats with warm cassette textures.';
    } else if (lower.includes('synth') || lower.includes('wave') || lower.includes('80s') || lower.includes('retro')) {
      genre = 'Synthwave';
      mood = 'Groovy';
      bpm = 124;
      vibeSummary = 'Vintage analog synthesizers and driving arpeggios.';
    } else if (lower.includes('rock') || lower.includes('guitar') || lower.includes('band')) {
      genre = 'Indie Rock';
      mood = 'Energetic';
      bpm = 130;
      vibeSummary = 'Crisp organic instruments with lively melodic presence.';
    } else if (lower.includes('ambient') || lower.includes('sleep') || lower.includes('meditation') || lower.includes('focus') || lower.includes('drone')) {
      genre = 'Ambient';
      mood = 'Ambient';
      bpm = 70;
      vibeSummary = 'Atmospheric soundscapes for deep concentration.';
    } else if (lower.includes('rap') || lower.includes('hip') || lower.includes('trap') || lower.includes('beat')) {
      genre = 'Hip Hop';
      mood = 'Energetic';
      bpm = 135;
      vibeSummary = 'Punchy rhythm section with high dynamic energy.';
    } else if (lower.includes('jazz') || lower.includes('piano') || lower.includes('soul')) {
      genre = 'Neo-Soul / Jazz';
      mood = 'Chill';
      bpm = 95;
      vibeSummary = 'Soulful acoustic arrangements with warm harmonies.';
    } else if (lower.includes('pop') || lower.includes('dance') || lower.includes('club') || lower.includes('edm')) {
      genre = 'Dance / Pop';
      mood = 'Energetic';
      bpm = 128;
      vibeSummary = 'Uplifting tempo crafted for movement and positivity.';
    } else if (lower.includes('acoustic') || lower.includes('folk')) {
      genre = 'Acoustic';
      mood = 'Uplifting';
      bpm = 100;
      vibeSummary = 'Natural acoustic timbre and gentle melodic flow.';
    }

    return { title, artist, album, genre, mood, bpm, vibeSummary };
  }

  /**
   * Reads and processes device audio files, storing binary blobs locally in IndexedDB.
   * Returns a ProcessResult containing success tracks and an array of failed/skipped files with reasons.
   */
  async processDeviceFiles(
    files: File[],
    onProgress?: (progress: ScanProgress) => void,
    existingTracks: Track[] = []
  ): Promise<ProcessResult> {
    if (!files || files.length === 0) {
      return { successTracks: [], failedFiles: [] };
    }

    const failedFiles: Array<{ file: File; reason: string }> = [];
    const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Build existing track key set for exact file deduplication
    const existingFileSet = new Set<string>();
    existingTracks.forEach((t) => {
      const fileKey = `${(t.title || '').toLowerCase().trim()}::${t.fileSize || 0}::${t.duration || 0}`;
      if (fileKey && fileKey !== '::::0') existingFileSet.add(fileKey);
    });

    // Fetch latest cloud tracks map (use cache if offline to prevent network timeout)
    const existingCloudTracks = (typeof navigator !== 'undefined' && !navigator.onLine)
      ? cloudSyncService.getCachedCloudTracks()
      : await cloudSyncService.fetchCloudTracks().catch(() => cloudSyncService.getCachedCloudTracks());
    const existingCloudMap = new Map<string, Track>();
    existingCloudTracks.forEach((ct) => {
      const normKey = `${(ct.title || '').toLowerCase().trim()}::${(ct.artist || '').toLowerCase().trim()}`;
      if (normKey && normKey !== '::') {
        existingCloudMap.set(normKey, ct);
      }
    });

    let validFiles = files.filter((f) => this.isAudio(f));
    if (validFiles.length === 0 && files.length > 0) {
      validFiles = files;
    }

    // Record non-audio files as failed/skipped
    files.forEach((f) => {
      if (!this.isAudio(f) && !validFiles.includes(f)) {
        failedFiles.push({ file: f, reason: 'Unsupported non-audio file format' });
      }
    });

    if (validFiles.length === 0) {
      return { successTracks: [], failedFiles };
    }

    const gradients = [
      'from-violet-600 via-indigo-600 to-sky-600',
      'from-pink-600 via-purple-600 to-indigo-800',
      'from-emerald-600 via-teal-700 to-cyan-800',
      'from-amber-500 via-orange-600 to-rose-700',
      'from-cyan-600 via-blue-700 to-indigo-900',
      'from-rose-600 via-pink-600 to-purple-800',
      'from-fuchsia-600 via-purple-700 to-slate-900',
      'from-teal-500 via-emerald-600 to-blue-800',
    ];

    const successTracks: Track[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: validFiles.length,
          filename: file.name,
          percent: Math.round(((i + 1) / validFiles.length) * 100),
        });
      }

      try {
        const ext = (file.name.split('.').pop()?.toUpperCase() || 'MP3') as any;
        const meta = this.extractMetadataFromFilename(file.name);
        const tags = await readAudioTags(file).catch(() => null);

        const cleaned = cleanTrackMetadata(tags?.title || meta.title, tags?.artist || meta.artist, tags?.album || meta.album);
        const title = cleaned.title || file.name.replace(/\.[^/.]+$/, '').trim();
        const artist = cleaned.artist || 'Local Upload';
        const album = cleaned.album || tags?.album || '';
        const genre = tags?.genre || meta.genre;
        const coverUrl = tags?.coverUrl;

        const normKey = `${norm(title)}::${norm(artist)}`;
        const exactFileKey = `${title.toLowerCase().trim()}::${file.size}::${Math.round(file.size / 32768)}`;

        // Skip ONLY if exact file with same size and title already exists in library
        if (existingFileSet.has(exactFileKey)) {
          failedFiles.push({ file, reason: `Skipped: "${title}" already exists in library` });
          continue;
        }

        const existingTrackMatch = existingTracks.find(
          (t) => `${(t.title || '').toLowerCase().trim()}::${t.fileSize || 0}` === `${title.toLowerCase().trim()}::${file.size}`
        );

        const existingMatch = existingCloudMap.get(normKey);
        const trackId = existingTrackMatch?.blobId || existingMatch?.id || `track-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`;
        const localAudioUrl = existingTrackMatch?.audioUrl?.startsWith('blob:') ? existingTrackMatch.audioUrl : URL.createObjectURL(file);
        const duration = existingTrackMatch?.duration || await this.probeAudioDuration(localAudioUrl, file.size);
        const gradient = existingTrackMatch?.coverGradient || gradients[i % gradients.length];

        // Save audio binary blob locally in browser IndexedDB only if not already stored
        if (!existingTrackMatch || !existingTrackMatch.blobId) {
          await offlineStorage.saveAudioBlob(trackId, file);
        }

        const localTrack: Track = {
          id: trackId,
          title,
          artist,
          album,
          duration,
          genre,
          mood: meta.mood,
          bpm: meta.bpm,
          coverGradient: gradient,
          coverUrl: existingTrackMatch?.coverUrl || coverUrl,
          audioUrl: localAudioUrl,
          isLocal: true,
          isOfflineAvailable: true,
          isCloudSynced: Boolean(existingMatch || existingTrackMatch?.isCloudSynced),
          uploadedAt: existingTrackMatch?.uploadedAt || Date.now(),
          format: ext,
          bitrate: ext === 'FLAC' || ext === 'WAV' ? 'Lossless Hi-Res' : '320 kbps',
          fileSize: file.size,
          playCount: existingTrackMatch?.playCount || 0,
          liked: existingTrackMatch?.liked || false,
          blobId: trackId,
          vibeSummary: meta.vibeSummary,
        };

        successTracks.push(localTrack);
        existingFileSet.add(exactFileKey);
      } catch (fileErr: any) {
        failedFiles.push({
          file,
          reason: `Failed to store: ${fileErr?.message || 'Storage error or corrupt file'}`,
        });
      }
    }

    // Persist all successfully stored tracks in IndexedDB
    if (successTracks.length > 0) {
      await offlineStorage.saveTracks(successTracks).catch((err) => {
        console.warn('Could not save tracks to IndexedDB:', err);
      });
    }

    return { successTracks, failedFiles };
  }

  private probeAudioDuration(audioUrl: string, fileSize: number): Promise<number> {
    return new Promise((resolve) => {
      // Estimate fallback from filesize: ~1MB is approx 45 seconds for 192-320kbps MP3
      const estimatedSecs = Math.max(30, Math.min(600, Math.round(fileSize / (1024 * 32))));

      const audio = new Audio();
      let resolved = false;

      const cleanup = () => {
        try {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        } catch {}
      };

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(estimatedSecs);
        }
      }, 500); // 500ms safety timeout for duration probing

      audio.addEventListener(
        'loadedmetadata',
        () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            const dur = Math.round(audio.duration);
            cleanup();
            resolve(Number.isFinite(dur) && dur > 0 ? dur : estimatedSecs);
          }
        },
        { once: true }
      );

      audio.addEventListener(
        'error',
        () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            cleanup();
            resolve(estimatedSecs);
          }
        },
        { once: true }
      );

      audio.preload = 'metadata';
      audio.src = audioUrl;
    });
  }
}

export const deviceFileService = new DeviceFileService();
