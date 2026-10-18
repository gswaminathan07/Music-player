import React, { useState } from 'react';
import { Track } from '../types/music';
import { SquigglyProgress } from './SquigglyProgress';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  ThumbsUp,
  Headphones,
  Smartphone,
  Radio,
  Shuffle,
  Volume2,
} from 'lucide-react';

interface PixelNotificationWidgetProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onToggleLike: (trackId: string) => void;
  onOpenPlayer?: () => void;
  className?: string;
}

export const PixelNotificationWidget: React.FC<PixelNotificationWidgetProps> = ({
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
  className = '',
}) => {
  const [deviceOutput, setDeviceOutput] = useState<string>("Ganesh's Pixel Buds");
  const [isOutputMenuOpen, setIsOutputMenuOpen] = useState(false);

  if (!currentTrack) return null;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const devices = [
    { name: "Ganesh's Pixel Buds", icon: Headphones },
    { name: 'Phone Speaker', icon: Smartphone },
    { name: 'Living Room Cast', icon: Radio },
  ];

  return (
    <div
      className={`relative w-full max-w-md rounded-[28px] overflow-hidden p-5 shadow-2xl transition-all select-none border border-white/5 ${className}`}
      style={{
        backgroundColor: '#1f1a1d', // Material You warm tonal surface matching Image 2
      }}
    >
      {/* Background artwork subtle ambient tint */}
      <div
        className={`absolute inset-0 opacity-15 filter blur-2xl pointer-events-none bg-gradient-to-tr ${
          currentTrack.coverGradient || 'from-rose-900 to-indigo-950'
        }`}
      />

      {/* Top Row: Track Meta & Device Output Pill (Image 2 style) */}
      <div className="relative z-10 flex items-start justify-between gap-3 mb-2">
        {/* Track Title & Artist (Left) */}
        <div
          onClick={onOpenPlayer}
          className="min-w-0 flex-1 cursor-pointer group"
        >
          <h3 className="text-lg font-bold text-white tracking-tight truncate group-hover:underline">
            {currentTrack.title}
          </h3>
          <p className="text-xs text-[#d8c2c8] truncate mt-0.5 font-medium">
            {currentTrack.artist}
          </p>
        </div>

        {/* Device Output Pill (Top Right, matching image 2: 🎧 Ganesh...) */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsOutputMenuOpen(!isOutputMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#ffd8e4] text-[#31111d] hover:bg-[#ffcddb] transition shadow-sm"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span className="truncate max-w-[130px]">{deviceOutput}</span>
          </button>

          {/* Quick Output Switcher Dropdown */}
          {isOutputMenuOpen && (
            <div className="absolute right-0 top-9 z-30 w-48 bg-[#2d252a] rounded-2xl border border-white/10 p-1.5 shadow-xl animate-fade-in text-xs">
              {devices.map((d) => (
                <button
                  key={d.name}
                  onClick={() => {
                    setDeviceOutput(d.name);
                    setIsOutputMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition ${
                    deviceOutput === d.name
                      ? 'bg-[#ffd8e4] text-[#31111d] font-bold'
                      : 'text-[#e5d4da] hover:bg-white/5'
                  }`}
                >
                  <d.icon className="w-3.5 h-3.5" />
                  <span className="truncate">{d.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center: Track Artwork Thumbnail if available */}
      <div className="relative z-10 flex items-center gap-3 my-2">
        <div
          onClick={onOpenPlayer}
          className={`w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-md cursor-pointer bg-gradient-to-tr ${
            currentTrack.coverGradient || 'from-violet-600 to-indigo-800'
          } flex items-center justify-center`}
        >
          {currentTrack.coverUrl ? (
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xl">🎵</span>
          )}
        </div>
        <div className="text-[11px] text-[#c9b7be] font-mono">
          <span>{currentTrack.album || 'Current Queue'}</span>
          <span className="block text-[#a09096] uppercase text-[10px]">
            {currentTrack.format || 'FLAC'} • {currentTrack.mood}
          </span>
        </div>
      </div>

      {/* Android 13/14 Authentic Squiggly Progress Seekbar (Image 2 style) */}
      <div className="relative z-10 mt-1">
        <SquigglyProgress
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          onSeek={onSeek}
          waveColor="#ffffff"
          railColor="rgba(255, 255, 255, 0.22)"
          thumbColor="#ffffff"
        />

        {/* Time stamps */}
        <div className="flex justify-between items-center text-[11px] font-mono text-[#a09096] -mt-1 px-0.5">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Bottom Transport Controls (Image 2 style) */}
      <div className="relative z-10 flex items-center justify-between mt-3 pt-2">
        {/* Like / Thumbs Up Button */}
        <button
          onClick={() => onToggleLike(currentTrack.id)}
          className={`p-2.5 rounded-full transition ${
            currentTrack.liked
              ? 'text-[#ffd8e4] bg-[#ffd8e4]/20'
              : 'text-[#e5d4da] hover:text-white hover:bg-white/5'
          }`}
          title={currentTrack.liked ? 'Liked' : 'Like'}
        >
          <ThumbsUp
            className={`w-5 h-5 ${currentTrack.liked ? 'fill-[#ffd8e4]' : 'fill-transparent'}`}
          />
        </button>

        {/* Previous Track */}
        <button
          onClick={onPrev}
          className="p-2.5 rounded-full text-[#e5d4da] hover:text-white hover:bg-white/5 transition active:scale-95"
          title="Previous Track"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        {/* Play / Pause (Material You pastel rounded button) */}
        <button
          onClick={onPlayPause}
          className="w-13 h-13 rounded-[20px] bg-[#ffd8e4] text-[#31111d] flex items-center justify-center shadow-lg transition active:scale-95 hover:bg-[#ffcddb]"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-0.5" />
          )}
        </button>

        {/* Next Track (Shown in Image 2!) */}
        <button
          onClick={onNext}
          className="p-2.5 rounded-full text-[#e5d4da] hover:text-white hover:bg-white/5 transition active:scale-95"
          title="Next Track"
        >
          <SkipForward className="w-5 h-5" />
        </button>

        {/* Volume / Output indicator */}
        <button
          onClick={onOpenPlayer}
          className="p-2.5 rounded-full text-[#e5d4da] hover:text-white hover:bg-white/5 transition"
          title="Expand Player"
        >
          <Volume2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
