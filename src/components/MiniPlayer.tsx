import React, { useState, useEffect } from 'react';
import { Track, SongLyricsData } from '../types/music';
import { AudioVisualizer } from './AudioVisualizer';
import { lyricsService } from '../services/lyricsService';
import {
  Play,
  Pause,
  SkipForward,
  Heart,
  Sliders,
  ChevronUp,
  Mic2,
  Globe,
} from 'lucide-react';
import { getHighQualityCoverUrl } from '../services/coverArtService';

interface MiniPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  currentTime?: number;
  duration?: number;
  onPlayPause: () => void;
  onNext: () => void;
  onToggleLike: (trackId: string) => void;
  onOpenFullScreen: () => void;
  onOpenEq: () => void;
  onSeek?: (seconds: number) => void;
  isSmartShuffleActive: boolean;
  smartShuffleRationale?: string;
  isOfflineMode: boolean;
  hasBottomNav?: boolean;
  isLightMode?: boolean;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentTrack,
  isPlaying,
  progress,
  currentTime = 0,
  duration = 180,
  onPlayPause,
  onNext,
  onToggleLike,
  onOpenFullScreen,
  onOpenEq,
  onSeek,
  hasBottomNav = true,
  isLightMode = false,
}) => {
  const [lyricsData, setLyricsData] = useState<SongLyricsData | null>(null);

  useEffect(() => {
    if (!currentTrack) {
      setLyricsData(null);
      return;
    }
    lyricsService.getLyricsForTrack(currentTrack).then(setLyricsData).catch(() => {});
  }, [currentTrack?.id]);

  const { activeLine, lineProgress } = lyricsService.getActiveLyricInfo(lyricsData, currentTime);
  if (!currentTrack) return null;

  return (
    <div
      className={`fixed left-0 right-0 z-40 px-3 sm:px-6 pointer-events-none transition-all duration-200 ${
        hasBottomNav ? 'bottom-[60px] sm:bottom-0 pb-1 sm:pb-3' : 'bottom-0 pb-2'
      }`}
    >
      <div className="max-w-4xl mx-auto pointer-events-auto">
        <div className={`relative backdrop-blur-xl border rounded-2xl shadow-2xl overflow-hidden transition-colors ${
          isLightMode
            ? 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/40'
            : 'bg-[#121217]/85 border-white/10 text-zinc-100'
        }`}>
          {/* Top linear progress bar in studio amber */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-150"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>

          <div className="flex items-center justify-between p-2.5 sm:p-3 gap-3">
            {/* Track Info (Click to open full player) */}
            <div
              onClick={onOpenFullScreen}
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group select-none"
            >
              {/* Artwork Box / Platter */}
              <div className="relative w-11 h-11 rounded-lg bg-zinc-900 border border-zinc-700/60 flex items-center justify-center shrink-0 overflow-hidden">
                {currentTrack.coverUrl ? (
                  <img
                    src={getHighQualityCoverUrl(currentTrack.coverUrl)}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-[#18181b] flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full border border-zinc-600 bg-zinc-900 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    </div>
                  </div>
                )}
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <AudioVisualizer mode="minimal" height={16} isPlaying={true} />
                  </div>
                )}
              </div>

              {/* Title & Artist & Live Karaoke Line */}
              <div className="min-w-0 flex-1">
                <h4 className={`text-sm font-semibold truncate group-hover:text-orange-500 transition tracking-tight ${
                  isLightMode ? 'text-slate-900' : 'text-zinc-100'
                }`}>
                  {currentTrack.title}
                </h4>
                
                {/* Live Synced Karaoke Line Bar Ticker */}
                {activeLine ? (
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shrink-0" />
                    <span className="font-semibold text-orange-400 truncate drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">
                      {activeLine.text}
                    </span>
                    {activeLine.romanized && (
                      <span className="hidden md:inline text-[11px] text-amber-300/90 font-mono truncate">
                        ♫ {activeLine.romanized}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs truncate mt-0.5">
                    <span className="font-medium text-orange-400/90 truncate">
                      {currentTrack.artist}
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase shrink-0">
                      {currentTrack.format || 'MP3'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Hardware Controls */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Karaoke Quick Stage Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFullScreen();
                }}
                className="p-2 rounded-lg text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 transition"
                title="Karaoke Lyrics"
                aria-label="Karaoke Lyrics"
              >
                <Mic2 className="w-4 h-4 animate-pulse" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLike(currentTrack.id);
                }}
                className={`p-2 rounded-lg transition ${
                  currentTrack.liked ? 'text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Like Track"
                aria-label="Like Track"
              >
                <Heart className="w-4 h-4 fill-current" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEq();
                }}
                className="hidden sm:inline-flex p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
                title="Open Equalizer"
                aria-label="Open Equalizer"
              >
                <Sliders className="w-4 h-4" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayPause();
                }}
                className="w-9 h-9 rounded-lg bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center transition active:scale-95 shadow-sm"
                title={isPlaying ? 'Pause' : 'Play'}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNext();
                }}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
                title="Next Track"
                aria-label="Next Track"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenFullScreen}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
                title="Expand Player"
                aria-label="Expand Player"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
