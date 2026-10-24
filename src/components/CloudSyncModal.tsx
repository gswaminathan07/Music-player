import React, { useState, useEffect } from 'react';
import { UserPreferences, Playlist, Track, EqualizerSettings, ListeningStats, SmartFolder } from '../types/music';
import { offlineStorage } from '../services/offlineStorage';
import { ExportService } from '../services/exportService';
import { cloudSyncService } from '../services/cloudSyncService';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  Check,
  AlertCircle,
  X,
  Smartphone,
  Laptop,
  RefreshCw,
  Copy,
  Sparkles,
  CheckCircle2,
  FileDown,
  FileUp,
  Trash2,
} from 'lucide-react';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: UserPreferences) => void;
  playlists: Playlist[];
  folders?: SmartFolder[];
  tracks: Track[];
  equalizer: EqualizerSettings;
  stats: ListeningStats;
  onRestoreProfile: (importedData: any) => void;
  onSyncCloudTracks?: (newTracks: Track[]) => void;
  onSelectTrack?: (track: Track) => void;
  onCloudCleared?: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  playlists,
  folders = [],
  tracks,
  equalizer,
  preferences,
  stats,
  onRestoreProfile,
  onSyncCloudTracks,
  onCloudCleared,
}) => {
  const [syncCode, setSyncCode] = useState(() => ExportService.generateSyncCode());
  const [inputCode, setInputCode] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [cloudTracksCount, setCloudTracksCount] = useState<number>(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearingCloud, setIsClearingCloud] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    completed: number;
    total: number;
    filename: string;
    percent: number;
  } | null>(null);

  const unsyncedTracks = tracks.filter((t) => t.isLocal && !t.isCloudSynced);
  const unsyncedCount = unsyncedTracks.length;

  const [status, setStatus] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const [latestBackup, setLatestBackup] = useState<{
    hasBackup: boolean;
    syncCode?: string;
    timestamp?: number;
    profile?: any;
    playlistsCount?: number;
    tracksCount?: number;
  } | null>(null);

  const handleSyncLocalToCloud = async () => {
    if (unsyncedCount === 0) return;
    setIsSyncing(true);
    setUploadProgress({ completed: 0, total: unsyncedCount, filename: 'Preparing files...', percent: 0 });
    setStatus({ text: `Syncing ${unsyncedCount} local songs to cloud...`, type: 'info' });

    try {
      const res = await cloudSyncService.syncLocalTracksToCloud(tracks, (p) => {
        setUploadProgress({
          completed: p.completed,
          total: p.total,
          filename: p.currentFileName,
          percent: p.percent,
        });
      });

      if (res.syncedCount > 0 && onSyncCloudTracks) {
        onSyncCloudTracks(res.updatedTracks);
      }

      setStatus({
        text: `Successfully synced ${res.syncedCount} local tracks to cloud!`,
        type: 'success',
      });
      loadCloudStats();
    } catch (err: any) {
      setStatus({
        text: `Sync error: ${err?.message || 'Server timeout'}`,
        type: 'error',
      });
    } finally {
      setIsSyncing(false);
      setUploadProgress(null);
    }
  };

  const loadCloudStats = async () => {
    try {
      const serverTracks = await cloudSyncService.fetchCloudTracks();
      setCloudTracksCount(serverTracks.length);
      const backupData = await cloudSyncService.fetchLatestBackup();
      if (backupData && backupData.hasBackup) {
        setLatestBackup(backupData);
      }
    } catch {
      // Ignore
    }
  };

  const buildCleanPayload = () => {
    return {
      preferences,
      playlists,
      folders,
      equalizer,
      stats,
      tracks: tracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        duration: t.duration,
        genre: t.genre,
        mood: t.mood,
        format: t.format,
        coverUrl: t.coverUrl && !t.coverUrl.startsWith('blob:') ? t.coverUrl : undefined,
        liked: t.liked,
        playCount: t.playCount,
        audioUrl: t.audioUrl?.startsWith('blob:') ? '' : t.audioUrl,
        isCloudSynced: true,
      })),
      timestamp: Date.now(),
    };
  };

  const handle1TapSync = async () => {
    setIsSyncing(true);
    setStatus({ text: 'Syncing complete library and audio from cloud...', type: 'info' });

    try {
      // 1. Sync cloud tracks
      const res = await cloudSyncService.syncWithCloud(tracks);
      setCloudTracksCount(res.allCloudTracks.length);
      if (res.newTracks.length > 0 && onSyncCloudTracks) {
        onSyncCloudTracks(res.newTracks);
      }

      // 2. Sync profile from latest snapshot or backup
      if (latestBackup?.profile) {
        onRestoreProfile(latestBackup.profile);
      } else {
        const cloudState = await cloudSyncService.fetchCloudSyncState();
        if (cloudState) {
          onRestoreProfile(cloudState);
        }
      }

      const totalTracks = Math.max(res.allCloudTracks.length, tracks.length, latestBackup?.tracksCount || 0);
      setStatus({
        text: `1-Tap Sync Complete! ${totalTracks} high-fidelity tracks & ${playlists.length} playlists synchronized.`,
        type: 'success',
      });
    } catch (err: any) {
      setStatus({
        text: `Sync note: ${err?.message || 'Connecting to cloud...'}. Retrying...`,
        type: 'error',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushToCloud = async () => {
    setIsSyncing(true);
    setStatus({ text: 'Syncing local audio files to cloud server...', type: 'info' });
    try {
      // 1. Sync local audio binary blobs to server disk first
      const syncRes = await cloudSyncService.syncLocalTracksToCloud(tracks, (p) => {
        setUploadProgress({
          completed: p.completed,
          total: p.total,
          filename: p.currentFileName,
          percent: p.percent,
        });
      });

      const currentTrackList = syncRes.syncedCount > 0 ? syncRes.updatedTracks : tracks;
      if (syncRes.syncedCount > 0 && onSyncCloudTracks) {
        onSyncCloudTracks(syncRes.updatedTracks);
      }

      setStatus({ text: 'Uploading library profile snapshot to cloud...', type: 'info' });

      // 2. Build payload with valid server audio URLs
      const payload = {
        preferences,
        playlists,
        folders,
        equalizer,
        stats,
        tracks: currentTrackList.map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.duration,
          genre: t.genre,
          mood: t.mood,
          format: t.format,
          coverUrl: t.coverUrl && !t.coverUrl.startsWith('blob:') ? t.coverUrl : undefined,
          liked: t.liked,
          playCount: t.playCount,
          audioUrl: t.audioUrl?.startsWith('blob:') ? `/api/audio/${t.id}` : t.audioUrl || `/api/audio/${t.id}`,
          isCloudSynced: true,
        })),
        timestamp: Date.now(),
      };

      const res = await cloudSyncService.backupProfile(syncCode, payload);
      setStatus({
        text: `Uploaded ${currentTrackList.length} audio tracks & ${playlists.length} playlists to cloud (Code: ${res.syncCode}). Ready for phone!`,
        type: 'success',
      });
      loadCloudStats();
    } catch (err: any) {
      setStatus({
        text: `Upload failed: ${err?.message || 'Server error'}`,
        type: 'error',
      });
    } finally {
      setIsSyncing(false);
      setUploadProgress(null);
    }
  };

  const handleRestoreWithCode = async (codeOverride?: string) => {
    const code = (codeOverride || inputCode).trim().toUpperCase();
    if (!code) {
      setStatus({ text: 'Please enter a 6-character sync code', type: 'error' });
      return;
    }

    setIsSyncing(true);
    setStatus({ text: `Fetching profile for code ${code}...`, type: 'info' });

    try {
      const res = await cloudSyncService.restoreProfile(code);
      if (res.success && res.profile) {
        onRestoreProfile(res.profile);
        const trkCount = res.profile.tracks?.length || 0;
        const plCount = res.profile.playlists?.length || 0;
        setStatus({
          text: `Successfully synced ${trkCount} tracks & ${plCount} playlists (${res.syncCode})!`,
          type: 'success',
        });
      } else {
        setStatus({
          text: res.error || `Sync code "${code}" not found.`,
          type: 'error',
        });
      }
    } catch {
      setStatus({ text: 'Error connecting to cloud server.', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(syncCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleExportJson = () => {
    const payload = buildCleanPayload();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `vettify-library-backup-${Date.now()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.tracks || parsed.playlists) {
          onRestoreProfile(parsed);
          setStatus({ text: 'Successfully imported library backup JSON!', type: 'success' });
        }
      } catch {
        setStatus({ text: 'Failed to read JSON backup file.', type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  const handleClearCloudStorage = async () => {
    setIsClearingCloud(true);
    setStatus({ text: 'Deleting all cloud audio files from server...', type: 'info' });
    try {
      const res = await cloudSyncService.clearCloudTracks();
      setCloudTracksCount(0);
      setShowClearConfirm(false);
      setStatus({
        text: `Server cleared: ${res.deletedCount} songs removed from cloud storage.`,
        type: 'success',
      });
      if (onCloudCleared) {
        onCloudCleared();
      }
    } catch (err: any) {
      setStatus({
        text: `Failed to clear server tracks: ${err?.message || 'Error'}`,
        type: 'error',
      });
    } finally {
      setIsClearingCloud(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCloudStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const displayTrackCount = Math.max(tracks.length, cloudTracksCount, latestBackup?.tracksCount || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md bg-[#141418] border border-zinc-800 rounded-3xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>Cloud Sync</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">Laptop ⇄ Phone Library Sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Status Badge */}
        <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-cyan-950/60 to-zinc-900 border border-cyan-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Laptop className="w-4 h-4 text-cyan-400" />
            <span className="text-zinc-300">Ready</span>
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <span className="font-mono text-cyan-300 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-900/60 border border-cyan-700/60">
            ☁️ {displayTrackCount} Tracks Synced
          </span>
        </div>

        {/* Primary Action: 1-Tap Sync */}
        <div className="mb-4">
          <button
            onClick={handle1TapSync}
            disabled={isSyncing}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 via-sky-500 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-cyan-950/50 transition active:scale-[0.98] disabled:opacity-60"
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>1-Tap Sync from Laptop</span>
          </button>
        </div>

        {/* Sync Local Tracks to Cloud Card */}
        <div className="mb-4 p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <CloudUpload className="w-4 h-4 text-emerald-400" />
              <span>Sync Local Tracks to Cloud</span>
            </span>
            <span className="font-mono text-[11px] font-semibold text-emerald-300 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/80">
              {unsyncedCount} Local {unsyncedCount === 1 ? 'Track' : 'Tracks'}
            </span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-tight">
            {unsyncedCount > 0
              ? `${unsyncedCount} song${unsyncedCount === 1 ? '' : 's'} imported locally. Upload to cloud server so they are accessible on your phone and other devices.`
              : 'All imported local tracks are backed up to the cloud!'}
          </p>

          {uploadProgress && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[10px] text-zinc-300">
                <span className="truncate max-w-[200px]">{uploadProgress.filename}</span>
                <span className="font-mono font-bold text-emerald-400">
                  {uploadProgress.completed}/{uploadProgress.total} ({uploadProgress.percent}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleSyncLocalToCloud}
            disabled={isSyncing || unsyncedCount === 0}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50"
          >
            {isSyncing && uploadProgress ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CloudUpload className="w-3.5 h-3.5" />
            )}
            <span>
              {unsyncedCount > 0
                ? `Sync ${unsyncedCount} Local Track${unsyncedCount === 1 ? '' : 's'} to Cloud`
                : 'All Tracks Synced to Cloud'}
            </span>
          </button>
        </div>

        {/* Sync Code Option */}
        <div className="mb-4 p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300">Sync with Code</span>
            <button
              onClick={handlePushToCloud}
              disabled={isSyncing}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
            >
              <CloudUpload className="w-3 h-3" />
              <span>Push to Cloud</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="Code (e.g. VET-FYKU)"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 uppercase focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => handleRestoreWithCode()}
              disabled={!inputCode || isSyncing}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition disabled:opacity-40"
            >
              Restore
            </button>
          </div>

          {/* Current Device Code */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px]">
            <span className="text-zinc-400">Your laptop code:</span>
            <div className="flex items-center gap-1.5 font-mono font-bold text-cyan-300">
              <span>{syncCode}</span>
              <button
                onClick={handleCopyCode}
                className="p-1 text-zinc-400 hover:text-white transition"
                title="Copy Code"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Server Cloud Storage Management */}
        <div className="mb-4 p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-cyan-400" />
              <span>Server Cloud Storage</span>
            </span>
            <span className="font-mono text-[11px] text-zinc-400">
              {cloudTracksCount} {cloudTracksCount === 1 ? 'song' : 'songs'} on server
            </span>
          </div>

          {!showClearConfirm ? (
            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-zinc-400 leading-tight">
                Clear all audio files stored on the cloud server.
              </p>
              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={isSyncing || isClearingCloud}
                className="px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 hover:border-rose-500/60 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 shrink-0 ml-2"
                title="Clear all songs stored on the server"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Clear Cloud</span>
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 space-y-2 animate-in fade-in">
              <p className="text-[11px] font-medium text-rose-200 leading-relaxed">
                Delete all songs stored on the cloud server? Local tracks on this laptop remain safe.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  disabled={isClearingCloud}
                  className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearCloudStorage}
                  disabled={isClearingCloud}
                  className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {isClearingCloud ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  <span>{isClearingCloud ? 'Clearing...' : 'Yes, Clear Server'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Feedback Message Banner */}
        {status && (
          <div
            className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 transition-all ${
              status.type === 'error'
                ? 'bg-rose-950/80 border border-rose-800/80 text-rose-200'
                : status.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-800/80 text-emerald-200'
                : 'bg-cyan-950/80 border border-cyan-800/80 text-cyan-200'
            }`}
          >
            {status.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : status.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
            )}
            <span className="font-medium leading-relaxed">{status.text}</span>
          </div>
        )}

        {/* Offline Transfer Backup Option */}
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Offline JSON file backup:</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportJson}
              className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
            >
              <FileDown className="w-3 h-3" />
              <span>Export</span>
            </button>
            <label className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer">
              <FileUp className="w-3 h-3" />
              <span>Import</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
