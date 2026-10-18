import React, { useState, useEffect } from 'react';
import { Track, TrackMood } from '../types/music';
import { AudioVisualizer } from './AudioVisualizer';
import { PixelTurntableWidget } from './PixelTurntableWidget';
import { KaraokeLyricsBar } from './KaraokeLyricsBar';
import { audioEngine } from '../services/audioEngine';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Heart,
  Sliders,
  Share2,
  Volume2,
  VolumeX,
  FileText,
  Disc,
  Info,
  ListMusic,
  Headphones,
  HardDrive,
  Activity,
  Mic2,
  Sun,
  Moon,
  Music,
} from 'lucide-react';

interface FullScreenPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleLike: (trackId: string) => void;
  onOpenEq: () => void;
  onOpenShare: (track: Track) => void;
  isSmartShuffleActive: boolean;
  onToggleSmartShuffle: () => void;
  smartShuffleRationale?: string;
  currentMood: TrackMood | 'All';
  onChangeMood: (mood: TrackMood | 'All') => void;
  queue: Track[];
  onSelectQueueTrack: (track: Track) => void;
  repeatMode: 'off' | 'all' | 'one';
  onToggleRepeat: () => void;
  onToggleOfflineCache: (trackId: string) => void;
  onUpdateSyncOffset?: (trackId: string, offset: number) => void;
  isLightMode?: boolean;
  onToggleTheme?: () => void;
}

