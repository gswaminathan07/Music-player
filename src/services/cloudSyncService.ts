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
   */
  async uploadAudioFile(file: File, trackMeta: Partial<Track>): Promise<Track | null> {
    try {
      const response = await fetch('/api/cloud/upload', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'audio/mpeg',
          'x-file-name': encodeURIComponent(file.name),
          'x-title': encodeURIComponent(trackMeta.title || file.name),
          'x-artist': encodeURIComponent(trackMeta.artist || 'Local Upload'),
          'x-album': encodeURIComponent(trackMeta.album || ''),
          'x-duration': String(trackMeta.duration || 180),
          'x-genre': encodeURIComponent(trackMeta.genre || 'Electronic'),
          'x-mood': encodeURIComponent(trackMeta.mood || 'Chill'),
          'x-cover-url': encodeURIComponent(trackMeta.coverUrl || ''),
          'x-format': trackMeta.format || (file.name.split('.').pop()?.toUpperCase() || 'MP3'),
          'x-track-id': trackMeta.id || '',
        },
        body: file,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.track) {
        const uploadedTrack = result.track as Track;
        this.cachedCloudTracks.unshift(uploadedTrack);
        this.lastSyncedTime = Date.now();
        this.notify({
          type: 'upload-complete',
          tracks: [uploadedTrack],
          message: `Synced "${uploadedTrack.title}" to cloud!`,
        });
        return uploadedTrack;
      }
    } catch (err: any) {
      console.error('Error uploading audio to cloud:', err);
      this.notify({
        type: 'sync-error',
        message: err?.message || 'Failed to upload audio to cloud',
      });
    }
    return null;
  }

  /**
   * Fetch all tracks uploaded to the cloud (called automatically by mobile phones
   * and laptops to synchronize libraries).
   */
  async fetchCloudTracks(): Promise<Track[]> {
    try {
      const response = await fetch('/api/cloud/tracks');
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.tracks)) {
          this.lastSyncedTime = Date.now();
          this.cachedCloudTracks = result.tracks as Track[];
          return this.cachedCloudTracks;
        }
      }
    } catch (err) {
      console.warn('Could not fetch cloud tracks:', err);
    }
    return this.cachedCloudTracks;
  }

  /**
   * Performs an incremental synchronization of local tracks with cloud tracks.
   * Identifies any audio uploaded on laptop/desktop that is not yet on the current phone/device,
   * adds it to local storage, and returns the newly synced tracks.
   */
  async syncWithCloud(localTracks: Track[]): Promise<CloudSyncResult> {
    if (this.isSyncing) {
      return { newTracks: [], allCloudTracks: this.cachedCloudTracks, count: this.cachedCloudTracks.length };
    }

    this.isSyncing = true;
    try {
      const cloudTracks = await this.fetchCloudTracks();
      const localIdSet = new Set(localTracks.map((t) => t.id));

      // Tracks that exist in cloud but not locally on this device
      const newTracks: Track[] = [];
      for (const ct of cloudTracks) {
        if (!localIdSet.has(ct.id)) {
          newTracks.push({
            ...ct,
            isLocal: false,
            isCloudSynced: true,
            isOfflineAvailable: false, // Can be downloaded if user toggles offline
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
    try {
      const response = await fetch('/api/cloud/sync-state');
      if (response.ok) {
        const result = await response.json();
        return result.state || null;
      }
    } catch {
      // Ignore
    }
    return null;
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
}

export const cloudSyncService = new CloudSyncService();
