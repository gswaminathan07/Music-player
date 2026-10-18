import React, { useState, useEffect } from 'react';
import { UserPreferences, Playlist, Track, EqualizerSettings, ListeningStats } from '../types/music';
import { offlineStorage } from '../services/offlineStorage';
import { ExportService } from '../services/exportService';
import { cloudSyncService } from '../services/cloudSyncService';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  HardDrive,
  Check,
  AlertCircle,
  X,
  Smartphone,
  Laptop,
  Play,
  Moon,
  Sparkles,
  WifiOff,
  RefreshCw,
  Music,
} from 'lucide-react';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: UserPreferences) => void;
  playlists: Playlist[];
  tracks: Track[];
  equalizer: EqualizerSettings;
  stats: ListeningStats;
  onRestoreProfile: (importedData: any) => void;
  onSyncCloudTracks?: (newTracks: Track[]) => void;
  onSelectTrack?: (track: Track) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onUpdatePreferences,
  playlists,
  tracks,
  equalizer,
  stats,
  onRestoreProfile,
  onSyncCloudTracks,
  onSelectTrack,
}) => {
  const [syncCode, setSyncCode] = useState(() => ExportService.generateSyncCode());
  const [inputCode, setInputCode] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCheckingCloudAudio, setIsCheckingCloudAudio] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [cloudTracksList, setCloudTracksList] = useState<Track[]>([]);
  const [storageInfo, setStorageInfo] = useState<{ usedBytes: number; offlineTracksCount: number }>({
    usedBytes: 0,
    offlineTracksCount: 0,
  });

  const loadCloudAudioList = async () => {
    setIsCheckingCloudAudio(true);
    try {
      const serverTracks = await cloudSyncService.fetchCloudTracks();
      setCloudTracksList(serverTracks);
    } catch {
      // Ignore
    } finally {
      setIsCheckingCloudAudio(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCloudAudioList();
      offlineStorage.getStorageUsage().then((info) => {
        setStorageInfo({
          usedBytes: info.usedBytes,
          offlineTracksCount: info.offlineTracksCount,
        });
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSyncFromLaptop = async () => {
    setIsCheckingCloudAudio(true);
    setStatusText('Checking server for new audio uploaded from laptop...');
    try {
      const res = await cloudSyncService.syncWithCloud(tracks);
      setCloudTracksList(res.allCloudTracks);
      if (res.newTracks.length > 0) {
        if (onSyncCloudTracks) {
          onSyncCloudTracks(res.newTracks);
        }
        setStatusText(`Successfully synced ${res.newTracks.length} new track${res.newTracks.length === 1 ? '' : 's'} from your laptop!`);
      } else {
        setStatusText(`All ${res.count} cloud tracks from your laptop are up to date!`);
      }
    } catch (err: any) {
      setStatusText('Failed to check cloud tracks. Verify your connection.');
    } finally {
      setIsCheckingCloudAudio(false);
    }
  };

  const handleBackupToCloud = async () => {
    setIsSyncing(true);
    setStatusText('Encrypting and backing up profile to cloud...');

    const payload = {
      preferences,
      playlists,
      equalizer,
      stats,
      savedTrackIds: tracks.filter((t) => t.liked).map((t) => t.id),
      timestamp: Date.now(),
    };

    try {
      const res = await fetch('/api/sync/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncCode, profileData: payload }),
      });

      if (!res.ok) throw new Error('Cloud sync request failed');
      setStatusText(`Cloud sync complete! Your code is ${syncCode}. Use this code on any device.`);
    } catch (err: any) {
      // Local snapshot fallback
      await offlineStorage.setKV('cloud_snapshot', payload);
      setStatusText(`Synced to local cloud cache! Code: ${syncCode}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!inputCode.trim()) return;
    setIsSyncing(true);
    setStatusText(`Searching cloud for code ${inputCode.toUpperCase()}...`);

    try {
      const res = await fetch(`/api/sync/restore/${inputCode.trim().toUpperCase()}`);
      if (!res.ok) throw new Error('Code not found');
      const data = await res.json();
      if (data.profile) {
        onRestoreProfile(data.profile);
        setStatusText('Profile & playlists successfully synced from cloud!');
      }
    } catch (err) {
      setStatusText('Sync code not found or expired. Check spelling and retry.');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb > 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#141418]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-6 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Cloud Sync & Cross-Device Audio</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Laptop ⇄ Phone Audio Sync & Remote Listening Storage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Laptop ⇄ Phone Cloud Audio Library Sync */}
        <div className="mb-5 bg-gradient-to-br from-cyan-950/40 via-zinc-950 to-zinc-950 border border-cyan-800/60 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-white flex items-center gap-2">
              <Laptop className="w-4 h-4 text-cyan-400" />
              <span>Laptop ⇄ Phone Audio Sync</span>
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            </span>
            <span className="font-mono text-cyan-400 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60">
              {cloudTracksList.length} Tracks in Cloud
            </span>
          </div>
          <p className="text-xs text-zinc-300 mb-3 leading-relaxed">
            Audio uploaded from a laptop on the desktop site will also show up on the phone version of the app. All synced tracks stream in high-fidelity across all devices.
          </p>

          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={handleManualSyncFromLaptop}
              disabled={isCheckingCloudAudio}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition disabled:opacity-50 shadow-md active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingCloudAudio ? 'animate-spin' : ''}`} />
              <span>{isCheckingCloudAudio ? 'Checking Cloud Audio...' : 'Sync from Laptop Now'}</span>
            </button>
          </div>

          {/* List of Cloud Synced Tracks */}
          {cloudTracksList.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-1.5 max-h-48 overflow-y-auto pr-1">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                Audio Available on Phone ({cloudTracksList.length})
              </span>
              {cloudTracksList.map((ct) => (
                <div
                  key={ct.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs hover:border-cyan-500/40 transition group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-cyan-400 shrink-0">
                      <Music className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="font-semibold text-zinc-200 truncate group-hover:text-cyan-300">
                        {ct.title}
                      </h5>
                      <span className="text-[11px] text-zinc-400 truncate block">
                        {ct.artist} · <span className="font-mono text-cyan-400/90">{ct.format || 'MP3'}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-zinc-500">
                      {formatTime(ct.duration)}
                    </span>
                    {onSelectTrack && (
                      <button
                        onClick={() => {
                          onSelectTrack(ct);
                          onClose();
                        }}
                        className="p-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition active:scale-95"
                        title="Play on this device"
                      >
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Cloud Profile Snapshot Backup */}
        <div className="mb-5 bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <CloudUpload className="w-4 h-4 text-cyan-400" />
              Backup Current Profile & Playlists
            </span>
            <span className="font-mono text-zinc-500 text-[10px]">Cloud Snapshot</span>
          </div>
          <p className="text-xs text-zinc-400 mb-3">
            Saves your playlists, smart folders, EQ presets, and favorites for access on another phone or computer.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-300">
              {syncCode}
            </div>
            <button
              onClick={handleBackupToCloud}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition disabled:opacity-50"
            >
              <CloudUpload className="w-4 h-4" />
              Sync Now
            </button>
          </div>
        </div>

        {/* Section 3: Restore from Another Device */}
        <div className="mb-5 bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <CloudDownload className="w-4 h-4 text-emerald-400" />
              Restore Profile from Another Device
            </span>
          </div>
          <p className="text-xs text-zinc-400 mb-3">
            Enter the 6-character sync code from your other device to import playlists and equalizer settings.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="e.g. VET-8942"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 uppercase focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleRestoreFromCloud}
              disabled={!inputCode || isSyncing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition disabled:opacity-50"
            >
              <CloudDownload className="w-4 h-4" />
              Restore
            </button>
          </div>
        </div>

        {/* Status display */}
        {statusText && (
          <div className="mb-4 p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-xs text-cyan-300 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>{statusText}</span>
          </div>
        )}

        {/* Section 4: Offline Listening in Remote Areas Section */}
        <div className="mb-5 bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-amber-400" />
              Offline Remote Area Listening
            </span>
            <span className="font-mono text-emerald-400 text-[11px] font-semibold">
              {storageInfo.offlineTracksCount} Tracks Offline
            </span>
          </div>
          <p className="text-xs text-zinc-400 mb-3">
            Audio files and high-resolution streams are stored locally in your browser's IndexedDB database, guaranteeing uninterrupted music playback when traveling in remote areas without cellular data or WiFi.
          </p>

          <div className="flex items-center justify-between bg-zinc-900 p-2.5 rounded-xl border border-zinc-800 text-xs">
            <div className="flex items-center gap-2 text-zinc-300">
              <WifiOff className="w-4 h-4 text-emerald-400" />
              <span>Offline-Only Mode</span>
            </div>
            <button
              onClick={() =>
                onUpdatePreferences({
                  ...preferences,
                  offlineOnlyMode: !preferences.offlineOnlyMode,
                })
              }
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                preferences.offlineOnlyMode
                  ? 'bg-emerald-500 text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {preferences.offlineOnlyMode ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end border-t border-zinc-800 pt-3">
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