// Studio Analog VU Meter Dial Component with mechanical ballistic needle
const AnalogVUMeterDial: React.FC<{ label: string; level: number; isPlaying: boolean }> = ({
  label,
  level,
  isPlaying,
}) => {
  // Map level (0.0 to 1.0) to deflection angle (-46deg to +46deg)
  const angle = isPlaying ? -46 + Math.min(1.15, level * 1.35) * 80 : -46;
  const isClipping = isPlaying && level > 0.88;

  return (
    <div className="flex-1 bg-gradient-to-b from-[#22201d] to-[#12110f] p-2 sm:p-2.5 rounded-2xl border border-amber-950/40 shadow-xl relative overflow-hidden">
      {/* Dial Face (Vintage studio illuminated parchment) */}
      <div className="w-full h-24 sm:h-28 rounded-xl bg-gradient-to-b from-[#fef3c7] via-[#fde68a] to-[#d97706]/20 border border-amber-300/40 relative overflow-hidden shadow-inner flex flex-col justify-between p-1.5 select-none">
        {/* Glass glare highlight */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none" />

        {/* Top Channel Header & Peak Clip Warning LED */}
        <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono font-bold text-zinc-800 z-10 px-1">
          <span className="tracking-wider">{label}</span>
          <div className="flex items-center gap-1">
            <span className="text-[7px] sm:text-[8px] text-zinc-600 font-semibold uppercase">PEAK</span>
            <span
              className={`w-2 h-2 rounded-full border border-black/40 transition-colors duration-75 ${
                isClipping ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]' : 'bg-red-950'
              }`}
            />
          </div>
        </div>

        {/* Precision Curved Scale & Ballistic Needle */}
        <div className="w-full h-16 sm:h-18 relative z-10 flex items-center justify-center">
          <svg viewBox="0 0 160 85" className="w-full h-full overflow-visible">
            {/* Safe arc */}
            <path
              d="M 18 72 A 72 72 0 0 1 108 24"
              fill="none"
              stroke="#27272a"
              strokeWidth="1.5"
            />
            {/* Red Hazard / Overload arc (0dB to +3dB) */}
            <path
              d="M 108 24 A 72 72 0 0 1 142 72"
              fill="none"
              stroke="#dc2626"
              strokeWidth="2.5"
            />

            {/* Scale Numerals */}
            <text x="20" y="75" fontSize="7" fontFamily="monospace" fill="#27272a" fontWeight="bold">-20</text>
            <text x="36" y="55" fontSize="7" fontFamily="monospace" fill="#27272a" fontWeight="bold">-10</text>
            <text x="56" y="40" fontSize="7" fontFamily="monospace" fill="#27272a" fontWeight="bold">-7</text>
            <text x="78" y="32" fontSize="7" fontFamily="monospace" fill="#27272a" fontWeight="bold">-3</text>
            <text x="105" y="30" fontSize="8" fontFamily="monospace" fill="#18181b" fontWeight="black">0</text>
            <text x="122" y="37" fontSize="7" fontFamily="monospace" fill="#dc2626" fontWeight="bold">+1</text>
            <text x="135" y="52" fontSize="7" fontFamily="monospace" fill="#dc2626" fontWeight="bold">+3</text>

            <text x="80" y="55" fontSize="8" fontFamily="monospace" fill="#78350f" fontWeight="bold" textAnchor="middle">VU</text>

            {/* Rotating Analog Needle with Counterweight and Orange Tip */}
            <g transform="translate(80, 80)">
              <g
                style={{
                  transform: `rotate(${angle}deg)`,
                  transition: 'transform 85ms cubic-bezier(0.12, 0.9, 0.25, 1)',
                  transformOrigin: '0px 0px',
                }}
              >
                <line x1="0" y1="0" x2="0" y2="-72" stroke="rgba(0,0,0,0.3)" strokeWidth="2.5" transform="translate(1, 1)" />
                <line x1="0" y1="0" x2="0" y2="-72" stroke="#18181b" strokeWidth="1.5" />
                <line x1="0" y1="-54" x2="0" y2="-72" stroke="#f97316" strokeWidth="2.2" />
              </g>
              <circle cx="0" cy="0" r="5" fill="#18181b" stroke="#71717a" strokeWidth="1" />
              <circle cx="0" cy="0" r="2" fill="#f97316" />
            </g>
          </svg>
        </div>

        {/* Modulation Level Footer */}
        <div className="flex justify-between items-center text-[8px] font-mono text-zinc-700 px-1 z-10">
          <span>0-100% MOD</span>
          <span>{isPlaying ? `${Math.round(level * 100)}%` : 'MUTED'}</span>
        </div>
      </div>
    </div>
  );
};

export const FullScreenPlayer: React.FC<FullScreenPlayerProps> = ({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onPrev,
  onNext,
  onToggleLike,
  onOpenEq,
  onOpenShare,
  isSmartShuffleActive,
  onToggleSmartShuffle,
  queue,
  onSelectQueueTrack,
  repeatMode,
  onToggleRepeat,
  onUpdateSyncOffset,
  isLightMode = false,
  onToggleTheme,
}) => {
  const [activeTab, setActiveTab] = useState<'deck' | 'meter' | 'lyrics' | 'specs' | 'queue'>('deck');
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);

  // Live dynamic acoustic telemetry polled directly from AudioEngine - 60-120 FPS native loop
  const [meterMetrics, setMeterMetrics] = useState({
    formattedDb: '-∞ dB',
    peakDb: -Infinity,
    leftLevel: 0,
    rightLevel: 0,
  });

  useEffect(() => {
    if (!isPlaying) {
      setMeterMetrics({ formattedDb: '-∞ dB', peakDb: -Infinity, leftLevel: 0, rightLevel: 0 });
      return;
    }
    let animId: number;
    const updateLoop = () => {
      // Native frame rate loop (60-120 FPS) for buttery smooth analog peak meter telemetry
      setMeterMetrics(audioEngine.getPeakLevelDb());
      animId = requestAnimationFrame(updateLoop);
    };
    animId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  if (!isOpen || !currentTrack) return null;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col overflow-hidden select-none ${
      isLightMode ? 'bg-[#f8fafc] text-slate-900' : 'bg-[#0c0c0e] text-zinc-100'
    }`}>
      {/* Ultra-Slim Top Console Bar - Minimized, No redundant song title */}
      <div className={`flex items-center justify-between px-3 sm:px-6 py-1.5 sm:py-2 border-b shrink-0 h-11 ${
        isLightMode ? 'border-slate-200 bg-white' : 'border-zinc-800 bg-[#121216]'
      }`}>
        <button
          onClick={onClose}
          className={`p-1.5 rounded-lg transition ${
            isLightMode
              ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
          aria-label="Minimize Player"
          title="Minimize Console"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        {/* Minimalist Studio Status Indicator */}
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-orange-500 animate-pulse' : 'bg-zinc-400 dark:bg-zinc-600'}`} />
          <span className={`text-[10px] sm:text-xs font-mono font-semibold tracking-wider uppercase ${
            isLightMode ? 'text-slate-600' : 'text-zinc-400'
          }`}>
            MASTER CONSOLE · 33⅓ RPM
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={`p-1.5 rounded-lg transition ${
                isLightMode
                  ? 'text-amber-700 hover:bg-amber-100'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title={isLightMode ? 'Switch to Dark Studio' : 'Switch to High-Contrast Light Studio'}
              aria-label="Toggle Theme"
            >
              {isLightMode ? <Sun className="w-4 h-4 text-amber-600" /> : <Moon className="w-4 h-4 text-blue-300" />}
            </button>
          )}
          <button
            onClick={onOpenEq}
            className={`p-1.5 rounded-lg transition ${
              isLightMode
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Equalizer"
            aria-label="Equalizer"
          >
            <Sliders className="w-4 h-4" />
          </button>
          <button
            onClick={() => onOpenShare(currentTrack)}
            className={`p-1.5 rounded-lg transition ${
              isLightMode
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Share Track"
            aria-label="Share Track"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Segmented View Switcher: Mobile-Only compact selector (Hidden on desktop where all 3 columns are visible) */}
      <div className="flex lg:hidden justify-center px-2 py-1 border-b border-zinc-800/80 bg-[#0f0f13] shrink-0">
        <div className="w-full max-w-sm grid grid-cols-4 p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-center gap-0.5">
          <button
            onClick={() => setActiveTab('deck')}
            className={`py-1 px-1 rounded-md text-[11px] font-medium transition truncate ${
              activeTab === 'deck'
                ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Platter
          </button>
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`py-1 px-1 rounded-md text-[11px] font-medium transition truncate flex items-center justify-center gap-1 ${
              activeTab === 'lyrics'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30 shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-orange-400'
            }`}
          >
            <Mic2 className="w-3 h-3 text-orange-400" />
            <span>Lyrics</span>
          </button>
          <button
            onClick={() => setActiveTab('meter')}
            className={`py-1 px-1 rounded-md text-[11px] font-medium transition truncate ${
              activeTab === 'meter'
                ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            VU Meter
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`py-1 px-1 rounded-md text-[11px] font-medium transition truncate ${
              activeTab === 'queue'
                ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Queue ({queue.length})
          </button>
        </div>
      </div>

      {/* Main Body Stage */}
      <div className="flex-1 flex flex-col items-center justify-between p-2 sm:p-3 overflow-hidden min-h-0">
        {activeTab === 'deck' && (
          <div className="w-full h-full flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-5 items-stretch justify-between max-w-7xl mx-auto py-0.5">
            {/* Desktop Left Column (col-span-4 / 33%): Pure Live Karaoke & Lyrics */}
            <div className={`hidden lg:flex lg:col-span-4 h-full flex-col border rounded-2xl p-3 shadow-xl overflow-hidden min-h-0 ${
              isLightMode ? 'bg-white border-slate-200 shadow-md text-slate-900' : 'bg-[#141418] border-zinc-800 text-zinc-100'
            }`}>
              <div className="flex-1 min-h-0 overflow-hidden">
                <KaraokeLyricsBar
                  currentTrack={currentTrack}
                  currentTime={currentTime}
                  duration={duration}
                  isPlaying={isPlaying}
                  onSeek={onSeek}
                  onUpdateSyncOffset={onUpdateSyncOffset}
                  mode="stage"
                  isLightMode={isLightMode}
                />
              </div>
            </div>

            {/* Center Column (lg:col-span-4): Turntable Platter & 60 FPS Peak Level Analyzer */}
            <div className="w-full max-w-md lg:max-w-none lg:col-span-4 flex flex-col items-center justify-between mx-auto flex-1 min-h-0 space-y-1 sm:space-y-2 py-0.5">
              <div className="flex-1 flex items-center justify-center min-h-0 w-full overflow-hidden">
                <PixelTurntableWidget
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onToggleLike={onToggleLike}
                  size="master"
                  showControls={false}
                />
              </div>

              {/* Precision Real-time Peak Level Analyzer (VU & Spectrum Bars) - 60 FPS */}
              <div className={`w-full border p-1.5 sm:p-2.5 rounded-xl shadow-lg shrink-0 ${
                isLightMode ? 'bg-white border-slate-200' : 'bg-[#141418] border-zinc-800'
              }`}>
                <div className={`w-full flex items-center justify-between pb-1 border-b mb-1 ${
                  isLightMode ? 'border-slate-200' : 'border-zinc-800/80'
                }`}>
                  <span className={`text-[10px] sm:text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5 ${
                    isLightMode ? 'text-slate-600' : 'text-zinc-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-orange-500 animate-pulse' : 'bg-zinc-400'}`} />
                    Peak Level Analyzer · VU
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold text-orange-500">
                    {isPlaying ? meterMetrics.formattedDb : '-∞ dB'}
                  </span>
                </div>
                <AudioVisualizer mode="bars" height={22} isPlaying={isPlaying} className="w-full" />
                <div className={`w-full flex justify-between text-[8px] sm:text-[9px] font-mono mt-0.5 px-0.5 ${
                  isLightMode ? 'text-slate-500' : 'text-zinc-500'
                }`}>
                  <span>32Hz</span>
                  <span>250Hz</span>
                  <span>1kHz</span>
                  <span>4kHz</span>
                  <span>16kHz</span>
                </div>
              </div>

              {/* Mobile-Only: Docked lyrics bar (on desktop it is shown fully in the left column) */}
              <div className="w-full shrink-0 lg:hidden">
                <KaraokeLyricsBar
                  currentTrack={currentTrack}
                  currentTime={currentTime}
                  duration={duration}
                  isPlaying={isPlaying}
                  onSeek={onSeek}
                  onUpdateSyncOffset={onUpdateSyncOffset}
                  mode="docked"
                  onToggleStage={() => setActiveTab('lyrics')}
                  isLightMode={isLightMode}
                />
              </div>
            </div>

            {/* Desktop Right Column (col-span-4 / 33%): Playback Queue (Up Next) */}
            <div className={`hidden lg:flex lg:col-span-4 h-full flex-col border rounded-2xl p-3.5 shadow-xl overflow-hidden min-h-0 ${
              isLightMode ? 'bg-white border-slate-200 text-slate-900 shadow-md' : 'bg-[#141418] border-zinc-800 text-zinc-100'
            }`}>
              <div className={`flex items-center justify-between pb-2.5 border-b shrink-0 mb-2 ${
                isLightMode ? 'border-slate-200' : 'border-zinc-800'
              }`}>
                <span className={`text-xs font-semibold flex items-center gap-1.5 ${
                  isLightMode ? 'text-slate-900' : 'text-zinc-200'
                }`}>
                  <ListMusic className="w-3.5 h-3.5 text-orange-500" />
                  Playback Queue
                </span>
                <span className={`text-[10px] font-mono ${isLightMode ? 'text-slate-500' : 'text-zinc-500'}`}>
                  {queue.length} tracks
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {queue.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => onSelectQueueTrack(track)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition ${
                      currentTrack.id === track.id
                        ? isLightMode
                          ? 'bg-orange-50 border border-orange-300 text-orange-600'
                          : 'bg-orange-500/15 border border-orange-500/30 text-orange-400'
                        : isLightMode
                        ? 'hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-transparent'
                        : 'hover:bg-zinc-800/80 text-zinc-300 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                        isLightMode ? 'bg-slate-100 text-slate-600' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {currentTrack.id === track.id ? (
                          <span className="text-orange-500 text-xs font-bold">▶</span>
                        ) : (
                          <Music className={`w-3 h-3 ${isLightMode ? 'text-slate-400' : 'text-zinc-500'}`} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold truncate ${
                          currentTrack.id === track.id
                            ? 'text-orange-500 font-bold'
                            : isLightMode ? 'text-slate-900' : 'text-zinc-100'
                        }`}>
                          {track.title}
                        </p>
                        <p className={`text-[10px] font-medium truncate ${
                          isLightMode ? 'text-slate-500' : 'text-zinc-400'
                        }`}>
                          {track.artist}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-mono shrink-0 ml-2 ${
                      isLightMode ? 'text-slate-500' : 'text-zinc-500'
                    }`}>
                      {formatTime(track.duration)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Full Karaoke Stage View */}
        {activeTab === 'lyrics' && (
          <div className="w-full max-w-xl h-full flex flex-col justify-center py-2">
            <KaraokeLyricsBar
              currentTrack={currentTrack}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onSeek={onSeek}
              onUpdateSyncOffset={onUpdateSyncOffset}
              mode="stage"
              onToggleStage={() => setActiveTab('deck')}
              isLightMode={isLightMode}
            />
          </div>
        )}

        {/* Authentic Dual Analog VU Meter Tab with Left/Right Ballistics */}
        {activeTab === 'meter' && (
          <div className="w-full max-w-md bg-[#141418] border border-zinc-800 p-4 sm:p-5 rounded-2xl flex flex-col items-center space-y-4">
            <div className="w-full flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs font-mono text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-orange-400" />
                Analog Master VU Console
              </span>
              <span className="text-xs font-mono font-bold text-orange-400">
                {isPlaying ? meterMetrics.formattedDb : '-∞ dB'}
              </span>
            </div>

            {/* Dual Analog Illuminated Dials */}
            <div className="w-full flex items-center gap-2.5 sm:gap-3">
              <AnalogVUMeterDial label="CH 1 · LEFT" level={meterMetrics.leftLevel} isPlaying={isPlaying} />
              <AnalogVUMeterDial label="CH 2 · RIGHT" level={meterMetrics.rightLevel} isPlaying={isPlaying} />
            </div>

            {/* Studio High-Definition Spectrum Analyzer */}
            <div className="w-full bg-black/40 border border-zinc-800/80 rounded-xl p-3">
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1">
                <span>42-BAND LOGARITHMIC SPECTRUM</span>
                <span className="text-orange-400">20Hz - 20kHz</span>
              </div>
              <AudioVisualizer mode="bars" height={52} isPlaying={isPlaying} className="w-full" />
              <div className="w-full flex justify-between text-[9px] font-mono text-zinc-500 mt-1">
                <span>Sub</span>
                <span>Bass</span>
                <span>Low Mid</span>
                <span>Mid</span>
                <span>High Mid</span>
                <span>Presence</span>
                <span>Brilliance</span>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Acoustic Specs Telemetry */}
        {activeTab === 'specs' && (
          <div className="w-full max-w-md bg-[#141418] border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
              <h4 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-400" />
                <span>Real-Time Acoustic Telemetry</span>
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                {isPlaying ? 'ACTIVE DECODING' : 'IDLE'}
              </span>
            </div>

            {/* Dynamic Signal Levels */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-black/40 border border-zinc-800 rounded-xl">
                <span className="text-[10px] text-zinc-500 block uppercase font-mono">Peak Signal Level</span>
                <span className="text-sm font-mono font-bold text-orange-400">{meterMetrics.formattedDb}</span>
              </div>
              <div className="p-2.5 bg-black/40 border border-zinc-800 rounded-xl">
                <span className="text-[10px] text-zinc-500 block uppercase font-mono">Stereo Modulation</span>
                <span className="text-sm font-mono font-bold text-zinc-200">
                  {isPlaying
                    ? `${Math.round(meterMetrics.leftLevel * 100)}% L · ${Math.round(meterMetrics.rightLevel * 100)}% R`
                    : '0% L · 0% R'}
                </span>
              </div>
            </div>

            {/* Static & Decoded Specs */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-400">Audio Codec / Container</span>
                <span className="font-mono text-zinc-200 font-semibold">{currentTrack.format || 'MP3'} Audio</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-400">Encoding Bitrate</span>
                <span className="font-mono text-zinc-200">{currentTrack.bitrate || '320 kbps'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-400">Studio Sample Rate</span>
                <span className="font-mono text-zinc-200">44.1 kHz / 16-Bit Stereo</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-400">Duration</span>
                <span className="font-mono text-zinc-200">{formatTime(duration)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-400">Genre & Harmonic Mood</span>
                <span className="text-zinc-200">{currentTrack.genre} · {currentTrack.mood || 'Chill'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-zinc-400">Playback Cache</span>
                <span className="font-mono text-emerald-400">Active High-Speed Memory</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="w-full max-w-lg bg-[#141418] border border-zinc-800 rounded-2xl p-4 max-h-[420px] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-2">
              <span className="text-xs font-semibold text-zinc-300">Playback Queue</span>
              <span className="text-[11px] font-mono text-zinc-500">{queue.length} tracks</span>
            </div>
            <div className="space-y-1">
              {queue.map((track) => (
                <div
                  key={track.id}
                  onClick={() => onSelectQueueTrack(track)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                    currentTrack.id === track.id
                      ? 'bg-zinc-800 text-orange-400'
                      : 'hover:bg-zinc-850 text-zinc-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-6 h-6 rounded-md bg-zinc-850 border border-zinc-750 flex items-center justify-center shrink-0 text-zinc-400">
                      {currentTrack.id === track.id ? (
                        <span className="text-orange-400 text-xs font-bold">▶</span>
                      ) : (
                        <Music className="w-3 h-3 text-zinc-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold truncate ${currentTrack.id === track.id ? 'text-orange-400' : 'text-zinc-100'}`}>
                        {track.title}
                      </p>
                      <p className="text-[11px] font-medium text-orange-400/90 truncate">
                        {track.artist}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500 shrink-0 ml-2">
                    {formatTime(track.duration)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Transport Console */}
      <div className={`p-2.5 sm:p-4 border-t shrink-0 ${
        isLightMode ? 'bg-white border-slate-200 shadow-lg' : 'bg-[#121216] border-zinc-800'
      }`}>
        <div className="max-w-2xl mx-auto space-y-2 sm:space-y-3">
          {/* Now Playing Title & Artist with Like Toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h4 className={`text-sm sm:text-base font-bold truncate tracking-tight ${
                isLightMode ? 'text-slate-900' : 'text-zinc-100'
              }`}>
                {currentTrack.title}
              </h4>
              <p className={`text-[11px] sm:text-xs font-semibold truncate mt-0.5 ${
                isLightMode ? 'text-orange-600' : 'text-orange-400/90'
              }`}>
                {currentTrack.artist} {currentTrack.album ? `· ${currentTrack.album}` : ''}
              </p>
            </div>
            <button
              onClick={() => onToggleLike(currentTrack.id)}
              className={`p-1.5 sm:p-2 rounded-xl transition ${
                currentTrack.liked
                  ? isLightMode
                    ? 'text-orange-600 bg-orange-50'
                    : 'text-orange-500 bg-orange-500/10'
                  : isLightMode
                  ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
              title="Like Track"
              aria-label="Like Track"
            >
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </button>
          </div>

          {/* Scrubber Bar */}
          <div className="space-y-1">
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                onSeek(pos * duration);
              }}
              className={`relative h-1.5 sm:h-2 rounded-full cursor-pointer transition-colors overflow-hidden ${
                isLightMode ? 'bg-slate-200 hover:bg-slate-300' : 'bg-zinc-800 hover:bg-zinc-700/80'
              }`}
            >
              <div
                className="h-full bg-orange-500 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
            <div className={`flex justify-between text-[10px] sm:text-xs font-mono tabular-nums ${
              isLightMode ? 'text-slate-500' : 'text-zinc-400'
            }`}>
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Primary Transport Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={onToggleSmartShuffle}
              className={`p-2 rounded-lg transition ${
                isSmartShuffleActive
                  ? isLightMode ? 'text-orange-600 bg-orange-50' : 'text-orange-400 bg-orange-500/10'
                  : isLightMode ? 'text-slate-400 hover:text-slate-700' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Shuffle Queue"
              aria-label="Shuffle Queue"
            >
              <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <div className="flex items-center gap-3 sm:gap-5">
              <button
                onClick={onPrev}
                className={`p-2 rounded-lg transition active:scale-95 ${
                  isLightMode
                    ? 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
                title="Previous Track"
                aria-label="Previous Track"
              >
                <SkipBack className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              <button
                onClick={onPlayPause}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center transition active:scale-95 shadow-lg shadow-orange-600/25"
                title={isPlaying ? 'Pause' : 'Play'}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
                ) : (
                  <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={onNext}
                className={`p-2.5 rounded-lg transition active:scale-95 ${
                  isLightMode
                    ? 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
                title="Next Track"
                aria-label="Next Track"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </div>

            <button
              onClick={onToggleRepeat}
              className={`p-2.5 rounded-lg transition ${
                repeatMode !== 'off'
                  ? isLightMode ? 'text-orange-600 bg-orange-50' : 'text-orange-400 bg-orange-500/10'
                  : isLightMode ? 'text-slate-400 hover:text-slate-700' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={`Repeat: ${repeatMode}`}
              aria-label={`Repeat: ${repeatMode}`}
            >
              <Repeat className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
