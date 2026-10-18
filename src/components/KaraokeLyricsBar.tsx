import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Track, SongLyricsData } from '../types/music';
import { lyricsService } from '../services/lyricsService';
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

  // Compute active line & line progress for real-time karaoke sweep
  const { activeLineIndex, activeLine, lineProgress, nextLine, prevLine, timeUntilNext } =
    lyricsService.getActiveLyricInfo(lyricsData, currentTime, syncOffset);

  // Auto-scroll to active line in stage mode
  useEffect(() => {
    if (mode === 'stage' && activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex, mode]);

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
  // DOCKED COMPACT BAR VIEW (For bottom player or within deck)
  // -------------------------------------------------------------
  if (mode === 'docked') {
    return (
      <div
        className={`w-full bg-[#121217]/95 border border-zinc-800/90 rounded-2xl p-3 sm:p-4 shadow-xl backdrop-blur-md transition-all select-none ${className}`}
      >
        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-zinc-800/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
              <Mic2 className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
            </div>
            <div className="min-w-0 flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-zinc-300">
                Karaoke Lyrics Bar
              </span>
              {lyricsData?.source === 'lrclib' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 font-medium">
                  <Globe className="w-2.5 h-2.5" />
                  <span>Synced LRC Catalog</span>
                </span>
              ) : lyricsData?.source === 'google' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0 font-medium">
                  <Globe className="w-2.5 h-2.5" />
                  <span>Found on Google</span>
                </span>
              ) : lyricsData?.source === 'id3' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0 font-medium">
                  <Mic2 className="w-2.5 h-2.5" />
                  <span>Embedded Audio ID3</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 font-medium">
                  <Search className="w-2.5 h-2.5" />
                  <span>Lyrics Search</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Sync Adjustment Buttons with Live Persistence */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-[10px] font-mono text-zinc-300 shadow-inner">
              <button
                onClick={() => updateAndPersistSyncOffset((o) => o - 0.5)}
                className="px-1.5 py-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                title="Delay lyrics by -0.5s (or Left Arrow)"
                aria-label="Delay lyrics 0.5s"
              >
                -0.5s
              </button>
              <button
                onClick={() => updateAndPersistSyncOffset((o) => o - 0.1)}
                className="px-1.5 py-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                title="Delay lyrics by -0.1s (or Left Arrow)"
                aria-label="Delay lyrics 0.1s"
              >
                -0.1s
              </button>

              <button
                onClick={() => updateAndPersistSyncOffset(0)}
                className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                  syncOffset !== 0
                    ? 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Click to reset offset to 0.0s (or '0' key)"
              >
                <span>{formattedOffset}</span>
                {isOffsetSaved && <Check className="w-2.5 h-2.5 text-emerald-400 animate-in zoom-in" />}
              </button>

              <button
                onClick={() => updateAndPersistSyncOffset((o) => o + 0.1)}
                className="px-1.5 py-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                title="Advance lyrics by +0.1s (or Right Arrow)"
                aria-label="Advance lyrics 0.1s"
              >
                +0.1s
              </button>
              <button
                onClick={() => updateAndPersistSyncOffset((o) => o + 0.5)}
                className="px-1.5 py-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                title="Advance lyrics by +0.5s (or Right Arrow)"
                aria-label="Advance lyrics 0.5s"
              >
                +0.5s
              </button>
            </div>

            {onToggleStage && (
              <button
                onClick={onToggleStage}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-orange-600 text-zinc-200 hover:text-white transition shadow-sm ml-1"
                title="Open Full Karaoke Stage"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Karaoke Stage</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Karaoke Singing Display */}
        {isLoading ? (
          <div className="py-4 flex items-center justify-center gap-2 text-xs font-mono text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
            <span>Searching LrcLib and Google for synchronized lyrics...</span>
          </div>
        ) : activeLine ? (
          <div className="space-y-1.5 cursor-pointer" onClick={onToggleStage}>
            {/* Active Line with glowing progressive karaoke sweep */}
            <div className="relative py-1">
              {/* Background Dimmed Text */}
              <p className="text-base sm:text-lg font-bold text-zinc-500 leading-snug tracking-tight">
                {activeLine.text}
              </p>

              {/* Foreground Highlighted Karaoke Sweep Layer */}
              <p
                className="absolute top-1 left-0 right-0 text-base sm:text-lg font-bold text-orange-400 leading-snug tracking-tight overflow-hidden whitespace-normal select-none pointer-events-none drop-shadow-[0_0_12px_rgba(249,115,22,0.4)]"
                style={{
                  clipPath: `inset(0 ${(1 - lineProgress) * 100}% 0 0)`,
                  transition: 'clip-path 120ms linear',
                }}
              >
                {activeLine.text}
              </p>
            </div>

            {/* Romanized Phonetics (for Tamil, Hindi, Korean, Japanese, etc.) */}
            {activeLine.romanized && (
              <p className="text-xs sm:text-sm font-medium text-amber-300/90 font-mono tracking-wide">
                ♫ {activeLine.romanized}
              </p>
            )}

            {/* English translation or meaning */}
            {activeLine.translation && (
              <p className="text-xs text-zinc-400 italic">
                "{activeLine.translation}"
              </p>
            )}

            {/* Next upcoming line ticker */}
            {nextLine && (
              <div className="pt-1.5 flex items-center gap-2 text-[11px] text-zinc-500 border-t border-zinc-800/40">
                <span className="font-mono text-zinc-600 uppercase text-[10px]">Next:</span>
                <span className="truncate text-zinc-400">{nextLine.text}</span>
                {timeUntilNext > 0 && timeUntilNext < 6 && (
                  <span className="ml-auto font-mono text-[10px] text-orange-400/80 bg-orange-500/10 px-1.5 py-0.2 rounded">
                    in {timeUntilNext.toFixed(1)}s
                  </span>
                )}
              </div>
            )}
          </div>
        ) : lyricsData?.lines && lyricsData.lines.length > 0 ? (
          <div className="py-3 text-center">
            <p className="text-sm font-medium text-zinc-400">
              [Intro instrumental · First vocal starts at {(lyricsData.lines[0].time - syncOffset).toFixed(1)}s]
            </p>
            <button
              onClick={() => onSeek(Math.max(0, lyricsData.lines[0].time - syncOffset))}
              className="mt-2 text-xs font-mono text-orange-400 hover:text-orange-300 underline"
            >
              Jump to first line ({(lyricsData.lines[0].time - syncOffset).toFixed(1)}s)
            </button>
          </div>
        ) : (
          <div className="py-2.5 px-1 space-y-2">
            <div className="text-xs text-amber-400/90 font-medium flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>No synchronized lyrics found automatically for "{currentTrack.title}"</span>
            </div>
            <form onSubmit={handleSearchGoogle} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search query (e.g. "${currentTrack.title} ${currentTrack.artist} lyrics")`}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                disabled={isSearchingGoogle || !searchQuery.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center gap-1.5 shrink-0"
              >
                {isSearchingGoogle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Search</span>
              </button>
            </form>
            {searchError && <p className="text-[11px] text-rose-400 font-mono">{searchError}</p>}
          </div>
        )}

        {/* Footer controls: quick line skipping & keyboard hint */}
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-zinc-800/40 text-xs">
          <button
            onClick={handleSkipToPrevLine}
            disabled={!prevLine}
            className="flex items-center gap-1 px-2 py-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
          >
            <SkipBack className="w-3 h-3" />
            <span className="text-[11px]">Prev Line</span>
          </button>

          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
            <span>Arrow keys [← / →] calibrate sync</span>
            {isOffsetSaved && (
              <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5" />
                <span>Saved</span>
              </span>
            )}
          </div>

          <button
            onClick={handleSkipToNextLine}
            disabled={!nextLine}
            className="flex items-center gap-1 px-2 py-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
          >
            <span className="text-[11px]">Next Line</span>
            <SkipForward className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // FULL KARAOKE STAGE VIEW (Immersive scrolling lyrics experience)
  // -------------------------------------------------------------
  return (
    <div className={`w-full max-w-2xl mx-auto flex flex-col h-full text-zinc-100 select-none ${className}`}>
      {/* Stage Toolbar */}
      <div className="p-3 sm:p-4 bg-[#141418] border border-zinc-800 rounded-2xl mb-3 shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Mic2 className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-zinc-100">Karaoke Studio</h4>
                {lyricsData?.language && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-semibold">
                    {lyricsData.language}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">
                {lyricsData?.searchCitation || 'Found directly on Google Search'}
              </p>
            </div>
          </div>

          {/* Action Pills */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setShowRomanized(!showRomanized)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                showRomanized
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-zinc-850 border-zinc-750 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Toggle phonetic Romanized lyrics for non-Latin scripts"
            >
              <span className="flex items-center gap-1">
                <Languages className="w-3 h-3" />
                <span>Phonetics</span>
              </span>
            </button>

            <button
              onClick={() => setShowTranslation(!showTranslation)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                showTranslation
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                  : 'bg-zinc-850 border-zinc-750 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Toggle English Translation"
            >
              Meaning
            </button>
          </div>
        </div>

        {/* Sync Offset Calibration Panel */}
        <div className="p-2.5 bg-zinc-900/90 border border-zinc-800 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-400 font-semibold flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-orange-400" />
              <span>Sync Offset:</span>
            </span>
            <span
              className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                syncOffset !== 0
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              {formattedOffset}
            </span>

            {isOffsetSaved && (
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 animate-in fade-in duration-200">
                <Check className="w-3 h-3" />
                <span>Saved to track</span>
              </span>
            )}
          </div>

          {/* Stepper Buttons */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => updateAndPersistSyncOffset((o) => o - 0.5)}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[11px] transition"
              title="Nudge -0.5s (Delay lyrics)"
            >
              -0.5s
            </button>
            <button
              onClick={() => updateAndPersistSyncOffset((o) => o - 0.1)}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[11px] transition"
              title="Nudge -0.1s (or Left Arrow)"
            >
              -0.1s
            </button>

            <button
              onClick={() => updateAndPersistSyncOffset(0)}
              disabled={syncOffset === 0}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 font-mono text-[11px] transition"
              title="Reset offset to 0.0s (or '0' / 'r' key)"
            >
              Reset 0s
            </button>

            <button
              onClick={() => updateAndPersistSyncOffset((o) => o + 0.1)}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[11px] transition"
              title="Nudge +0.1s (or Right Arrow)"
            >
              +0.1s
            </button>
            <button
              onClick={() => updateAndPersistSyncOffset((o) => o + 0.5)}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[11px] transition"
              title="Nudge +0.5s (Advance lyrics)"
            >
              +0.5s
            </button>
          </div>
        </div>

        {/* Helpful Keyboard calibration tooltip */}
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 px-0.5">
          <span>Pro Tip: Press [←] / [→] keys anytime (Hold Shift for 0.5s). Changes auto-persist.</span>
          <span className="text-zinc-600">Storage: IndexedDB</span>
        </div>
      </div>

      {/* Google Search Direct Finder Bar */}
      <form onSubmit={handleSearchGoogle} className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search Google lyrics (e.g. lyrics ${currentTrack.title} ${currentTrack.artist})...`}
            className="w-full bg-[#121216] border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500"
          />
        </div>
        <button
          type="submit"
          disabled={isSearchingGoogle}
          className="px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
        >
          {isSearchingGoogle ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Globe className="w-3.5 h-3.5" />
          )}
          <span>Google Search</span>
        </button>
      </form>

      {searchError && (
        <div className="p-2 mb-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-center font-mono">
          {searchError}
        </div>
      )}

      {/* Main Auto-Scrolling Lyrics Stage */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto pr-2 space-y-4 py-8 rounded-2xl bg-black/40 border border-zinc-800/80 p-4 sm:p-8 scroll-smooth"
        style={{ maxHeight: '420px' }}
      >
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
            <p className="text-sm font-medium">Fetching verified lyrics directly from Google...</p>
            <p className="text-xs text-zinc-500 font-mono">English & International synchronized library</p>
          </div>
        ) : lyricsData?.lines?.length ? (
          lyricsData.lines.map((line, idx) => {
            const isActive = idx === activeLineIndex;
            const isPast = idx < activeLineIndex;

            return (
              <div
                key={line.id || `line-${idx}`}
                ref={isActive ? activeLineRef : null}
                onClick={() => handleLineClick(line.time)}
                className={`group cursor-pointer rounded-2xl p-3 sm:p-4 transition-all duration-300 text-center ${
                  isActive
                    ? 'bg-orange-500/10 border border-orange-500/30 scale-[1.02] shadow-[0_0_24px_rgba(249,115,22,0.15)]'
                    : isPast
                    ? 'opacity-40 hover:opacity-75 hover:bg-zinc-900/40'
                    : 'opacity-65 hover:opacity-95 hover:bg-zinc-900/40'
                }`}
              >
                {/* Native Script Lyrics Line */}
                <div className="relative inline-block max-w-full">
                  <p
                    className={`text-lg sm:text-2xl font-bold tracking-tight transition-colors ${
                      isActive ? 'text-zinc-500' : 'text-zinc-300'
                    }`}
                  >
                    {line.text}
                  </p>

                  {/* Active progressive sweep highlight */}
                  {isActive && (
                    <p
                      className="absolute top-0 left-0 right-0 text-lg sm:text-2xl font-bold tracking-tight text-orange-400 overflow-hidden whitespace-normal select-none pointer-events-none drop-shadow-[0_0_16px_rgba(249,115,22,0.6)]"
                      style={{
                        clipPath: `inset(0 ${(1 - lineProgress) * 100}% 0 0)`,
                        transition: 'clip-path 120ms linear',
                      }}
                    >
                      {line.text}
                    </p>
                  )}
                </div>

                {/* Romanized Phonetics (e.g., Tamil, Hindi, Korean, Japanese) */}
                {showRomanized && line.romanized && (
                  <p
                    className={`text-xs sm:text-sm mt-1 font-mono tracking-wide ${
                      isActive ? 'text-amber-300 font-semibold' : 'text-zinc-400'
                    }`}
                  >
                    ♫ {line.romanized}
                  </p>
                )}

                {/* Translation */}
                {showTranslation && line.translation && (
                  <p
                    className={`text-xs mt-1 italic transition ${
                      isActive ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    "{line.translation}"
                  </p>
                )}

                {/* Timestamp tag on hover */}
                <span className="opacity-0 group-hover:opacity-100 transition text-[10px] font-mono text-zinc-500 mt-1 block">
                  {Math.floor(line.time / 60)}:{(line.time % 60 < 10 ? '0' : '') + Math.floor(line.time % 60)} · Click to sing from here
                </span>
              </div>
            );
          })
        ) : (
          <div className="py-20 text-center text-zinc-400 space-y-3">
            <p className="text-base font-semibold">No synchronized lyrics loaded</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Use the Google Search bar above to find lyrics for "{currentTrack.title}" by "{currentTrack.artist}".
            </p>
          </div>
        )}
      </div>

      {/* Stage Bottom Footer */}
      <div className="pt-3 flex items-center justify-between text-xs text-zinc-500 font-mono">
        <span className="flex items-center gap-1.5">
          <span>Click any line to seek</span>
          <span className="text-zinc-600">·</span>
          <span>Offset saved: <strong className="text-zinc-400">{formattedOffset}</strong></span>
        </span>
        <button
          onClick={() => lyricsService.getLyricsForTrack(currentTrack, true).then(setLyricsData)}
          className="hover:text-orange-400 flex items-center gap-1 transition"
          title="Force refresh lyrics from Google"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reload from Google</span>
        </button>
      </div>
    </div>
  );
};
