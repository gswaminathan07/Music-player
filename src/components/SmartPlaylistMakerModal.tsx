import React, { useState, useMemo } from 'react';
import { Track, Playlist, SmartPlaylistRequest } from '../types/music';
import { aiService } from '../services/aiService';
import {
  Sparkles,
  X,
  Play,
  Check,
  Globe,
  Radio,
  SlidersHorizontal,
  Flame,
  Music,
  Disc3,
  Loader2,
  FolderPlus,
  Compass,
  Layers,
  RefreshCw,
} from 'lucide-react';

interface SmartPlaylistMakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  libraryTracks: Track[];
  onAddPlaylists: (playlists: Playlist[]) => void;
  onPlayPlaylist: (trackIds: string[], playlistTitle?: string) => void;
}

export const SmartPlaylistMakerModal: React.FC<SmartPlaylistMakerModalProps> = ({
  isOpen,
  onClose,
  libraryTracks,
  onAddPlaylists,
  onPlayPlaylist,
}) => {
  const [mode, setMode] = useState<'auto-all' | 'by-genre' | 'international' | 'custom'>('auto-all');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [generatedPlaylists, setGeneratedPlaylists] = useState<any[]>([]);
  const [savedPlaylistIds, setSavedPlaylistIds] = useState<Set<string>>(new Set());
  const [showTrackAnalysis, setShowTrackAnalysis] = useState<boolean>(false);

  // Analyze library tracks with international metadata helper
  const analyzedTracks = useMemo(() => {
    return libraryTracks.map((t) => {
      const meta = aiService.detectInternationalSong(t);
      return {
        ...t,
        detectedLanguage: meta.language,
        detectedCulturalGenre: meta.culturalGenre,
        isInternational: meta.isInternational,
      };
    });
  }, [libraryTracks]);

  // Distinct genres from library
  const detectedGenres = useMemo(() => {
    const set = new Set<string>();
    libraryTracks.forEach((t) => {
      if (t.genre) set.add(t.genre);
    });
    return Array.from(set);
  }, [libraryTracks]);

  // Distinct languages from library
  const detectedLanguages = useMemo(() => {
    const set = new Set<string>();
    analyzedTracks.forEach((t) => {
      if (t.detectedLanguage) set.add(t.detectedLanguage);
    });
    return Array.from(set);
  }, [analyzedTracks]);

  const internationalTrackCount = useMemo(() => {
    return analyzedTracks.filter((t) => t.isInternational).length;
  }, [analyzedTracks]);

  const handleGenerate = React.useCallback(async () => {
    if (libraryTracks.length === 0) return;

    setIsLoading(true);
    const effectiveMode = customPrompt.trim() ? 'custom' : mode;

    setStatusMessage(
      effectiveMode === 'custom'
        ? 'Scanning library and building custom requested playlist...'
        : mode === 'international'
        ? 'Deep scanning international languages, scripts & cultural genres...'
        : mode === 'by-genre'
        ? 'Analyzing harmonic keys, tempos & musical genres...'
        : 'Evaluating acoustic signatures and cross-lingual aesthetics...'
    );

    try {
      const result = await aiService.makeSmartPlaylists(libraryTracks, {
        mode: effectiveMode,
        targetGenre: selectedGenre !== 'All' ? selectedGenre : undefined,
        targetLanguage: selectedLanguage !== 'All' ? selectedLanguage : undefined,
        customPrompt: customPrompt.trim() ? customPrompt.trim() : undefined,
      });

      const playlistsWithIds = (result.playlists || []).map((p, idx) => ({
        ...p,
        id: `smart-pl-${Date.now()}-${idx}`,
      }));

      setGeneratedPlaylists(playlistsWithIds);
      setSavedPlaylistIds(new Set());
      setStatusMessage('');
    } catch (err) {
      console.error(err);
      setStatusMessage('Error assembling smart playlists. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [libraryTracks, customPrompt, mode, selectedGenre, selectedLanguage]);

  // Automatically scan and generate smart playlists when modal is opened if none generated yet
  React.useEffect(() => {
    if (isOpen && libraryTracks.length > 0 && generatedPlaylists.length === 0 && !isLoading) {
      handleGenerate();
    }
  }, [isOpen, libraryTracks.length]);

  if (!isOpen) return null;

  const handleSavePlaylist = (playlist: any) => {
    const newPlaylist: Playlist = {
      id: playlist.id,
      title: playlist.title,
      description: playlist.description,
      trackIds: playlist.selectedTrackIds,
      coverGradient: playlist.coverGradient || 'from-orange-600 via-rose-700 to-zinc-950',
      coverEmoji: playlist.coverEmoji || '🎵',
      isAiGenerated: true,
      isSmartPlaylist: true,
      genreCategory: playlist.genreCategory,
      languageCategory: playlist.languageCategory,
      culturalContext: playlist.culturalContext,
      createdAt: new Date().toISOString(),
      curator: 'Vettify Smart Curator',
    };

    onAddPlaylists([newPlaylist]);
    setSavedPlaylistIds((prev) => new Set(prev).add(playlist.id));
  };

  const handleSaveAllPlaylists = () => {
    const newPlaylists: Playlist[] = generatedPlaylists.map((playlist) => ({
      id: playlist.id,
      title: playlist.title,
      description: playlist.description,
      trackIds: playlist.selectedTrackIds,
      coverGradient: playlist.coverGradient || 'from-orange-600 via-rose-700 to-zinc-950',
      coverEmoji: playlist.coverEmoji || '🎵',
      isAiGenerated: true,
      isSmartPlaylist: true,
      genreCategory: playlist.genreCategory,
      languageCategory: playlist.languageCategory,
      culturalContext: playlist.culturalContext,
      createdAt: new Date().toISOString(),
      curator: 'Vettify Smart Curator',
    }));

    onAddPlaylists(newPlaylists);
    setSavedPlaylistIds(new Set(generatedPlaylists.map((p) => p.id)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      <div className="bg-[#121216] border border-zinc-800 w-full max-w-4xl max-h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-[#16161b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Smart Playlist Maker
                </h3>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 uppercase">
                  Genre & International AI
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Analyzes your {libraryTracks.length} library songs across genres and multi-lingual cultures
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Library Telemetry Banner */}
        <div className="px-5 py-2.5 bg-[#0f0f13] border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <Disc3 className="w-3.5 h-3.5 text-orange-400" />
              <span>{libraryTracks.length} Songs</span>
            </span>
            <span className="text-zinc-600">·</span>
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <Radio className="w-3.5 h-3.5 text-orange-400" />
              <span>{detectedGenres.length} Genres Detected</span>
            </span>
            <span className="text-zinc-600">·</span>
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <Globe className="w-3.5 h-3.5 text-orange-400" />
              <span>{detectedLanguages.length} Languages ({internationalTrackCount} International)</span>
            </span>
          </div>

          <button
            onClick={() => setShowTrackAnalysis(!showTrackAnalysis)}
            className="text-[11px] font-mono text-orange-400 hover:text-orange-300 underline"
          >
            {showTrackAnalysis ? 'Hide Track Analysis ▲' : 'View Track Analysis ▼'}
          </button>
        </div>

        {/* Collapsible Track Analysis Inspector */}
        {showTrackAnalysis && (
          <div className="px-5 py-3 bg-[#18181f] border-b border-zinc-800 max-h-40 overflow-y-auto shrink-0 space-y-1.5 text-xs animate-in fade-in">
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
              Live Acoustic & International Language Tags:
            </div>
            {analyzedTracks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-[#111115] border border-zinc-800/80 text-[11px]"
              >
                <div className="min-w-0 flex-1 truncate">
                  <span className="font-semibold text-zinc-200">{t.title}</span>
                  <span className="text-zinc-500"> — {t.artist}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-[10px]">
                    {t.genre || 'Soundtrack'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                      t.isInternational
                        ? 'bg-orange-500/20 border border-orange-500/40 text-orange-300'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {t.detectedLanguage} {t.detectedCulturalGenre ? `· ${t.detectedCulturalGenre}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Mode Tabs */}
          <div>
            <label className="text-xs font-mono uppercase text-zinc-400 tracking-wider block mb-2">
              Select Curation Mode:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => setMode('auto-all')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  mode === 'auto-all'
                    ? 'bg-orange-500/10 border-orange-500 text-white shadow-sm'
                    : 'bg-[#18181e] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Layers className={`w-4 h-4 ${mode === 'auto-all' ? 'text-orange-400' : 'text-zinc-400'}`} />
                  <span className="text-[10px] font-mono uppercase text-orange-400">All-in-One</span>
                </div>
                <div className="font-semibold text-xs text-zinc-100">Smart Auto-Curate</div>
                <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">Balanced mix of all styles</div>
              </button>

              <button
                onClick={() => setMode('by-genre')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  mode === 'by-genre'
                    ? 'bg-orange-500/10 border-orange-500 text-white shadow-sm'
                    : 'bg-[#18181e] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Radio className={`w-4 h-4 ${mode === 'by-genre' ? 'text-orange-400' : 'text-zinc-400'}`} />
                  <span className="text-[10px] font-mono uppercase text-orange-400">Acoustic</span>
                </div>
                <div className="font-semibold text-xs text-zinc-100">By Genre</div>
                <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">Lo-Fi, Synthwave, Rock...</div>
              </button>

              <button
                onClick={() => setMode('international')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  mode === 'international'
                    ? 'bg-orange-500/10 border-orange-500 text-white shadow-sm'
                    : 'bg-[#18181e] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Globe className={`w-4 h-4 ${mode === 'international' ? 'text-orange-400' : 'text-zinc-400'}`} />
                  <span className="text-[10px] font-mono uppercase text-orange-400">Multi-lingual</span>
                </div>
                <div className="font-semibold text-xs text-zinc-100">International / Languages</div>
                <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">Tamil, Hindi, Korean, Spanish...</div>
              </button>

              <button
                onClick={() => setMode('custom')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  mode === 'custom'
                    ? 'bg-orange-500/10 border-orange-500 text-white shadow-sm'
                    : 'bg-[#18181e] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <SlidersHorizontal className={`w-4 h-4 ${mode === 'custom' ? 'text-orange-400' : 'text-zinc-400'}`} />
                  <span className="text-[10px] font-mono uppercase text-orange-400">Custom</span>
                </div>
                <div className="font-semibold text-xs text-zinc-100">Custom Vibe</div>
                <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">Prompted curation goal</div>
              </button>
            </div>
          </div>

          {/* Mode-Specific Filters */}
          {mode === 'by-genre' && (
            <div className="p-4 rounded-xl bg-[#16161b] border border-zinc-800 space-y-2.5">
              <div className="text-xs font-semibold text-zinc-200">
                Filter by Target Genre or Generate All:
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedGenre('All')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    selectedGenre === 'All'
                      ? 'bg-orange-600 text-white font-semibold'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  All Genres (Automatic Breakdown)
                </button>
                {detectedGenres.map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedGenre(g)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      selectedGenre === g
                        ? 'bg-orange-600 text-white font-semibold'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'international' && (
            <div className="p-4 rounded-xl bg-[#16161b] border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-200">
                  Target International Culture / Language:
                </div>
                <span className="text-[11px] font-mono text-orange-400">
                  Auto-detects native scripts & phonetics
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedLanguage('All')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    selectedLanguage === 'All'
                      ? 'bg-orange-600 text-white font-semibold'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  All Languages (Global Flow)
                </button>
                {detectedLanguages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      selectedLanguage === lang
                        ? 'bg-orange-600 text-white font-semibold'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
                {/* Popular international music cultures preset buttons */}
                {['Tamil', 'Hindi', 'Korean', 'Japanese', 'Spanish', 'Punjabi'].map(
                  (popular) =>
                    !detectedLanguages.includes(popular) && (
                      <button
                        key={popular}
                        onClick={() => setSelectedLanguage(popular)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border border-dashed transition ${
                          selectedLanguage === popular
                            ? 'bg-orange-600 text-white border-transparent'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {popular}
                      </button>
                    )
                )}
              </div>
            </div>
          )}

          {mode === 'custom' && (
            <div className="p-4 rounded-xl bg-[#16161b] border border-zinc-800 space-y-2.5">
              <label className="text-xs font-semibold text-zinc-200 block">
                Custom Playlist Curation Prompt:
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. 'Create a chill acoustic playlist with international film melodies', 'High energy workout playlist mixing English and Indian tracks'..."
                className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 h-20 resize-none"
              />
            </div>
          )}

          {/* Action Button & Status */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div>
              {statusMessage && (
                <div className="flex items-center gap-2 text-xs text-orange-400 animate-pulse font-mono">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading || libraryTracks.length === 0}
              className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing & Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Smart Playlists</span>
                </>
              )}
            </button>
          </div>

          {/* Generated Playlists Results */}
          {generatedPlaylists.length > 0 ? (
            <div className="space-y-4 pt-4 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white tracking-tight">
                    Generated Smart Playlists ({generatedPlaylists.length})
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Click to preview tracks, queue immediately, or save into your personal collections.
                  </p>
                </div>

                <button
                  onClick={handleSaveAllPlaylists}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-orange-400 transition flex items-center gap-1.5"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Save All to Collections</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedPlaylists.map((pl) => {
                  const isSaved = savedPlaylistIds.has(pl.id);
                  const trackObjects = pl.selectedTrackIds
                    .map((id: string) => libraryTracks.find((t) => t.id === id))
                    .filter(Boolean);

                  return (
                    <div
                      key={pl.id}
                      className="bg-[#16161b] border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden"
                    >
                      {/* Top Banner with Badges */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl select-none">{pl.coverEmoji || '🎵'}</span>
                            <div>
                              <h5 className="text-sm font-bold text-white tracking-tight leading-snug">
                                {pl.title}
                              </h5>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {pl.genreCategory && (
                                  <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300">
                                    {pl.genreCategory}
                                  </span>
                                )}
                                {pl.languageCategory && (
                                  <span className="px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-[10px] font-mono text-orange-300 flex items-center gap-1">
                                    <Globe className="w-2.5 h-2.5" />
                                    <span>{pl.languageCategory}</span>
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-zinc-400">
                                  {pl.selectedTrackIds.length} tracks
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed mt-2 mb-3">
                          {pl.description}
                        </p>

                        {pl.culturalContext && (
                          <div className="p-2 rounded-lg bg-[#0e0e12] border border-zinc-800/80 text-[11px] text-zinc-400 italic mb-3">
                            "{pl.culturalContext}"
                          </div>
                        )}

                        {/* Tracks Preview */}
                        <div className="space-y-1 mb-4 max-h-32 overflow-y-auto pr-1">
                          {trackObjects.map((tr: Track, idx: number) => (
                            <div
                              key={tr.id}
                              className="flex items-center justify-between text-xs p-1.5 rounded-md bg-[#121216] border border-zinc-800/60"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[10px] text-zinc-500 w-4">
                                  {idx + 1}.
                                </span>
                                <span className="font-medium text-zinc-200 truncate">
                                  {tr.title}
                                </span>
                                <span className="text-zinc-500 truncate text-[11px]">
                                  · {tr.artist}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                                {Math.floor(tr.duration / 60)}:
                                {String(Math.floor(tr.duration % 60)).padStart(2, '0')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 gap-2">
                        <button
                          onClick={() => onPlayPlaylist(pl.selectedTrackIds, pl.title)}
                          className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play Now</span>
                        </button>

                        <button
                          onClick={() => handleSavePlaylist(pl)}
                          disabled={isSaved}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                            isSaved
                              ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 cursor-default'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                          }`}
                        >
                          {isSaved ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Saved</span>
                            </>
                          ) : (
                            <>
                              <FolderPlus className="w-3.5 h-3.5" />
                              <span>Save to Collections</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-[#16161b] border border-zinc-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">No Smart Playlists Created Yet</h4>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                {libraryTracks.length > 0
                  ? `Your library has ${libraryTracks.length} song${
                      libraryTracks.length === 1 ? '' : 's'
                    }. Click below to automatically scan genres, moods, and international languages to generate smart playlists.`
                  : 'Add songs to your library first, or sync audio from your desktop to create auto playlists.'}
              </p>
              {libraryTracks.length > 0 && (
                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-md inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Scan Library & Create Playlists Now</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
