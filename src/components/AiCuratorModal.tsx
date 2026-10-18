import React, { useState } from 'react';
import { Track, Playlist, SmartFolder, UserPreferences, OnlineRecommendation } from '../types/music';
import { aiService } from '../services/aiService';
import {
  Calendar,
  FolderPlus,
  Compass,
  X,
  Check,
  Plus,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface AiCuratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  libraryTracks: Track[];
  preferences: UserPreferences;
  onAddPlaylists: (playlists: Playlist[]) => void;
  onAddFolders: (folders: SmartFolder[]) => void;
  onPlayTrackById?: (id: string) => void;
}

export const AiCuratorModal: React.FC<AiCuratorModalProps> = ({
  isOpen,
  onClose,
  libraryTracks,
  preferences,
  onAddPlaylists,
  onAddFolders,
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'sort' | 'recommend'>('daily');
  const [isLoading, setIsLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [dailyResults, setDailyResults] = useState<any[]>([]);
  const [folderResults, setFolderResults] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<OnlineRecommendation[]>([]);
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen) return null;

  // 1. Generate Daily Mixes
  const handleGenerateDailyMixes = async (vibe?: string) => {
    setIsLoading(true);
    setStatusMessage('Scanning library acoustic attributes and scheduling daily mixes...');
    try {
      const res = await aiService.curateDailyPlaylists(
        libraryTracks,
        preferences,
        vibe || customPrompt || preferences.dailyVibe
      );

      const generatedPlaylists: Playlist[] = res.playlists.map((p, idx) => ({
        id: `playlist-daily-${Date.now()}-${idx}`,
        title: p.title.replace(/\s*[🌅🌆🌌✨🔥🧬☕]\s*/g, ''),
        description: p.description,
        trackIds: p.selectedTrackIds,
        coverGradient: 'from-zinc-800 to-zinc-950',
        isDailyMix: true,
        isAiGenerated: true,
        moodCategory: p.moodCategory,
        createdAt: new Date().toISOString(),
        curator: 'Vettify Studio',
        followers: Math.floor(Math.random() * 800) + 120,
      }));

      setDailyResults(generatedPlaylists);
      setStatusMessage('');
    } catch (err) {
      console.error(err);
      setStatusMessage('Error creating daily mixes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Auto-Sort library into collections
  const handleAutoSortLibrary = async () => {
    setIsLoading(true);
    setStatusMessage('Analyzing track tempo, harmonic keys, and genre patterns...');
    try {
      const res = await aiService.organizeLibrary(libraryTracks, customPrompt);

      const folders: SmartFolder[] = res.folders.map((f, idx) => ({
        id: `folder-${Date.now()}-${idx}`,
        name: f.folderName.replace(/\s*[📁☕⚡🧘🔥]\s*/g, ''),
        description: f.description,
        genreOrMood: f.genreOrMood,
        coverGradient: 'from-zinc-800 to-zinc-950',
        coverEmoji: '',
        playlistIds: [],
        trackCount: f.trackIds.length,
      }));

      const playlists: Playlist[] = res.folders.map((f, idx) => ({
        id: `playlist-folder-${Date.now()}-${idx}`,
        title: f.folderName.replace(/\s*[📁☕⚡🧘🔥]\s*/g, ''),
        description: f.description,
        trackIds: f.trackIds,
        coverGradient: 'from-zinc-800 to-zinc-950',
        isAiGenerated: true,
        moodCategory: f.genreOrMood,
        createdAt: new Date().toISOString(),
        curator: 'Studio Organizer',
      }));

      setFolderResults(folders);
      onAddFolders(folders);
      onAddPlaylists(playlists);
      setStatusMessage(`Organized ${libraryTracks.length} tracks into ${folders.length} collections.`);
    } catch (err) {
      console.error(err);
      setStatusMessage('Error organizing library.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Fetch Online Recommendations
  const handleFetchRecommendations = async () => {
    setIsLoading(true);
    setStatusMessage('Analyzing acoustic profile for online recommendations...');
    try {
      const res = await aiService.fetchOnlineRecommendations(
        libraryTracks,
        preferences,
        customPrompt || preferences.dailyVibe
      );
      setRecommendations(res.recommendations);
      setStatusMessage('');
    } catch (err) {
      console.error(err);
      setStatusMessage('Error fetching recommendations.');
    } finally {
      setIsLoading(false);
    }
  };

  const applyDailyPlaylists = () => {
    if (dailyResults.length > 0) {
      onAddPlaylists(dailyResults);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md select-none animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#141418]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
          <div>
            <h2 className="text-base font-bold text-zinc-100 tracking-tight">
              Library Mix Organizer & Discovery
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Automated acoustic categorization, day parting, and audio recommendations
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-[#0c0c0e] rounded-xl border border-zinc-800 mb-5">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition ${
              activeTab === 'daily'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Daily Mixes
          </button>
          <button
            onClick={() => setActiveTab('sort')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition ${
              activeTab === 'sort'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Organize Collections
          </button>
          <button
            onClick={() => setActiveTab('recommend')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition ${
              activeTab === 'recommend'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Discover Tracks
          </button>
        </div>

        {/* Tab 1: Daily Mixes */}
        {activeTab === 'daily' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0c0c0e] border border-zinc-800">
              <span className="text-xs font-semibold text-zinc-300 block mb-1">
                Target Listening Vibe
              </span>
              <p className="text-xs text-zinc-400 mb-3">
                Current preference: {preferences.dailyVibe} ({preferences.favoriteGenres.join(', ')})
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Specify focus (e.g., Deep Focus, Evening Unwind, Commute)..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={() => handleGenerateDailyMixes()}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium text-xs transition"
                >
                  {isLoading ? 'Generating...' : 'Create Mixes'}
                </button>
              </div>
            </div>

            {/* Daily Mix Results */}
            {dailyResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">Generated Daily Playlists</span>
                  <button
                    onClick={applyDailyPlaylists}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save All to Library
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {dailyResults.map((pl) => (
                    <div
                      key={pl.id}
                      className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-left"
                    >
                      <span className="text-[10px] font-mono text-orange-400 block mb-1">
                        {pl.moodCategory || 'MIX'}
                      </span>
                      <h4 className="text-xs font-bold text-zinc-100 truncate">{pl.title}</h4>
                      <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                        {pl.description}
                      </p>
                      <span className="text-[10px] font-mono text-zinc-500 mt-2 block">
                        {pl.trackIds.length} tracks selected
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Organize Collections */}
        {activeTab === 'sort' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0c0c0e] border border-zinc-800">
              <span className="text-xs font-semibold text-zinc-300 block mb-1">
                Automatic Smart Categorization
              </span>
              <p className="text-xs text-zinc-400 mb-3">
                Sort all {libraryTracks.length} tracks into thematic collections based on tempo, genre, and acoustic energy.
              </p>
              <button
                onClick={handleAutoSortLibrary}
                disabled={isLoading || libraryTracks.length === 0}
                className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium text-xs transition"
              >
                {isLoading ? 'Organizing...' : `Sort ${libraryTracks.length} Tracks into Collections`}
              </button>
            </div>

            {folderResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {folderResults.map((f) => (
                  <div key={f.id} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                    <h5 className="text-xs font-semibold text-zinc-200 truncate">{f.name}</h5>
                    <span className="text-[10px] font-mono text-zinc-500 mt-1 block">
                      {f.trackCount} tracks
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Discover Online */}
        {activeTab === 'recommend' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0c0c0e] border border-zinc-800">
              <span className="text-xs font-semibold text-zinc-300 block mb-1">
                Acoustic Profile Companion
              </span>
              <p className="text-xs text-zinc-400 mb-3">
                Discover songs that match the frequency and tempo profile of your local library.
              </p>
              <button
                onClick={handleFetchRecommendations}
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium text-xs transition"
              >
                {isLoading ? 'Searching...' : 'Find Compatible Songs'}
              </button>
            </div>

            {recommendations.length > 0 && (
              <div className="space-y-2">
                {recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-200 truncate">
                        {rec.title} <span className="text-zinc-500">· {rec.artist}</span>
                      </p>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {rec.genre} · {rec.matchReason}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-orange-400 shrink-0">
                      {rec.similarityScore}% match
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loading Spinner / Status */}
        {statusMessage && (
          <div className="mt-4 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-2">
            {isLoading && <Loader2 className="w-4 h-4 text-orange-400 animate-spin shrink-0" />}
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
