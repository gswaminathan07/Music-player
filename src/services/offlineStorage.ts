import { Track, Playlist, UserPreferences, EqualizerSettings, SmartFolder } from '../types/music';

const DB_NAME = 'Vettify_OfflineDB';
const DB_VERSION = 2;

class OfflineStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('audio_blobs')) {
          db.createObjectStore('audio_blobs');
        }
        if (!db.objectStoreNames.contains('tracks')) {
          db.createObjectStore('tracks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('app_state')) {
          db.createObjectStore('app_state');
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  private liveBlobUrls: Map<string, string> = new Map();

  /**
   * Normalizes audio blob MIME type ensuring browser AAC/MP4/MP3 demuxers decode cleanly.
   */
  public normalizeAudioBlob(blob: Blob, trackHint?: Partial<Track>): Blob {
    if (!blob) return blob;
    const format = (trackHint?.format || '').toUpperCase();
    const title = (trackHint?.title || '').toLowerCase();
    const isM4a =
      format === 'M4A' ||
      format === 'AAC' ||
      title.endsWith('.m4a') ||
      title.endsWith('.aac') ||
      title.endsWith('.mp4') ||
      blob.type.includes('mp4') ||
      blob.type.includes('m4a') ||
      blob.type.includes('aac');

    if (isM4a) {
      return new Blob([blob], { type: 'audio/mp4' });
    }
    if (format === 'FLAC' || title.endsWith('.flac') || blob.type.includes('flac')) {
      return new Blob([blob], { type: 'audio/flac' });
    }
    if (format === 'WAV' || title.endsWith('.wav') || blob.type.includes('wav')) {
      return new Blob([blob], { type: 'audio/wav' });
    }
    if (blob.type && blob.type !== 'application/octet-stream') {
      return blob;
    }
    return new Blob([blob], { type: 'audio/mpeg' });
  }

  // --- Audio Blobs ---
  async saveAudioBlob(trackId: string, blob: Blob, trackHint?: Partial<Track>): Promise<void> {
    if (!trackId || !blob) return;
    const pureBlob = this.normalizeAudioBlob(blob, trackHint);
    
    // Cache live blob URL for instant 0ms access in current session
    try {
      const liveUrl = URL.createObjectURL(pureBlob);
      this.liveBlobUrls.set(trackId, liveUrl);
    } catch {}

    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio_blobs', 'readwrite');
      const store = tx.objectStore('audio_blobs');
      const req = store.put(pureBlob, trackId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAudioBlob(trackId: string): Promise<Blob | null> {
    if (!trackId) return null;
    const db = await this.openDB();
    const tryKey = (key: string): Promise<Blob | null> => {
      return new Promise((resolve) => {
        const tx = db.transaction('audio_blobs', 'readonly');
        const store = tx.objectStore('audio_blobs');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    };

    let result = await tryKey(trackId);
    if (!result && trackId.startsWith('cloud-')) {
      result = await tryKey(trackId.replace(/^cloud-/, ''));
    }
    if (!result && !trackId.startsWith('cloud-')) {
      result = await tryKey(`cloud-${trackId}`);
    }
    return result;
  }

  async getAudioBlobForTrack(track: Partial<Track>): Promise<Blob | null> {
    if (!track) return null;
    let b: Blob | null = null;
    if (track.blobId) {
      b = await this.getAudioBlob(track.blobId).catch(() => null);
    }
    if (!b && track.id) {
      b = await this.getAudioBlob(track.id).catch(() => null);
    }
    if (b) {
      return this.normalizeAudioBlob(b, track);
    }
    return null;
  }

  /**
   * Retrieves a verified, living object URL for a track, or returns cached live URL.
   */
  public getLiveAudioUrlSync(track: Track): string | null {
    if (!track) return null;
    return this.liveBlobUrls.get(track.id) || (track.blobId ? this.liveBlobUrls.get(track.blobId) || null : null);
  }

  public async resolveLiveAudioUrl(track: Track): Promise<string> {
    if (!track) return '';
    const cached = this.getLiveAudioUrlSync(track);
    if (cached) return cached;

    if (track.blobId || track.isOfflineAvailable || track.isLocal) {
      const blob = await this.getAudioBlobForTrack(track);
      if (blob) {
        const freshUrl = URL.createObjectURL(blob);
        this.liveBlobUrls.set(track.id, freshUrl);
        if (track.blobId) this.liveBlobUrls.set(track.blobId, freshUrl);
        return freshUrl;
      }
    }

    if (track.audioUrl && !track.audioUrl.startsWith('blob:')) {
      return track.audioUrl;
    }

    if (track.id.startsWith('cloud-') || track.isCloudSynced) {
      return `/api/audio/${track.id}`;
    }

    return track.audioUrl || '';
  }

  async deleteAudioBlob(trackId: string): Promise<void> {
    if (!trackId) return;
    const cached = this.liveBlobUrls.get(trackId);
    if (cached) {
      try { URL.revokeObjectURL(cached); } catch {}
      this.liveBlobUrls.delete(trackId);
    }
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio_blobs', 'readwrite');
      const store = tx.objectStore('audio_blobs');
      store.delete(trackId);
      if (trackId.startsWith('cloud-')) {
        store.delete(trackId.replace(/^cloud-/, ''));
      } else {
        store.delete(`cloud-${trackId}`);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Track Metadata ---
  async saveTracks(tracks: Track[]): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      tracks.forEach((track) => store.put(track));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async replaceTracks(tracks: Track[]): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      store.clear();
      tracks.forEach((track) => store.put(track));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveTrack(track: Track): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      const req = store.put(track);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async updateTrackSyncOffset(trackId: string, syncOffset: number): Promise<void> {
    const db = await this.openDB();
    // Also save in KV for guaranteed instant recall
    await this.setKV(`sync_offset_${trackId}`, syncOffset).catch(() => {});
    return new Promise((resolve) => {
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      const getReq = store.get(trackId);
      getReq.onsuccess = () => {
        const track = getReq.result;
        if (track) {
          track.syncOffset = syncOffset;
          store.put(track);
        }
        resolve();
      };
      getReq.onerror = () => resolve();
    });
  }

  async deleteTrack(trackId: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      const req = store.delete(trackId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearTracks(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllTracks(): Promise<Track[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readonly');
      const store = tx.objectStore('tracks');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Playlists ---
  async savePlaylists(playlists: Playlist[]): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('playlists', 'readwrite');
      const store = tx.objectStore('playlists');
      playlists.forEach((p) => store.put(p));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('playlists', 'readonly');
      const store = tx.objectStore('playlists');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Folders ---
  async saveFolders(folders: SmartFolder[]): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('folders', 'readwrite');
      const store = tx.objectStore('folders');
      folders.forEach((f) => store.put(f));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllFolders(): Promise<SmartFolder[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('folders', 'readonly');
      const store = tx.objectStore('folders');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // --- App State & Preferences ---
  async setKV<T>(key: string, value: T): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('app_state', 'readwrite');
      const store = tx.objectStore('app_state');
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getKV<T>(key: string): Promise<T | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('app_state', 'readonly');
      const store = tx.objectStore('app_state');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Storage Quota & Stats ---
  async getStorageUsage(): Promise<{ usedBytes: number; quotaBytes: number; offlineTracksCount: number }> {
    let usedBytes = 0;
    let quotaBytes = 0;

    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        usedBytes = estimate.usage || 0;
        quotaBytes = estimate.quota || 0;
      } catch (e) {
        console.warn('Storage estimate not supported', e);
      }
    }

    const tracks = await this.getAllTracks();
    const offlineCount = tracks.filter((t) => t.isOfflineAvailable).length;

    return {
      usedBytes,
      quotaBytes,
      offlineTracksCount: offlineCount,
    };
  }

  async cleanupOrphanedBlobs(): Promise<number> {
    const db = await this.openDB();
    const tracks = await this.getAllTracks();
    const validBlobIds = new Set<string>();
    tracks.forEach((t) => {
      if (t.blobId) validBlobIds.add(t.blobId);
      if (t.id) validBlobIds.add(t.id);
    });

    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio_blobs', 'readwrite');
      const store = tx.objectStore('audio_blobs');
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = req.result || [];
        let deletedCount = 0;
        for (const key of keys) {
          const keyStr = String(key);
          if (!validBlobIds.has(keyStr) && !validBlobIds.has(keyStr.replace(/^cloud-/, '')) && !validBlobIds.has(`cloud-${keyStr}`)) {
            store.delete(key);
            deletedCount++;
          }
        }
        tx.oncomplete = () => resolve(deletedCount);
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }
}

export const offlineStorage = new OfflineStorage();
