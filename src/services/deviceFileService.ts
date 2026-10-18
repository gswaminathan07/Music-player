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
   * Reads and processes device audio files, generating tracks and storing them locally in IndexedDB.
   * Optimized for instant execution on Android phones with fast duration probing.
   */
  async processDeviceFiles(
    files: File[],
    onProgress?: (progress: ScanProgress) => void
  ): Promise<Track[]> {
    if (!files || files.length === 0) return [];

    // Filter audio files, with fallback to all files if user selected via audio picker
    let validFiles = files.filter((f) => this.isAudio(f));
    if (validFiles.length === 0 && files.length > 0) {
      // User selected files via audio picker, treat all as valid
      validFiles = files;
    }

    if (validFiles.length === 0) return [];

    const newTracks: Track[] = [];

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

      // Format & Title extraction
      const ext = (file.name.split('.').pop()?.toUpperCase() || 'MP3') as any;
      const meta = this.extractMetadataFromFilename(file.name);

      // Read real embedded audio metadata tags (ID3v2, ID3v1, MP4, FLAC) from the audio file
      const tags = await readAudioTags(file).catch(() => null);

      const cleaned = cleanTrackMetadata(tags?.title || meta.title, tags?.artist || meta.artist, tags?.album || meta.album);
      let title = cleaned.title;
      let artist = cleaned.artist;
      let album = cleaned.album || tags?.album || '';
      const genre = tags?.genre || meta.genre;
      let coverUrl = tags?.coverUrl;

      // Online track and album identification (accurately finds official album/movie and high-res cover)
      try {
        const identified = await identifyTrackOnline(title, artist, album);
        if (identified) {
          if (identified.coverUrl) coverUrl = identified.coverUrl;
          if (identified.album) album = identified.album;
          if (identified.artist && (!artist || artist === 'Local Artist' || artist === 'Unknown Artist')) {
            artist = identified.artist;
          }
          if (identified.title && (title === 'Audio Track' || !title)) {
            title = identified.title;
          }
        }
      } catch {
        // Fallback to fetchCoverArtForTrack
      }

      if (!coverUrl) {
        coverUrl = await fetchCoverArtForTrack(title, artist, album, genre);
      }

      const trackId = `track-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`;

      // Save blob to local IndexedDB storage for offline playback
      await offlineStorage.saveAudioBlob(trackId, file).catch((err) => {
        console.warn('Could not save blob to IndexedDB:', err);
      });

      // Create local object URL for instant playback
      const localAudioUrl = URL.createObjectURL(file);

      // Fast duration probing (with file size fallback for speed)
      const duration = await this.probeAudioDuration(localAudioUrl, file.size);

      const gradient = gradients[i % gradients.length];

      // Upload audio file to Cloud Storage so it appears automatically on mobile phones & other devices
      const cloudUploadResult = await cloudSyncService.uploadAudioFile(file, {
        id: trackId,
        title,
        artist,
        album,
        duration,
        genre,
        mood: meta.mood,
        coverUrl,
        format: ext,
      }).catch(() => null);

      const finalAudioUrl = cloudUploadResult?.audioUrl || localAudioUrl;
      const finalTrackId = cloudUploadResult?.id || trackId;

      // If cloud track id differs, ensure blob is stored under final id as well
      if (finalTrackId !== trackId) {
        await offlineStorage.saveAudioBlob(finalTrackId, file).catch(() => {});
      }

      const newTrack: Track = {
        id: finalTrackId,
        title: cloudUploadResult?.title || title,
        artist: cloudUploadResult?.artist || artist,
        album: cloudUploadResult?.album || album,
        duration,
        genre: cloudUploadResult?.genre || genre,
        mood: cloudUploadResult?.mood || meta.mood,
        bpm: meta.bpm,
        coverGradient: gradient,
        coverUrl,
        audioUrl: finalAudioUrl,
        isLocal: false,
        isOfflineAvailable: true,
        isCloudSynced: true,
        uploadedAt: Date.now(),
        format: ext,
        bitrate: ext === 'FLAC' || ext === 'WAV' ? 'Lossless Hi-Res' : '320 kbps',
        fileSize: file.size,
        playCount: 0,
        liked: false,
        blobId: finalTrackId,
        vibeSummary: meta.vibeSummary,
      };

      newTracks.push(newTrack);
    }

    // Persist all new tracks in IndexedDB
    await offlineStorage.saveTracks(newTracks).catch((err) => {
      console.warn('Could not save tracks to IndexedDB:', err);
    });

    return newTracks;
  }

  private probeAudioDuration(audioUrl: string, fileSize: number): Promise<number> {
    return new Promise((resolve) => {
      // Estimate fallback from filesize: ~1MB is approx 45 seconds for 192-320kbps MP3
      const estimatedSecs = Math.max(30, Math.min(600, Math.round(fileSize / (1024 * 32))));

      const audio = new Audio();
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          audio.src = '';
          resolve(estimatedSecs);
        }
      }, 350); // Fast 350ms timeout for snappy mobile experience

      audio.addEventListener(
        'loadedmetadata',
        () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            const dur = Math.round(audio.duration);
            audio.src = '';
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
            audio.src = '';
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
