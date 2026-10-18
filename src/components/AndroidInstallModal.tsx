import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  Check,
  X,
  ExternalLink,
  Sparkles,
  Share2,
  FileCode,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [launcherDownloaded, setLauncherDownloaded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleNativeInstall = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome) {
        showToast('Vettify installed to your home screen!');
      }
    } else {
      showToast('Tap Chrome menu (⋮) -> "Add to Home Screen"');
    }
  };

  const handleDownloadLauncher = () => {
    const currentUrl = window.location.href;
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Vettify Music</title>
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#121114">
  <style>
    body {
      margin: 0;
      background: #121114;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .logo {
      width: 72px;
      height: 72px;
      border-radius: 20px;
      background: linear-gradient(135deg, #7c3aed, #ec4899, #f59e0b);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      margin-bottom: 20px;
      box-shadow: 0 10px 25px rgba(124, 58, 237, 0.4);
    }
    h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 800; }
    p { margin: 0 0 24px 0; color: #a1a1aa; font-size: 14px; max-width: 280px; }
    .btn {
      display: inline-block;
      background: #d3e3fd;
      color: #041e49;
      font-weight: 700;
      padding: 14px 28px;
      border-radius: 16px;
      text-decoration: none;
      font-size: 15px;
      box-shadow: 0 4px 15px rgba(211, 227, 253, 0.3);
    }
  </style>
  <script>
    window.location.replace('${currentUrl}');
  </script>
</head>
<body>
  <div class="logo">🎵</div>
  <h1>Launching Vettify</h1>
  <p>Connecting to offline music player...</p>
  <a class="btn" href="${currentUrl}">Open Vettify</a>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Vettify-App.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setLauncherDownloaded(true);
    setTimeout(() => setLauncherDownloaded(false), 3000);
    showToast('Launcher downloaded!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg bg-[#18171b] border-t sm:border border-white/10 rounded-t-[32px] sm:rounded-[32px] shadow-2xl p-5 overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Toast */}
        {toastMessage && (
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center gap-2 p-3 rounded-2xl bg-emerald-500 text-zinc-950 text-xs font-bold shadow-xl animate-fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Handle for mobile */}
        <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Install Vettify to Android
              </h3>
              <p className="text-[11px] text-zinc-400">
                Home screen app with lockscreen controls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Banner */}
        {isInstalled ? (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-400">
            <Check className="w-4 h-4 shrink-0" />
            <span>Vettify is installed and running in native phone app mode!</span>
          </div>
        ) : isInstallable ? (
          <div className="mb-4 p-4 rounded-2xl bg-[#d3e3fd]/15 border border-[#d3e3fd]/30 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-[#d3e3fd] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                1-Tap Install Ready
              </h4>
              <p className="text-[11px] text-zinc-300 mt-0.5">
                Add directly to your Android home screen & app drawer.
              </p>
            </div>
            <button
              onClick={handleNativeInstall}
              className="px-4 py-2 rounded-xl bg-[#d3e3fd] hover:bg-[#c2e7ff] text-[#041e49] text-xs font-bold transition shadow-md shrink-0 flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Install
            </button>
          </div>
        ) : null}

        {/* Step-by-Step Android Chrome Instructions */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3 mb-4">
          <h4 className="text-xs font-bold text-white flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            How to Install on Android Phone:
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-xs text-zinc-300 leading-relaxed">
            <li>
              In <strong>Google Chrome</strong> or <strong>Samsung Internet</strong> on your phone, tap the <strong>⋮ (three dots)</strong> menu icon in the top-right corner.
            </li>
            <li>
              Tap <strong>&quot;Add to Home screen&quot;</strong> (or &quot;Install app&quot;).
            </li>
            <li>
              Tap <strong>&quot;Add&quot;</strong> to confirm. Vettify will be added to your home screen!
            </li>
          </ol>
        </div>

        {/* Quick Launch Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
          <button
            onClick={handleDownloadLauncher}
            className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-white text-xs font-bold transition"
          >
            {launcherDownloaded ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">Downloaded!</span>
              </>
            ) : (
              <>
                <FileCode className="w-4 h-4 text-[#d3e3fd]" />
                <span>Save Web Shortcut (.html)</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: 'Vettify Music Player',
                  url: window.location.href,
                }).catch(() => {});
              } else {
                navigator.clipboard.writeText(window.location.href);
                showToast('URL copied to clipboard!');
              }
            }}
            className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-white text-xs font-bold transition"
          >
            <Share2 className="w-4 h-4 text-[#d3e3fd]" />
            <span>Share / Send to Phone</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition"
        >
          Got It
        </button>
      </div>
    </div>
  );
};
