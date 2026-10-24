import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Share2, PlusSquare, Sparkles, Check } from 'lucide-react';

interface PWAInstallPromptProps {
  mode?: 'banner' | 'button';
  className?: string;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  mode = 'banner',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already installed as a PWA, or dismissed by user, do not show
  if (isInstalled || isDismissed) {
    return null;
  }

  // Only show if browser supports install or device is iOS Safari
  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }
    setIsInstalling(true);
    await install();
    setIsInstalling(false);
  };

  if (mode === 'button') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-semibold text-xs transition shadow-sm active:scale-95 ${className}`}
          title="Install Vettify to your Home Screen for instant loading"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isIOS ? 'Install on Phone' : 'Install App'}</span>
        </button>

        {showIOSModal && (
          <IOSInstallModal onClose={() => setShowIOSModal(false)} />
        )}
      </>
    );
  }

  // Default 'banner' mode for mobile
  return (
    <>
      <div className={`p-3 rounded-2xl bg-gradient-to-r from-cyan-950/80 via-zinc-900 to-zinc-900 border border-cyan-800/60 shadow-lg text-white flex items-center justify-between gap-3 animate-in fade-in select-none ${className}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center shrink-0 text-cyan-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white tracking-tight">Install Vettify on Phone</span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700/50">
                ⚡ Instant Launch
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate">
              Launch in under 1 second with offline cached audio engine.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-950/50 transition active:scale-95 disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isIOS ? 'Install' : isInstalling ? 'Adding...' : 'Install App'}</span>
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition"
            title="Dismiss install banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showIOSModal && (
        <IOSInstallModal onClose={() => setShowIOSModal(false)} />
      )}
    </>
  );
};

const IOSInstallModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm bg-[#141418] border border-zinc-800 rounded-3xl shadow-2xl p-6 text-white space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-600/20 text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Install on iPhone / iPad</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          Install Vettify to your home screen for full-screen audio playback and instant launch:
        </p>

        <div className="space-y-2.5 text-xs text-zinc-300">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 text-cyan-400">
              <Share2 className="w-3.5 h-3.5" />
            </div>
            <div className="leading-snug">
              <span className="font-semibold text-white">1. Tap the Share button</span>
              <p className="text-[11px] text-zinc-400 mt-0.5">Located at the bottom of Safari's toolbar.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 text-cyan-400">
              <PlusSquare className="w-3.5 h-3.5" />
            </div>
            <div className="leading-snug">
              <span className="font-semibold text-white">2. Tap "Add to Home Screen"</span>
              <p className="text-[11px] text-zinc-400 mt-0.5">Scroll down in the share sheet and tap Add.</p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs transition"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
