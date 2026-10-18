import React, { useState, useEffect } from 'react';
import { Track } from '../types/music';
import { Play, Pause, Heart, SkipForward, SkipBack } from 'lucide-react';
import { getHighQualityCoverUrl, fetchCoverArtForTrack, generateProceduralCover } from '../services/coverArtService';

interface PixelTurntableWidgetProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onToggleLike: (trackId: string) => void;
  onOpenPlayer?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'master';
  className?: string;
  showControls?: boolean;
  showTrackInfo?: boolean;
}

export const PixelTurntableWidget: React.FC<PixelTurntableWidgetProps> = ({
  currentTrack,
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  onToggleLike,
  onOpenPlayer,
  size = 'md',
  className = '',
  showControls = false,
  showTrackInfo = false,
}) => {
  const activeTrack = currentTrack || {
    id: 'idle',
    title: 'No Track Selected',
    artist: 'Select audio file to play',
    album: '',
    duration: 0,
    genre: 'Audio',
    mood: 'Chill' as const,
    bpm: 100,
    isLocal: false,
    isOfflineAvailable: true,
    format: 'MP3' as const,
    bitrate: '320 kbps',
    fileSize: 0,
    playCount: 0,
    liked: false,
  };

  const dimensions = {
    sm: { disc: 'w-36 h-36', center: 'w-6 h-6', spindle: 'w-2 h-2', tonearm: 'w-9 h-18 right-2 top-2' },
    md: { disc: 'w-48 h-48 sm:w-56 sm:h-56', center: 'w-8 h-8', spindle: 'w-2.5 h-2.5', tonearm: 'w-11 h-22 right-2.5 top-2' },
    lg: { disc: 'w-60 h-60 sm:w-72 sm:h-72 md:w-80 md:h-80', center: 'w-10 h-10', spindle: 'w-3 h-3', tonearm: 'w-13 h-26 sm:w-15 sm:h-30 right-3 top-2.5' },
    xl: { disc: 'w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96', center: 'w-11 h-11', spindle: 'w-3.5 h-3.5', tonearm: 'w-15 h-30 sm:w-18 sm:h-36 right-3.5 top-3' },
    master: {
      disc: 'w-60 h-60 xs:w-68 xs:h-68 sm:w-76 sm:h-76 md:w-[320px] md:h-[320px] lg:w-[360px] lg:h-[360px] xl:w-[390px] xl:h-[390px] max-w-[85vw] max-h-[85vw] aspect-square',
      center: 'w-10 h-10 sm:w-12 sm:h-12',
      spindle: 'w-3 h-3 sm:w-3.5 sm:h-3.5',
      tonearm: 'w-14 h-28 sm:w-16 sm:h-32 md:w-20 md:h-40 right-3.5 top-3',
    },
  }[size] || {
    disc: 'w-60 h-60 sm:w-72 sm:h-72',
    center: 'w-10 h-10',
    spindle: 'w-3 h-3',
    tonearm: 'w-13 h-26 right-3 top-2.5',
  };

  // Live cover art state with immediate resolution
  const [coverUrl, setCoverUrl] = useState<string>(
    activeTrack.coverUrl ? getHighQualityCoverUrl(activeTrack.coverUrl) : ''
  );

  useEffect(() => {
    let isCurrent = true;
    if (activeTrack.coverUrl) {
      setCoverUrl(getHighQualityCoverUrl(activeTrack.coverUrl));
    } else if (activeTrack.id !== 'idle') {
      fetchCoverArtForTrack(
        activeTrack.title,
        activeTrack.artist,
        activeTrack.album,
        activeTrack.genre
      ).then((fetched) => {
        if (isCurrent && fetched) {
          setCoverUrl(getHighQualityCoverUrl(fetched));
        }
      });
    }

    return () => {
      isCurrent = false;
    };
  }, [activeTrack.id, activeTrack.title, activeTrack.artist, activeTrack.album, activeTrack.coverUrl]);

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Precision Turntable Base */}
      <div className="relative p-3.5 sm:p-4 bg-[#141418] border border-zinc-800 rounded-3xl shadow-2xl">
        {/* Tonearm graphic overlay */}
        <div className={`absolute ${dimensions.tonearm} pointer-events-none z-20`}>
          <svg viewBox="0 0 50 90" className="w-full h-full opacity-90 drop-shadow-md">
            {/* Pivot base */}
            <circle cx="38" cy="14" r="8" fill="#27272a" stroke="#52525b" strokeWidth="1.5" />
            <circle cx="38" cy="14" r="3" fill="#f97316" />
            {/* Aluminum arm */}
            <path
              d={isPlaying ? "M 38 14 Q 28 45 16 75" : "M 38 14 Q 35 45 32 75"}
              stroke="#d4d4d8"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              className="transition-all duration-500"
            />
            {/* Cartridge headshell */}
            <rect
              x={isPlaying ? "11" : "28"}
              y="74"
              width="8"
              height="12"
              rx="1.5"
              fill="#18181b"
              stroke="#f97316"
              strokeWidth="1"
              transform={isPlaying ? "rotate(15 15 80)" : "rotate(0 32 80)"}
              className="transition-all duration-500"
            />
          </svg>
        </div>

        {/* Spinning Vinyl Platter - Whole Disc Picture Disc Design */}
        <div
          onClick={onOpenPlayer}
          className={`relative ${dimensions.disc} rounded-full overflow-hidden bg-[#09090b] border-[5px] border-zinc-900 shadow-2xl cursor-pointer group`}
          style={{
            boxShadow: '0 20px 45px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)',
          }}
          title="Click to expand Vinyl Master Player"
        >
          {/* Rotatable Platter Container - continuous mechanical vinyl turning */}
          <div
            className={`w-full h-full rounded-full relative overflow-hidden flex items-center justify-center turntable-platter ${
              isPlaying ? 'is-playing' : 'is-paused'
            }`}
          >
            {/* 1. Official Album Cover Art - Scaled to take up the WHOLE circular disc */}
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={`${activeTrack.title} by ${activeTrack.artist}`}
                className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none rounded-full scale-100"
                loading="eager"
                decoding="async"
                onError={(e) => {
                  const target = e.currentTarget;
                  const fallback = generateProceduralCover(
                    activeTrack.title,
                    activeTrack.artist,
                    activeTrack.genre
                  );
                  if (fallback) target.src = fallback;
                }}
              />
            ) : (
              <div className="absolute inset-0 w-full h-full rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex flex-col items-center justify-center p-4 text-center">
                <span className="text-[9px] font-mono uppercase tracking-widest text-orange-400">
                  VINYL DISK
                </span>
                <p className="text-[10px] font-semibold text-zinc-300 truncate max-w-full mt-1">
                  {activeTrack.title}
                </p>
              </div>
            )}

            {/* 2. Outer Vinyl Record Rim & Lead-in Groove Edge */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none border-[6px] border-black/50"
              style={{
                boxShadow: 'inset 0 0 14px rgba(0,0,0,0.85), inset 0 0 4px rgba(255,255,255,0.12)',
              }}
            />

            {/* 3. Concentric Micro-Grooves etched across the entire Picture Disc */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none opacity-35 mix-blend-overlay"
              style={{
                background:
                  'repeating-radial-gradient(circle at center, rgba(255,255,255,0.22) 0px, transparent 1.5px, rgba(0,0,0,0.55) 2.5px, transparent 4px)',
              }}
            />

            {/* 4. Glossy Specular Vinyl Light Reflection Sheen (gives 3D physical depth) */}
            <div
              className="absolute inset-0 rounded-full opacity-35 pointer-events-none mix-blend-screen"
              style={{
                background:
                  'conic-gradient(from 40deg at 50% 50%, rgba(255,255,255,0.4) 0deg, transparent 45deg, transparent 180deg, rgba(255,255,255,0.3) 225deg, transparent 270deg)',
              }}
            />

            {/* 5. Center Spindle Hole with metallic silver/chrome ring */}
            <div className="absolute z-10 flex items-center justify-center pointer-events-none">
              <div
                className={`${dimensions.center} rounded-full bg-zinc-950/95 border-2 border-zinc-400/80 shadow-2xl flex items-center justify-center backdrop-blur-xs`}
                style={{
                  boxShadow: '0 0 10px rgba(0,0,0,0.95), inset 0 1px 2px rgba(255,255,255,0.4)',
                }}
              >
                {/* Precision center hole cutout */}
                <div className={`${dimensions.spindle} rounded-full bg-zinc-400 shadow-inner`} />
              </div>
            </div>
          </div>
        </div>

        {/* Optional Integrated Controls Strip below platter (only when controls are enabled) */}
        {showControls && (
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-800/80">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (activeTrack.id !== 'idle') onToggleLike(activeTrack.id);
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                activeTrack.liked ? 'text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Like Track"
              aria-label="Like Track"
            >
              <Heart className="w-4 h-4 fill-current" />
            </button>

            {onPlayPause && (
              <div className="flex items-center gap-1.5">
                {onPrev && (
                  <button
                    onClick={onPrev}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition"
                    title="Previous"
                    aria-label="Previous Track"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={onPlayPause}
                  className="w-8 h-8 rounded-xl bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center transition active:scale-95 shadow-md"
                  title={isPlaying ? 'Pause' : 'Play'}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </button>

                {onNext && (
                  <button
                    onClick={onNext}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition"
                    title="Next"
                    aria-label="Next Track"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
              {activeTrack.bitrate || '320k'}
            </span>
          </div>
        )}
      </div>

      {/* Optional Track Label under Turntable (only when explicitly requested, avoids repeating title/artist) */}
      {showTrackInfo && (
        <div className="mt-2 text-center max-w-[240px]">
          <h4
            onClick={onOpenPlayer}
            className="text-sm font-semibold text-zinc-100 truncate cursor-pointer hover:text-orange-400 transition tracking-tight"
          >
            {activeTrack.title}
          </h4>
          <p className="text-xs font-medium text-orange-400/90 truncate mt-0.5">
            {activeTrack.artist}
          </p>
        </div>
      )}
    </div>
  );
};
