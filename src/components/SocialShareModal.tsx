import React, { useState } from 'react';
import { Playlist, Track } from '../types/music';
import { ExportService } from '../services/exportService';
import {
  Share2,
  Download,
  Copy,
  Check,
  ExternalLink,
  X,
  Sparkles,
  QrCode,
  Music2,
  FileSpreadsheet,
} from 'lucide-react';

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Playlist | null;
  tracks: Track[];
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  playlist,
  tracks,
}) => {
  const [copied, setCopied] = useState(false);
  const [shareCode] = useState(() => ExportService.generateSyncCode());

  if (!isOpen || !playlist) return null;

  const playlistTracks = playlist.trackIds
    .map((id) => tracks.find((t) => t.id === id))
    .filter((t): t is Track => Boolean(t));

  const handleShareNative = async () => {
    const success = await ExportService.sharePlaylist(playlist, playlistTracks.length);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportM3U = () => {
    ExportService.exportToM3U(playlist, tracks);
  };

  const handleExportJson = () => {
    ExportService.exportToJson(playlist, tracks);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-600 text-white shadow-md">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Share & Export Playlist</h3>
              <p className="text-xs text-zinc-400">
                Cross-platform sharing and seamless export to major streaming services
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

        {/* Visual Social Card Preview */}
        <div className="mb-5 rounded-2xl p-4 bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 relative overflow-hidden">
          <div
            className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-br ${playlist.coverGradient} opacity-20 filter blur-2xl pointer-events-none`}
          />

          <div className="flex items-center gap-3 mb-3">
            <div
              className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${playlist.coverGradient} flex items-center justify-center text-2xl shadow-lg shrink-0`}
            >
              {playlist.coverEmoji || '🎵'}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-violet-400 font-semibold block">
                Vettify Curated Collection
              </span>
              <h4 className="text-sm font-bold text-white truncate">{playlist.title}</h4>
              <p className="text-xs text-zinc-400 truncate">{playlist.description}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-800/80">
            <span>{playlistTracks.length} tracks included</span>
            <span className="font-mono text-zinc-500">Curator: {playlist.curator || 'Vettify AI'}</span>
          </div>
        </div>

        {/* Share Code & Link */}
        <div className="mb-5 bg-zinc-950/70 border border-zinc-800 rounded-2xl p-3.5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-zinc-400 font-medium">Friend Discovery Code</span>
            <span className="text-[11px] text-zinc-500">Cross-device sync ready</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 tracking-wider">
              {shareCode}
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
            <button
              onClick={handleShareNative}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition shadow-md"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
          </div>
        </div>

        {/* Streaming Platform & File Export Options */}
        <div className="space-y-2 mb-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Export to Streaming Services & Formats
          </label>

          <div className="grid grid-cols-2 gap-2">
            {/* Spotify search/export */}
            <button
              onClick={() => {
                if (playlistTracks[0]) {
                  ExportService.openSpotifySearch(playlistTracks[0].title, playlistTracks[0].artist);
                }
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 text-xs text-zinc-300 hover:text-white transition text-left"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                S
              </div>
              <div className="truncate">
                <span className="font-semibold block truncate">Spotify</span>
                <span className="text-[10px] text-zinc-500">Search & match</span>
              </div>
            </button>

            {/* Apple Music export */}
            <button
              onClick={() => {
                if (playlistTracks[0]) {
                  ExportService.openAppleMusicSearch(playlistTracks[0].title, playlistTracks[0].artist);
                }
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 text-xs text-zinc-300 hover:text-white transition text-left"
            >
              <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs">
                A
              </div>
              <div className="truncate">
                <span className="font-semibold block truncate">Apple Music</span>
                <span className="text-[10px] text-zinc-500">Search & match</span>
              </div>
            </button>

            {/* YouTube Music export */}
            <button
              onClick={() => {
                if (playlistTracks[0]) {
                  ExportService.openYouTubeMusicSearch(playlistTracks[0].title, playlistTracks[0].artist);
                }
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 text-xs text-zinc-300 hover:text-white transition text-left"
            >
              <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs">
                Y
              </div>
              <div className="truncate">
                <span className="font-semibold block truncate">YouTube Music</span>
                <span className="text-[10px] text-zinc-500">Search & match</span>
              </div>
            </button>

            {/* Download M3U */}
            <button
              onClick={handleExportM3U}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 text-xs text-zinc-300 hover:text-white transition text-left"
            >
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Download className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <span className="font-semibold block truncate">Download .M3U</span>
                <span className="text-[10px] text-zinc-500">Universal playlist</span>
              </div>
            </button>
          </div>
        </div>

        {/* JSON Backup export */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800 text-xs">
          <button
            onClick={handleExportJson}
            className="text-zinc-400 hover:text-white flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-violet-400" />
            Export Raw JSON Backup
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
