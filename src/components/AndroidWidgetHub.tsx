import React, { useState } from 'react';
import { Track } from '../types/music';
import { PixelTurntableWidget } from './PixelTurntableWidget';
import { PixelNotificationWidget } from './PixelNotificationWidget';
import {
  Smartphone,
  Disc3,
  Layers,
  X,
  Pin,
  Check,
  ExternalLink,
  Volume2,
  Download,
  PlusCircle,
  HelpCircle,
  Home,
  CheckCircle2,
} from 'lucide-react';

interface AndroidWidgetHubProps {
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
  isFloatingWidgetActive: boolean;
  onToggleFloatingWidget: () => void;
  activeWidgetStyle: 'turntable' | 'notification' | 'samsung';
  onChangeWidgetStyle: (style: 'turntable' | 'notification' | 'samsung') => void;
  onOpenInstallGuide?: () => void;
}

export const AndroidWidgetHub: React.FC<AndroidWidgetHubProps> = ({
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
  isFloatingWidgetActive,
  onToggleFloatingWidget,
  activeWidgetStyle,
  onChangeWidgetStyle,
  onOpenInstallGuide,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddTurntableWidget = () => {
    // 1. Ensure style is set to turntable
    onChangeWidgetStyle('turntable');
    // 2. Enable floating pinned widget immediately
    if (!isFloatingWidgetActive) {
      onToggleFloatingWidget();
    }
    showToast('Turntable widget pinned! You can drag it or keep it floating.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg bg-[#18171b] border-t sm:border border-white/10 rounded-t-[32px] sm:rounded-[32px] shadow-2xl p-5 overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Toast confirmation */}
        {toastMessage && (
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center gap-2 p-3 rounded-2xl bg-emerald-500 text-zinc-950 text-xs font-bold shadow-xl animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Handle for mobile bottom sheet feel */}
        <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto mb-3 sm:hidden" />

        {/* Header - Simple & Clean */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#d3e3fd] text-[#041e49]">
              <Disc3 className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Android Widgets
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#d3e3fd]/20 text-[#d3e3fd] font-mono">
                  Material You
                </span>
              </h3>
              <p className="text-[11px] text-[#c4c7c5]">
                Turntable vinyl & lockscreen playback
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#c4c7c5] hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Style Selector Buttons */}
        <div className="flex items-center gap-2 mb-4 p-1 bg-[#232227] rounded-2xl border border-white/5">
          <button
            onClick={() => onChangeWidgetStyle('turntable')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition ${
              activeWidgetStyle === 'turntable'
                ? 'bg-[#d3e3fd] text-[#041e49] shadow-md'
                : 'text-[#c4c7c5] hover:text-white'
            }`}
          >
            <Disc3 className="w-4 h-4" />
            Turntable Vinyl
          </button>

          <button
            onClick={() => onChangeWidgetStyle('notification')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition ${
              activeWidgetStyle === 'notification'
                ? 'bg-[#ffd8e4] text-[#31111d] shadow-md'
                : 'text-[#c4c7c5] hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            Squiggly Waveform
          </button>
        </div>

        {/* Interactive Widget Display Box */}
        <div className="p-4 rounded-[24px] bg-[#100f13] border border-white/5 flex flex-col items-center justify-center min-h-[260px] mb-4 shadow-inner">
          {activeWidgetStyle === 'turntable' && (
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
          )}

          {activeWidgetStyle === 'notification' && (
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

        {/* Primary Action: Add / Pin Turntable Widget */}
        <div className="space-y-2.5 mb-4">
          <button
            onClick={handleAddTurntableWidget}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#d3e3fd] hover:bg-[#c2e7ff] text-[#041e49] font-bold text-sm shadow-lg transition active:scale-98"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Turntable Widget to Screen</span>
            {isFloatingWidgetActive && activeWidgetStyle === 'turntable' && (
              <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-[#041e49]/20 text-[#041e49] uppercase font-mono">
                Active
              </span>
            )}
          </button>

          {/* Quick Pin / Unpin button */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#232227] border border-white/5">
            <div className="flex items-center gap-2">
              <Pin className="w-4 h-4 text-[#d3e3fd]" />
              <div>
                <span className="text-xs font-bold text-white block">Floating Picture-in-Picture</span>
                <span className="text-[10px] text-zinc-400">Floats over the app while you browse songs</span>
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
              {isFloatingWidgetActive ? 'ACTIVE' : 'ENABLE'}
            </button>
          </div>
        </div>

        {/* Android Home Screen Instructions (How widgets work on Android) */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2 text-xs text-[#c4c7c5] mb-4">
          <div className="flex items-center gap-2 text-white font-bold">
            <Home className="w-3.5 h-3.5 text-[#d3e3fd]" />
            <span>How to add to Android Home Screen:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-zinc-300 pl-1">
            <li>
              Tap <strong>&quot;Add Turntable Widget to Screen&quot;</strong> above to float it instantly.
            </li>
            <li>
              To install Vettify as a full phone app with lockscreen controls, tap <strong>&quot;Download App&quot;</strong> in the header or below.
            </li>
            <li>
              Once installed, lock your phone or swipe down from the top to see the squiggly media player notification!
            </li>
          </ol>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          {onOpenInstallGuide ? (
            <button
              onClick={onOpenInstallGuide}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Download App
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#d3e3fd] text-[#041e49] text-xs font-bold hover:bg-[#c2e7ff] transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

