import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Track, SongLyricsData } from '../types/music';
import { lyricsService } from '../services/lyricsService';
import { audioEngine } from '../services/audioEngine';
import {
  Mic2,
  Search,
  RotateCcw,
  Globe,
  Languages,
  Maximize2,
  SkipBack,
  SkipForward,
  Loader2,
  Check,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';

interface KaraokeLyricsBarProps {
  currentTrack: Track | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (seconds: number) => void;
  onUpdateSyncOffset?: (trackId: string, offset: number) => void;
  mode?: 'docked' | 'stage';
  onToggleStage?: () => void;
  className?: string;
  isLightMode?: boolean;
}

export const KaraokeLyricsBar: React.FC<KaraokeLyricsBarProps> = ({
  currentTrack,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  onUpdateSyncOffset,
  mode = 'docked',
  onToggleStage,
  className = '',
  isLightMode = false,
}) => {
  const [lyricsData, setLyricsData] = useState<SongLyricsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [syncOffset, setSyncOffset] = useState<number>(0);
  const [isOffsetSaved, setIsOffsetSaved] = useState<boolean>(false);
  const [showRomanized, setShowRomanized] = useState<boolean>(true);
  const [showTranslation, setShowTranslation] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchingGoogle, setIsSearchingGoogle] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSyncDetails, setShowSyncDetails] = useState<boolean>(false);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load lyrics whenever currentTrack changes
  useEffect(() => {
    if (!currentTrack) {
      setLyricsData(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setSearchError(null);

    lyricsService
      .getLyricsForTrack(currentTrack)
      .then((data) => {
        if (isMounted) {
          setLyricsData(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Could not load lyrics:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentTrack?.id]);

  // Load persisted sync offset from track metadata or storage whenever currentTrack changes
  useEffect(() => {
    if (!currentTrack) {
      setSyncOffset(0);
      return;
    }

    let isMounted = true;
    lyricsService.getTrackSyncOffset(currentTrack).then((storedOffset) => {
      if (isMounted) {
        setSyncOffset(storedOffset);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentTrack?.id]);

  // Persistent sync offset updater (saves to track metadata in IndexedDB and updates memory)
  const updateAndPersistSyncOffset = useCallback(
    (newOffsetOrUpdater: number | ((prev: number) => number)) => {
      if (!currentTrack) return;

      setSyncOffset((prev) => {
        const raw =
          typeof newOffsetOrUpdater === 'function' ? newOffsetOrUpdater(prev) : newOffsetOrUpdater;
        // Clamp to realistic calibration range (-20s to +20s) and round to 2 decimals
        const clamped = Math.max(-20, Math.min(20, parseFloat(raw.toFixed(2))));

        // Persist to offline storage & memory cache for this track
        lyricsService.saveTrackSyncOffset(currentTrack.id, clamped);

        // Notify parent callback to keep app state and track metadata in sync
        if (onUpdateSyncOffset) {
          onUpdateSyncOffset(currentTrack.id, clamped);
        }

        // Show brief visual confirmation badge
        setIsOffsetSaved(true);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => {
          setIsOffsetSaved(false);
        }, 2200);

        return clamped;
      });
    },
    [currentTrack?.id, onUpdateSyncOffset]
  );

  // Arrow key listener for manual lyric sync offset calibration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentTrack) return;

      // Do NOT intercept if the user is currently typing in an input field or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      // Step size: 0.5s if Shift is held, otherwise 0.1s
      const step = e.shiftKey ? 0.5 : 0.1;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        updateAndPersistSyncOffset((prev) => prev - step);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        updateAndPersistSyncOffset((prev) => prev + step);
      } else if ((e.key === '0' || e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Quick reset to 0.0s with '0' or 'r' key
        e.preventDefault();
        updateAndPersistSyncOffset(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentTrack?.id, updateAndPersistSyncOffset]);

  const stageSweepRef = useRef<HTMLParagraphElement | null>(null);
  const dockedSweepRef = useRef<HTMLParagraphElement | null>(null);
  const [activeLineIdx, setActiveLineIdx] = useState<number>(-1);

  // 60-120 FPS high-precision continuous text wipe engine (zero lag, smoothly flowing across letters)
  useEffect(() => {
    let animId: number;

    const tick = () => {
      const preciseTime = isPlaying ? audioEngine.getPreciseTime() : currentTime;
      const info = lyricsService.getActiveLyricInfo(lyricsData, preciseTime, syncOffset);

      if (info.activeLineIndex !== activeLineIdx) {
        setActiveLineIdx(info.activeLineIndex);
      }

      // Continuous GPU-accelerated sub-pixel wipe with ZERO transition delay
      const clipVal = `inset(0 ${(1 - info.lineProgress) * 100}% 0 0)`;
      if (stageSweepRef.current) {
        stageSweepRef.current.style.clipPath = clipVal;
      }
      if (dockedSweepRef.current) {
        dockedSweepRef.current.style.clipPath = clipVal;
      }

      if (isPlaying) {
        animId = requestAnimationFrame(tick);
      }
    };

    if (isPlaying) {
      animId = requestAnimationFrame(tick);
    } else {
      tick();
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, currentTime, lyricsData, syncOffset, activeLineIdx]);

  const currentPreciseTime = isPlaying ? audioEngine.getPreciseTime() : currentTime;
  const initialInfo = lyricsService.getActiveLyricInfo(lyricsData, currentPreciseTime, syncOffset);
  const activeLine =
    activeLineIdx >= 0 && lyricsData?.lines && lyricsData.lines[activeLineIdx]
      ? lyricsData.lines[activeLineIdx]
      : initialInfo.activeLine;
  const lineProgress = initialInfo.lineProgress;
  const nextLine = initialInfo.nextLine;
  const prevLine = initialInfo.prevLine;

  // Auto-scroll to active line in stage mode
  useEffect(() => {
    if (mode === 'stage' && activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIdx, mode]);

  // Google Search manual query submission
  const handleSearchGoogle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || !currentTrack) return;

    setIsSearchingGoogle(true);
    setSearchError(null);

    try {
      const result = await lyricsService.searchGoogleLyrics(searchQuery.trim(), duration || 180);
      if (result && result.lines && result.lines.length > 0) {
        const enriched: SongLyricsData = {
          ...result,
          trackId: currentTrack.id,
          syncOffset,
        };
        setLyricsData(enriched);
        await lyricsService.saveTrackLyrics(currentTrack.id, enriched);
      } else {
        setSearchError('No Google lyrics found for that query. Try adding artist name.');
      }
    } catch {
      setSearchError('Network error searching Google lyrics. Please try again.');
    } finally {
      setIsSearchingGoogle(false);
    }
  };

  // Jump to specific line time
  const handleLineClick = (time: number) => {
    onSeek(Math.max(0, time - syncOffset));
  };

  // Jump to next or previous line
  const handleSkipToNextLine = () => {
    if (nextLine) {
      onSeek(Math.max(0, nextLine.time - syncOffset));
    }
  };

  const handleSkipToPrevLine = () => {
    if (prevLine) {
      onSeek(Math.max(0, prevLine.time - syncOffset));
    }
  };

  if (!currentTrack) return null;

  const formattedOffset = syncOffset >= 0 ? `+${syncOffset.toFixed(2)}s` : `${syncOffset.toFixed(2)}s`;

  // -------------------------------------------------------------
  // DOCKED ULTRA-SLIM BAR VIEW (For mobile platter console)
  // -------------------------------------------------------------
  if (mode === 'docked') {
    return (
      <div
        onClick={onToggleStage}
        className={`w-full rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 shadow-md transition-all select-none cursor-pointer flex items-center justify-between gap-2 shrink-0 ${
          isLightMode
            ? 'bg-white/95 border border-slate-300 hover:border-slate-400 text-slate-800'
            : 'bg-[#141419]/90 border border-zinc-800 hover:border-zinc-700 text-zinc-100'
        } ${className}`}
        title="Tap to view full synchronized lyrics"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
            isLightMode
              ? 'bg-orange-500/15 border border-orange-500/30 text-orange-600'
              : 'bg-orange-500/15 border border-orange-500/30 text-orange-400'
          }`}>
            <Mic2 className="w-3 h-3" />
          </div>
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <span className={`text-[11px] sm:text-xs font-mono flex items-center gap-1.5 truncate ${
                isLightMode ? 'text-slate-500' : 'text-zinc-400'
              }`}>
                <Loader2 className="w-3 h-3 animate-spin text-orange-500 shrink-0" />
                <span>Loading synchronized lyrics...</span>
              </span>
            ) : activeLine ? (
              <div className="relative truncate">
                <p className={`text-[11px] sm:text-xs font-semibold truncate leading-tight ${
                  isLightMode ? 'text-slate-400' : 'text-zinc-400'
                }`}>
                  {activeLine.text}
                </p>
                <p
                  ref={dockedSweepRef}
                  className={`absolute top-0 left-0 text-[11px] sm:text-xs font-semibold truncate leading-tight pointer-events-none ${
                    isLightMode
                      ? 'text-orange-600 drop-shadow-[0_0_8px_rgba(234,88,12,0.4)]'
                      : 'text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]'
                  }`}
                  style={{
                    clipPath: `inset(0 ${(1 - lineProgress) * 100}% 0 0)`,
                  }}
                >
                  {activeLine.text}
                </p>
              </div>
            ) : lyricsData?.lines && lyricsData.lines.length > 0 ? (
              <span className={`text-[11px] truncate font-mono ${
                isLightMode ? 'text-slate-500' : 'text-zinc-400'
              }`}>
                [Intro · Vocals start at {(lyricsData.lines[0].time - syncOffset).toFixed(0)}s]
              </span>
            ) : (
              <span className={`text-[11px] truncate ${
                isLightMode ? 'text-slate-500' : 'text-zinc-400'
              }`}>
                Synchronized Lyrics (Tap to view)
              </span>
            )}
          </div>
        </div>

        <div className={`flex items-center gap-1.5 shrink-0 ${
          isLightMode ? 'text-slate-500 hover:text-slate-900' : 'text-zinc-400 hover:text-white'
        }`}>
          {lyricsData?.language && (
            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border hidden xs:inline ${
              isLightMode
                ? 'bg-slate-100 text-slate-600 border-slate-300'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700/60'
            }`}>
              {lyricsData.language}
            </span>
          )}
          <Maximize2 className="w-3 h-3" />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // FULL KARAOKE STAGE VIEW (Immersive scrolling lyrics experience)
  // -------------------------------------------------------------
  return (
    <div className={`w-full h-full flex flex-col select-none overflow-hidden min-h-0 ${
      isLightMode ? 'text-slate-900' : 'text-zinc-100'
    } ${className}`}>
      {/* Clean, Streamlined Header */}
      <div className={`flex items-center justify-between pb-2 mb-2 border-b shrink-0 ${
        isLightMode ? 'border-slate-200' : 'border-zinc-800/80'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
            isLightMode
              ? 'bg-orange-500/15 border border-orange-500/30 text-orange-600'
              : 'bg-orange-500/15 border border-orange-500/30 text-orange-400'
          }`}>
            <Mic2 className="w-3 h-3" />
          </div>
          <span className={`text-xs font-bold ${isLightMode ? 'text-slate-900' : 'text-zinc-200'}`}>Live Lyrics</span>
          {lyricsData?.language && (
            <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-semibold border ${
              isLightMode
                ? 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
            }`}>
              {lyricsData.language}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setShowRomanized(!showRomanized)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
              showRomanized
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300 font-semibold'
                : isLightMode
                ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                : 'bg-zinc-850 border-zinc-750 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Toggle phonetic Romanized lyrics"
          >
            Phonetics
          </button>
          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
              showTranslation
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-300 font-semibold'
                : isLightMode
                ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                : 'bg-zinc-850 border-zinc-750 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Toggle English Translation"
          >
            Meaning
          </button>
          <button
            onClick={() => setShowSyncDetails(!showSyncDetails)}
            className={`p-1 rounded text-xs transition ${
              showSyncDetails
                ? 'bg-orange-500/20 text-orange-500'
                : isLightMode
                ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Search or Refresh Lyrics"
          >
            <Search className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Optional Compact Search Box (only shown if toggled or if no lyrics found) */}
      {(showSyncDetails || (!isLoading && (!lyricsData?.lines || lyricsData.lines.length === 0))) && (
        <form onSubmit={handleSearchGoogle} className="flex gap-1.5 mb-2 shrink-0">
          <div className="relative flex-1">
            <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${
              isLightMode ? 'text-slate-400' : 'text-zinc-400'
            }`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search lyrics for "${currentTrack.title}"...`}
              className={`w-full border rounded-lg pl-8 pr-2.5 py-1 text-xs focus:outline-none focus:border-orange-500 ${
                isLightMode
                  ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  : 'bg-[#121216] border-zinc-800 text-zinc-200 placeholder-zinc-500'
              }`}
            />
          </div>
          <button
            type="submit"
            disabled={isSearchingGoogle}
            className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1 transition shrink-0"
          >
            {isSearchingGoogle ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Search'}
          </button>
        </form>
      )}

      {searchError && (
        <div className="p-1.5 mb-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] text-center font-mono shrink-0">
          {searchError}
        </div>
      )}

      {/* Main Auto-Scrolling Lyrics Stage */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto pr-1.5 space-y-3 py-4 rounded-xl border p-3 sm:p-5 scroll-smooth custom-scrollbar min-h-0 ${
          isLightMode
            ? 'bg-slate-50/80 border-slate-200 shadow-inner'
            : 'bg-black/30 border-zinc-800/60'
        }`}
      >
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            <p className={`text-sm font-medium ${isLightMode ? 'text-slate-600' : 'text-zinc-400'}`}>
              Fetching verified lyrics directly from Google...
            </p>
            <p className={`text-xs font-mono ${isLightMode ? 'text-slate-400' : 'text-zinc-500'}`}>
              English & International synchronized library
            </p>
          </div>
        ) : lyricsData?.lines?.length ? (
          lyricsData.lines.map((line, idx) => {
            const isActive = idx === activeLineIdx;
            const isPast = idx < activeLineIdx;

            return (
              <div
                key={line.id || `line-${idx}`}
                ref={isActive ? activeLineRef : null}
                onClick={() => handleLineClick(line.time)}
                className={`group cursor-pointer rounded-2xl p-2.5 sm:p-3.5 transition-all duration-300 text-center ${
                  isActive
                    ? isLightMode
                      ? 'bg-orange-50 border border-orange-300 scale-[1.01] shadow-[0_0_20px_rgba(234,88,12,0.12)]'
                      : 'bg-orange-500/10 border border-orange-500/30 scale-[1.01] shadow-[0_0_24px_rgba(249,115,22,0.15)]'
                    : isPast
                    ? isLightMode ? 'opacity-40 hover:opacity-85 hover:bg-slate-200/50' : 'opacity-40 hover:opacity-75 hover:bg-zinc-900/40'
                    : isLightMode ? 'opacity-70 hover:opacity-100 hover:bg-slate-200/50' : 'opacity-65 hover:opacity-95 hover:bg-zinc-900/40'
                }`}
              >
                {/* Native Script Lyrics Line */}
                <div className="relative inline-block max-w-full">
                  <p
                    className={`text-base sm:text-xl font-bold tracking-tight transition-colors ${
                      isActive
                        ? isLightMode ? 'text-slate-400' : 'text-zinc-500'
                        : isLightMode ? 'text-slate-800' : 'text-zinc-300'
                    }`}
                  >
                    {line.text}
                  </p>

                  {/* Active progressive sweep highlight - 60/120 FPS continuous flow */}
                  {isActive && (
                    <p
                      ref={stageSweepRef}
                      className={`absolute top-0 left-0 right-0 text-base sm:text-xl font-bold tracking-tight overflow-hidden whitespace-normal select-none pointer-events-none ${
                        isLightMode
                          ? 'text-orange-600 drop-shadow-[0_0_16px_rgba(234,88,12,0.5)]'
                          : 'text-orange-400 drop-shadow-[0_0_16px_rgba(249,115,22,0.6)]'
                      }`}
                      style={{
                        clipPath: `inset(0 ${(1 - lineProgress) * 100}% 0 0)`,
                      }}
                    >
                      {line.text}
                    </p>
                  )}
                </div>

                {/* Romanized Phonetics (e.g., Tamil, Hindi, Korean, Japanese) */}
                {showRomanized && line.romanized && (
                  <p
                    className={`text-xs mt-0.5 font-mono tracking-wide ${
                      isActive
                        ? isLightMode ? 'text-amber-700 font-semibold' : 'text-amber-300 font-semibold'
                        : isLightMode ? 'text-slate-500' : 'text-zinc-400'
                    }`}
                  >
                    ♫ {line.romanized}
                  </p>
                )}

                {/* Translation */}
                {showTranslation && line.translation && (
                  <p
                    className={`text-xs mt-0.5 italic transition ${
                      isActive
                        ? isLightMode ? 'text-slate-700' : 'text-zinc-300'
                        : isLightMode ? 'text-slate-500' : 'text-zinc-500'
                    }`}
                  >
                    "{line.translation}"
                  </p>
                )}

                {/* Timestamp tag on hover */}
                <span className={`opacity-0 group-hover:opacity-100 transition text-[10px] font-mono mt-0.5 block ${
                  isLightMode ? 'text-slate-400' : 'text-zinc-500'
                }`}>
                  {Math.floor(line.time / 60)}:{(line.time % 60 < 10 ? '0' : '') + Math.floor(line.time % 60)} · Click to sing
                </span>
              </div>
            );
          })
        ) : (
          <div className="py-20 text-center text-zinc-400 space-y-3">
            <p className="text-base font-semibold">No synchronized lyrics loaded</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Click the search icon above to find lyrics for "{currentTrack.title}" by "{currentTrack.artist}".
            </p>
          </div>
        )}
      </div>

      {/* Stage Bottom Footer */}
      <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-500 font-mono shrink-0">
        <span>Click any line to seek</span>
        <button
          onClick={() => lyricsService.getLyricsForTrack(currentTrack, true).then(setLyricsData)}
          className="hover:text-orange-400 flex items-center gap-1 transition text-[11px]"
          title="Force refresh lyrics from Google"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reload lyrics</span>
        </button>
      </div>
    </div>
  );
};
