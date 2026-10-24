import { Track } from '../types/music';
import { offlineStorage } from './offlineStorage';

export interface CloudSyncResult {
  newTracks: Track[];
  allCloudTracks: Track[];
  count: number;
}

type SyncListener = (event: {
  type: 'sync-complete' | 'upload-complete' | 'sync-error';
  tracks?: Track[];
  message?: string;
}) => void;

class CloudSyncService {
  private lastSyncedTime = 0;
  private isSyncing = false;
  private listeners: Set<SyncListener> = new Set();
  private cachedCloudTracks: Track[] = [];

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(event: {
    type: 'sync-complete' | 'upload-complete' | 'sync-error';
    tracks?: Track[];
    message?: string;
  }) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn('Sync listener notification error:', err);
      }
    });
  }

  /**
   * Upload an audio file from desktop/laptop to cloud storage so it is available
   * across all devices (including mobile phones).
   * Safe against HTTP 431 header overflow by stripping large data URLs from headers
   * and calling /api/cloud/track-metadata when needed.
   */
  async uploadAudioFile(file: File, trackMeta: Partial<Track>, retries = 3): Promise<Track | null> {
    // Pass minimal lightweight metadata via query string to prevent HTTP 414 / 431 URI limits
    const safeTitle = (trackMeta.title || file.name).slice(0, 80);
    const safeArtist = (trackMeta.artist || 'Local Upload').slice(0, 80);
    const queryParams = new URLSearchParams({
      fileName: file.name.slice(0, 80),
      title: safeTitle,
      artist: safeArtist,
      duration: String(trackMeta.duration || 180),
      trackId: trackMeta.id || '',
    });

    let attempt = 0;
    while (attempt < retries) {
      attempt++;
      try {
        const response = await fetch(`/api/cloud/upload?${queryParams.toString()}`, {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'audio/mpeg',
          },
          body: file,
        });

        if (!response.ok) {
          if (response.status >= 500 && attempt < retries) {
            await new Promise((r) => setTimeout(r, 800 * attempt));
            continue;
          }
          throw new Error(`Upload failed with status ${response.status}`);
        }

        const result = await response.json();
        if (result.success && result.track) {
          let uploadedTrack = result.track as Track;

          // Always post full rich metadata (including long titles, album, genre, base64 cover art) safely via JSON
          try {
            const metaRes = await fetch('/api/cloud/track-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                trackId: uploadedTrack.id,
                title: trackMeta.title || uploadedTrack.title,
                artist: trackMeta.artist || uploadedTrack.artist,
                album: trackMeta.album || uploadedTrack.album,
                genre: trackMeta.genre || uploadedTrack.genre,
                mood: trackMeta.mood || uploadedTrack.mood,
                duration: trackMeta.duration || uploadedTrack.duration,
                coverUrl: trackMeta.coverUrl,
                format: trackMeta.format,
              }),
            });
            if (metaRes.ok) {
              const metaData = await metaRes.json();
              if (metaData.track) uploadedTrack = metaData.track;
            }
          } catch {
            // Non-critical metadata post fallback
          }

          // Deduplicate cache
          this.cachedCloudTracks = this.cachedCloudTracks.filter((t) => t.id !== uploadedTrack.id);
          this.cachedCloudTracks.unshift(uploadedTrack);
          this.lastSyncedTime = Date.now();

          return uploadedTrack;
        }
      } catch (err: any) {
        if (attempt >= retries) {
          console.warn(`Failed to upload ${file.name} after ${retries} attempts:`, err);
        } else {
          await new Promise((r) => setTimeout(r, 600 * attempt));
        }
      }
    }
    return null;
  }

  /**
   * Batch Upload for large libraries (400+ songs) with chunking concurrency,
   * live progress feedback, and retry failsafe.
   */
  async uploadAudioBatch(
    items: Array<{ file: File; trackMeta: Partial<Track> }>,
    onProgress?: (info: {
      completed: number;
      total: number;
      failed: number;
      currentFileName: string;
      percent: number;
    }) => void,
    concurrency = 4
  ): Promise<Track[]> {
    if (!items || items.length === 0) return [];

    const total = items.length;
    let completed = 0;
    let failed = 0;
    const uploadedTracks: Track[] = [];

    // Process in parallel chunks of size `concurrency`
    for (let i = 0; i < total; i += concurrency) {
      const chunk = items.slice(i, i + concurrency);

      const chunkPromises = chunk.map(async (item) => {
        if (onProgress) {
          onProgress({
            completed,
            total,
            failed,
            currentFileName: item.file.name,
            percent: Math.round((completed / total) * 100),
          });
        }

        const track = await this.uploadAudioFile(item.file, item.trackMeta);
        completed++;

        if (track) {
          uploadedTracks.push(track);
        } else {
          failed++;
        }

        if (onProgress) {
          onProgress({
            completed,
            total,
            failed,
            currentFileName: item.file.name,
            percent: Math.round((completed / total) * 100),
          });
        }
      });

      await Promise.all(chunkPromises);
    }

    if (uploadedTracks.length > 0) {
      this.notify({
        type: 'upload-complete',
        tracks: uploadedTracks,
        message: `Batch synced ${uploadedTracks.length} of ${total} tracks to cloud!`,
      });
    }

    return uploadedTracks;
  }

  /**
   * Fetch all tracks uploaded to the cloud (called automatically by mobile phones
   * and laptops to synchronize libraries).
   */
  async fetchCloudTracks(): Promise<Track[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/cloud/tracks', { signal: controller.signal });
      clearTimeout(timeoutId);
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const result = await response.json();
        if (result.success && Array.isArray(result.tracks)) {
          this.lastSyncedTime = Date.now();
          this.cachedCloudTracks = result.tracks as Track[];
          return this.cachedCloudTracks;
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      // Silent catch during container wake-up
    }
    return this.cachedCloudTracks;
  }

  /**
   * Delete and clear all audio tracks stored on the cloud server.
   */
  async clearCloudTracks(): Promise<{ success: boolean; deletedCount: number; message?: string }> {
    try {
      const response = await fetch('/api/cloud/tracks', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to clear cloud tracks (${response.status})`);
      }
      const data = await response.json();
      this.cachedCloudTracks = [];
      this.lastSyncedTime = Date.now();
      this.notify({
        type: 'sync-complete',
        tracks: [],
        message: 'All cloud songs cleared from server.',
      });
      return { success: true, deletedCount: data.deletedCount || 0, message: data.message };
    } catch (err: any) {
      console.warn('Error clearing cloud tracks:', err);
      throw err;
    }
  }

  /**
   * Performs an incremental synchronization of local tracks with cloud tracks.
   * Identifies any audio uploaded on laptop/desktop that is not yet on the current phone/device,
   * adds it to local storage, and returns the newly synced tracks.
   * Uses strict deduplication by ID and (title + artist).
   */
  async syncWithCloud(localTracks: Track[]): Promise<CloudSyncResult> {
    if (this.isSyncing) {
      return { newTracks: [], allCloudTracks: this.cachedCloudTracks, count: this.cachedCloudTracks.length };
    }

    this.isSyncing = true;
    try {
      const cloudTracks = await this.fetchCloudTracks();

      // Normalize string helper for deduplication
      const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const localIdSet = new Set(localTracks.map((t) => t.id));
      const localKeySet = new Set(localTracks.map((t) => `${norm(t.title)}::${norm(t.artist)}`));

      // Tracks that exist in cloud but not locally on this device
      const newTracks: Track[] = [];
      for (const ct of cloudTracks) {
        const key = `${norm(ct.title)}::${norm(ct.artist)}`;
        if (!localIdSet.has(ct.id) && !localKeySet.has(key)) {
          newTracks.push({
            ...ct,
            isLocal: false,
            isCloudSynced: true,
            isOfflineAvailable: false,
          });
        }
      }

      if (newTracks.length > 0) {
        this.notify({
          type: 'sync-complete',
          tracks: newTracks,
          message: `Synced ${newTracks.length} track${newTracks.length === 1 ? '' : 's'} from laptop!`,
        });
      }

      return {
        newTracks,
        allCloudTracks: cloudTracks,
        count: cloudTracks.length,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Downloads cloud audio from server and saves it as an offline blob in phone's IndexedDB.
   */
  async cacheCloudTrackLocally(track: Track): Promise<boolean> {
    try {
      if (!track.audioUrl) return false;
      const res = await fetch(track.audioUrl);
      if (!res.ok) return false;
      const blob = await res.blob();
      await offlineStorage.saveAudioBlob(track.id, blob);
      return true;
    } catch (err) {
      console.warn(`Failed to cache cloud track ${track.id} locally:`, err);
      return false;
    }
  }

  /**
   * Remove a cloud track from server
   */
  async deleteCloudTrack(trackId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/cloud/tracks/${encodeURIComponent(trackId)}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        this.cachedCloudTracks = this.cachedCloudTracks.filter((t) => t.id !== trackId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Save full user library profile (playlists, favorites, equalizer, sync offsets) to cloud
   */
  async saveCloudSyncState(state: any): Promise<boolean> {
    try {
      const response = await fetch('/api/cloud/sync-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Retrieve full user library profile from cloud
   */
  async fetchCloudSyncState(): Promise<any | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('/api/cloud/sync-state', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const result = await response.json();
        return result.state || null;
      }
    } catch {
      clearTimeout(timeoutId);
    }
    return null;
  }

  /**
   * Backup profile with human-readable sync code to persistent server storage
   */
  async backupProfile(syncCode: string, profileData: any): Promise<{ success: boolean; syncCode: string }> {
    const response = await fetch('/api/sync/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncCode, profileData }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backup failed: ${response.statusText || errorText}`);
    }
    const result = await response.json();
    return { success: true, syncCode: result.syncCode || syncCode };
  }

  /**
   * Restore profile from cloud using code (e.g. VET-KZAB or KZAB)
   */
  async restoreProfile(code: string): Promise<{ success: boolean; profile?: any; syncCode?: string; error?: string }> {
    const cleanCode = code.trim();
    if (!cleanCode) return { success: false, error: 'Please enter a sync code' };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`/api/sync/restore/${encodeURIComponent(cleanCode)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        let msg = 'Sync code not found or expired';
        try {
          const errData = await response.json();
          if (errData?.error) msg = errData.error;
        } catch {}
        return { success: false, error: msg };
      }
      const data = await response.json();
      return { success: true, profile: data.profile, syncCode: data.syncCode };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return { success: false, error: err?.name === 'AbortError' ? 'Connection timed out. Server is waking up, please retry.' : 'Failed to connect to cloud' };
    }
  }

  /**
   * Check if a recent backup from laptop is available on the server
   */
  async fetchLatestBackup(): Promise<{ hasBackup: boolean; syncCode?: string; timestamp?: number; profile?: any; playlistsCount?: number; tracksCount?: number }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('/api/sync/latest', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch {
      clearTimeout(timeoutId);
    }
    return { hasBackup: false };
  }

  getLastSyncedTime(): number {
    return this.lastSyncedTime;
  }

  getCachedCloudTracks(): Track[] {
    return this.cachedCloudTracks;
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Helper to return all local tracks that are not yet uploaded/synced to the cloud server.
   */
  getUnsyncedLocalTracks(localTracks: Track[]): Track[] {
    return (localTracks || []).filter((t) => t.isLocal && !t.isCloudSynced);
  }

  /**
   * Explicitly uploads unsynced local tracks to cloud storage on demand.
   * Pulls binary Blobs from IndexedDB for each track and uploads in parallel batches.
   */
  async syncLocalTracksToCloud(
    localTracks: Track[],
    onProgress?: (info: {
      completed: number;
      total: number;
      failed: number;
      currentFileName: string;
      percent: number;
    }) => void
  ): Promise<{ syncedCount: number; updatedTracks: Track[] }> {
    const unsynced = this.getUnsyncedLocalTracks(localTracks);
    if (unsynced.length === 0) {
      return { syncedCount: 0, updatedTracks: localTracks };
    }

    const itemsToUpload: Array<{ file: File; trackMeta: Partial<Track>; originalTrack: Track }> = [];

    for (const track of unsynced) {
      let blob: Blob | null = null;
      if (track.blobId) {
        blob = await offlineStorage.getAudioBlob(track.blobId).catch(() => null);
      }
      if (!blob && track.id) {
        blob = await offlineStorage.getAudioBlob(track.id).catch(() => null);
      }
      if (!blob && track.id.startsWith('cloud-')) {
        blob = await offlineStorage.getAudioBlob(track.id.replace(/^cloud-/, '')).catch(() => null);
      }
      if (!blob && !track.id.startsWith('cloud-')) {
        blob = await offlineStorage.getAudioBlob(`cloud-${track.id}`).catch(() => null);
      }

      if (blob) {
        const ext = track.format?.toLowerCase() || 'mp3';
        const safeName = (track.title || 'track').replace(/[^a-zA-Z0-9_-]/g, '_');
        const file = new File([blob], `${safeName}.${ext}`, { type: blob.type || 'audio/mpeg' });
        itemsToUpload.push({
          file,
          trackMeta: {
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            genre: track.genre,
            mood: track.mood,
            duration: track.duration,
            coverUrl: track.coverUrl,
            format: track.format,
          },
          originalTrack: track,
        });
      }
    }

    if (itemsToUpload.length === 0) {
      return { syncedCount: 0, updatedTracks: localTracks };
    }

    const uploadedCloudTracks = await this.uploadAudioBatch(
      itemsToUpload.map((item) => ({ file: item.file, trackMeta: item.trackMeta })),
      onProgress,
      3
    );

    const cloudTrackMap = new Map<string, Track>();
    uploadedCloudTracks.forEach((ct) => {
      cloudTrackMap.set(ct.id, ct);
      const cleanId = ct.id.replace(/^cloud-/, '');
      cloudTrackMap.set(cleanId, ct);
      const normKey = `${(ct.title || '').toLowerCase().trim()}::${(ct.artist || '').toLowerCase().trim()}`;
      cloudTrackMap.set(normKey, ct);
    });

    const updatedTracks = localTracks.map((t) => {
      const normKey = `${(t.title || '').toLowerCase().trim()}::${(t.artist || '').toLowerCase().trim()}`;
      const match = cloudTrackMap.get(t.id) || cloudTrackMap.get(normKey);
      if (match) {
        return {
          ...t,
          ...match,
          id: match.id,
          audioUrl: t.audioUrl || match.audioUrl || `/api/audio/${match.id}`,
          blobId: match.id,
          isLocal: true,
          isCloudSynced: true,
          isOfflineAvailable: true,
        };
      }
      return t;
    });

    await offlineStorage.saveTracks(updatedTracks).catch(() => {});

    return {
      syncedCount: uploadedCloudTracks.length,
      updatedTracks,
    };
  }
}

export const cloudSyncService = new CloudSyncService();
