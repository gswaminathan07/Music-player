import React, { useState } from 'react';
import {
  X,
  Disc3,
  Smartphone,
  Sliders,
  Download,
  WifiOff,
  Check,
  PlusCircle,
  Pin,
  ExternalLink,
  Layers,
  Sparkles,
  RefreshCw,
  FolderOpen,
  Volume2,
  Sun,
  Moon,
  ShieldCheck,
  Mic2,
  Cloud,
  HardDrive,
  Loader2,
} from 'lucide-react';
import { Track, UserPreferences, EqualizerSettings } from '../types/music';
import { PixelTurntableWidget } from './PixelTurntableWidget';
import { PixelNotificationWidget } from './PixelNotificationWidget';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { lyricsService } from '../services/lyricsService';
import { offlineStorage } from '../services/offlineStorage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onToggleLike: (trackId: string) => void;
  onOpenPlayer: () => void;
  onOpenEq: () => void;
  isFloatingWidgetActive: boolean;
  onToggleFloatingWidget: () => void;
  activeWidgetStyle: 'turntable' | 'notification' | 'samsung';
  onChangeWidgetStyle: (style: 'turntable' | 'notification' | 'samsung') => void;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: UserPreferences) => void;
  equalizer: EqualizerSettings;
  onOpenUpload: () => void;
  onClearLibrary: () => void;
  onOpenCloudSync?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onToggleLike,
  onOpenPlayer,
  onOpenEq,
  isFloatingWidgetActive,
  onToggleFloatingWidget,
  activeWidgetStyle,
  onChangeWidgetStyle,
  preferences,
  onUpdatePreferences,
  equalizer,
  onOpenUpload,
  onClearLibrary,
  onOpenCloudSync,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'widgets' | 'install' | 'audio' | 'general'>('widgets');
  const [lyricOffset, setLyricOffset] = useState<number>(0);
  const [storageUsage, setStorageUsage] = useState<{ usedBytes: number; quotaBytes: number; offlineTracksCount: number } | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      offlineStorage.getStorageUsage().then(setStorageUsage).catch(() => {});
    }
  }, [isOpen]);

  const handleCleanStorage = async () => {
    setIsCleaning(true);
    try {
      const removed = await offlineStorage.cleanupOrphanedBlobs();
      const usage = await offlineStorage.getStorageUsage();
      setStorageUsage(usage);
      showToast(`Cleaned ${removed} duplicate files. Storage optimized!`);
    } catch {
      showToast('Storage cleanup failed.');
    } finally {
      setIsCleaning(false);
    }
  };

  // Load persisted lyric sync offset whenever currentTrack changes
  React.useEffect(() => {
    if (!currentTrack) {
      setLyricOffset(0);
      return;
    }
    lyricsService.getTrackSyncOffset(currentTrack).then(setLyricOffset);
  }, [currentTrack?.id]);

  const handleUpdateLyricOffset = (updater: number | ((prev: number) => number)) => {
    if (!currentTrack) return;
    setLyricOffset((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const clamped = Math.max(-20, Math.min(20, parseFloat(next.toFixed(2))));
      lyricsService.saveTrackSyncOffset(currentTrack.id, clamped);
      showToast(`Lyric Offset: ${clamped >= 0 ? `+${clamped.toFixed(2)}s` : `${clamped.toFixed(2)}s`} saved!`);
      return clamped;
    });
  };

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddTurntableToScreen = () => {
    onChangeWidgetStyle('turntable');
    if (!isFloatingWidgetActive) {
      onToggleFloatingWidget();
    }
    showToast('Turntable Widget Added to Screen!');
  };

  const handleNativeInstall = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) showToast('Vettify installed to your home screen!');
    } else {
      showToast('Tap browser menu (⋮) -> "Add to Home Screen"');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg bg-[#16151a]/90 backdrop-blur-2xl border-t sm:border border-white/10 rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Floating Toast */}
        {toastMessage && (
          <div className="absolute top-4 left-4 right-4 z-50 flex items-center gap-2 p-3 rounded-2xl bg-emerald-500 text-zinc-950 text-xs font-bold shadow-2xl animate-fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top drag handle for phone modal */}
        <div className="w-12 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-1 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-white">
              <Disc3 className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Settings</h3>
              <p className="text-[11px] text-zinc-400">Widgets & app preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-4 pt-2.5 border-b border-zinc-800 gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('widgets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              activeTab === 'widgets'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Widgets
          </button>
          <button
            onClick={() => setActiveTab('install')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              activeTab === 'install'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Install PWA
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              activeTab === 'audio'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Audio Output
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              activeTab === 'general'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Library
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: WIDGETS */}
          {activeTab === 'widgets' && (
            <div className="space-y-4">
              {/* Widget Switcher */}
              <div className="flex items-center gap-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                <button
                  onClick={() => onChangeWidgetStyle('turntable')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
                    activeWidgetStyle === 'turntable'
                      ? 'bg-zinc-800 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Disc3 className="w-3.5 h-3.5 text-orange-400" />
                  Turntable Vinyl
                </button>
                <button
                  onClick={() => onChangeWidgetStyle('notification')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
                    activeWidgetStyle === 'notification'
                      ? 'bg-zinc-800 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-zinc-400" />
                  Audio Deck Card
                </button>
              </div>

              {/* Interactive Widget Preview Box */}
              <div className="p-4 rounded-[24px] bg-[#100f13] border border-white/5 flex flex-col items-center justify-center min-h-[250px] shadow-inner">
                {activeWidgetStyle === 'turntable' ? (
                  <PixelTurntableWidget
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onPlayPause={onPlayPause}
                    onNext={onNext}
                    onPrev={onPrev}
                    onToggleLike={onToggleLike}
                    onOpenPlayer={onOpenPlayer}
                    size="md"
                  />
                ) : (
                  <PixelNotificationWidget
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={duration}
                    onPlayPause={onPlayPause}
                    onNext={onNext}
                    onPrev={onPrev}
                    onSeek={onSeek}
                    onToggleLike={onToggleLike}
                    onOpenPlayer={onOpenPlayer}
                  />
                )}
              </div>

              {/* Primary Action Button: Add Turntable Widget to Screen */}
              <button
                onClick={handleAddTurntableToScreen}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#d3e3fd] hover:bg-[#c2e7ff] text-[#041e49] font-bold text-sm shadow-lg transition active:scale-98"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Turntable Widget to Screen</span>
                {isFloatingWidgetActive && activeWidgetStyle === 'turntable' && (
                  <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-[#041e49]/20 text-[#041e49] font-mono uppercase">
                    Active
                  </span>
                )}
              </button>

              {/* Floating Widget Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2.5">
                  <Pin className="w-4 h-4 text-[#d3e3fd]" />
                  <div>
                    <span className="text-xs font-bold text-white block">Floating Overlay</span>
                    <span className="text-[10px] text-zinc-400">
                      Keeps the widget floating over your phone screen
                    </span>
                  </div>
                </div>
                <button
                  onClick={onToggleFloatingWidget}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    isFloatingWidgetActive
                      ? 'bg-emerald-400 text-zinc-950 font-black'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {isFloatingWidgetActive ? 'ENABLED' : 'ENABLE'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: INSTALL TO PHONE */}
          {activeTab === 'install' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#1f1e24] border border-white/5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-300">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Add Vettify to Home Screen</h4>
                    <p className="text-xs text-zinc-400">Launch instantly like a native Android app</p>
                  </div>
                </div>

                {isInstalled ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 font-medium">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Vettify is installed and running in full phone mode!</span>
                  </div>
                ) : (
                  <button
                    onClick={handleNativeInstall}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold text-xs shadow-md transition active:scale-98"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install to Android Phone</span>
                  </button>
                )}
              </div>

              {/* Simple Step-by-Step for Chrome & Android */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2.5 text-xs">
                <h5 className="font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Android Instructions:
                </h5>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-300 text-[11px] leading-relaxed">
                  <li>In Google Chrome or Samsung Internet, tap the <strong>⋮ (three dots)</strong> menu in the top-right corner.</li>
                  <li>Tap <strong>&quot;Add to Home screen&quot;</strong> or <strong>&quot;Install app&quot;</strong>.</li>
                  <li>Vettify will appear on your phone home screen with full offline audio playback and lockscreen controls!</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIO & SOUND */}
          {activeTab === 'audio' && (
            <div className="space-y-4">
              {/* Equalizer Quick Button */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-4 h-4 text-violet-400" />
                  <div>
                    <span className="text-xs font-bold text-white block">10-Band Equalizer</span>
                    <span className="text-[10px] text-zinc-400">
                      Preset: {equalizer.preset.toUpperCase()} • Bass: +{equalizer.bassBoost}%
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenEq();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition"
                >
                  Adjust EQ
                </button>
              </div>

              {/* Karaoke & Lyrics Sync Timing Calibration (Moved from Platter) */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Mic2 className="w-4 h-4 text-orange-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">Lyrics Sync Timing</span>
                      <span className="text-[10px] text-zinc-400 block truncate">
                        {currentTrack ? `Track: ${currentTrack.title}` : 'No track loaded'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 shrink-0">
                    {lyricOffset >= 0 ? `+${lyricOffset.toFixed(2)}s` : `${lyricOffset.toFixed(2)}s`}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1.5 pt-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleUpdateLyricOffset((o) => o - 0.5)}
                      disabled={!currentTrack}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs font-mono transition"
                      title="Delay lyrics by -0.5s"
                    >
                      -0.5s
                    </button>
                    <button
                      onClick={() => handleUpdateLyricOffset((o) => o - 0.1)}
                      disabled={!currentTrack}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs font-mono transition"
                      title="Delay lyrics by -0.1s"
                    >
                      -0.1s
                    </button>
                  </div>

                  <button
                    onClick={() => handleUpdateLyricOffset(0)}
                    disabled={!currentTrack || lyricOffset === 0}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-xs font-semibold font-mono transition"
                    title="Reset offset to 0.0s"
                  >
                    Reset 0s
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleUpdateLyricOffset((o) => o + 0.1)}
                      disabled={!currentTrack}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs font-mono transition"
                      title="Advance lyrics by +0.1s"
                    >
                      +0.1s
                    </button>
                    <button
                      onClick={() => handleUpdateLyricOffset((o) => o + 0.5)}
                      disabled={!currentTrack}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs font-mono transition"
                      title="Advance lyrics by +0.5s"
                    >
                      +0.5s
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-400 font-mono">
                  Calibrate vocal timing if lyrics lead or lag behind the music. Auto-persisted per song in offline storage.
                </p>
              </div>

              {/* Offline Only Mode */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2.5">
                  <WifiOff className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-xs font-bold text-white block">Offline Mode</span>
                    <span className="text-[10px] text-zinc-400">
                      Play exclusively from local storage
                    </span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    onUpdatePreferences({
                      ...preferences,
                      offlineOnlyMode: !preferences.offlineOnlyMode,
                    })
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    preferences.offlineOnlyMode
                      ? 'bg-emerald-400 text-zinc-950 font-black'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {preferences.offlineOnlyMode ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Study Mode: Keep Screen Awake */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2.5">
                  <Sun className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-xs font-bold text-white block">Keep Screen Awake</span>
                    <span className="text-[10px] text-zinc-400">
                      Prevent phone screen from turning black during study sessions
                    </span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    onUpdatePreferences({
                      ...preferences,
                      keepScreenAwake: !preferences.keepScreenAwake,
                    })
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    preferences.keepScreenAwake
                      ? 'bg-amber-400 text-zinc-950 font-black'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {preferences.keepScreenAwake ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Android Background Play Protection */}
              <div className="p-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-xs">
                <div className="flex items-center gap-2 text-violet-300 font-bold mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Uninterrupted Black Screen Playback Active</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Equipped with audio keep-alive and preloading so that when your phone screen turns off or locks while studying, the next song plays automatically without pausing or needing manual screen wake-up.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: GENERAL & LIBRARY */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Studio Theme & Accessibility Toggle */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Studio Theme & Contrast</span>
                    <span className="text-[10px] text-zinc-400">
                      High-contrast Light Studio mode for daylight clarity or Dark Studio for OLED depth
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 font-semibold border border-orange-500/30">
                    {preferences.theme === 'light' ? 'Light Studio' : 'Dark Studio'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      const updated = { ...preferences, theme: 'dark-oled' as const };
                      onUpdatePreferences(updated);
                      if (typeof window !== 'undefined') localStorage.setItem('vettify_theme', 'dark-oled');
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition ${
                      preferences.theme !== 'light'
                        ? 'bg-zinc-800 border-orange-500/80 text-white shadow-[0_0_12px_rgba(249,115,22,0.2)]'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-blue-400" />
                    <div className="text-left">
                      <div className="text-xs font-bold">Dark Studio</div>
                      <div className="text-[9px] text-zinc-400 font-mono">Deep OLED black</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      const updated = { ...preferences, theme: 'light' as const };
                      onUpdatePreferences(updated);
                      if (typeof window !== 'undefined') localStorage.setItem('vettify_theme', 'light');
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition ${
                      preferences.theme === 'light'
                        ? 'bg-amber-100 border-amber-400 text-amber-950 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-500" />
                    <div className="text-left">
                      <div className="text-xs font-bold">Light Studio</div>
                      <div className="text-[9px] text-zinc-400 font-mono">High-contrast bright</div>
                    </div>
                  </button>
                </div>
              </div>
              {/* Access device audio files */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2.5">
                  <FolderOpen className="w-4 h-4 text-violet-400" />
                  <div>
                    <span className="text-xs font-bold text-white block">Device Music</span>
                    <span className="text-[10px] text-zinc-400">
                      Access MP3, FLAC, WAV, AAC from device storage
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenUpload();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition"
                >
                  Access Files
                </button>
              </div>

              {/* Cloud Sync & Backup */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2.5">
                  <Cloud className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="text-xs font-bold text-white block">Cloud Sync & Backup</span>
                    <span className="text-[10px] text-zinc-400">
                      Sync local tracks to cloud or sync library across devices
                    </span>
                  </div>
                </div>
                {onOpenCloudSync && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenCloudSync();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition"
                  >
                    Open Sync
                  </button>
                )}
              </div>

              {/* Storage Cleanup & Optimization */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <HardDrive className="w-4 h-4 text-orange-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">Storage & Duplicate Clean</span>
                      <span className="text-[10px] text-zinc-400">
                        {storageUsage ? `${(storageUsage.usedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB used • ${storageUsage.offlineTracksCount} offline tracks` : 'Calculating storage...'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleCleanStorage}
                    disabled={isCleaning}
                    className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    {isCleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>Clean Storage</span>
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  Removes duplicate backup blobs created during previous imports, instantly reclaiming disk space while keeping your music tracks intact.
                </p>
              </div>

              {/* Clear library / Reset */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-rose-400" />
                  <div>
                    <span className="text-xs font-bold text-white block">Clear Library</span>
                    <span className="text-[10px] text-zinc-400">
                      Remove all cached tracks and playlists
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Clear library and reset all cached audio?')) {
                      onClearLibrary();
                      showToast('Library cleared');
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold transition"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
