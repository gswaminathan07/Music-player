import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RootErrorBoundary] Uncaught React exception:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetStorage = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.clear();
      }
      if (typeof indexedDB !== 'undefined') {
        const req = indexedDB.deleteDatabase('Vettify_OfflineDB');
        req.onsuccess = () => window.location.reload();
        req.onerror = () => window.location.reload();
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0c0c0e] text-zinc-100 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md w-full bg-[#141418] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto text-2xl shadow-inner">
              🎵
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Vettify Studio Recovered</h2>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                The studio interface encountered a temporary condition. Your playlists and audio cache are safe.
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 rounded-xl bg-black/50 border border-zinc-800 text-[11px] font-mono text-zinc-400 truncate max-w-full text-left">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-md active:scale-95"
              >
                Reload Studio
              </button>
              <button
                onClick={this.handleResetStorage}
                className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
                title="Clears corrupted state if reload does not recover"
              >
                Reset Safe State
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Suppress benign browser ResizeObserver loop notification
if (typeof window !== 'undefined') {
  const isResizeObserverError = (msg?: string) =>
    Boolean(
      msg &&
        (msg.includes('ResizeObserver loop completed with undelivered notifications') ||
          msg.includes('ResizeObserver loop limit exceeded'))
    );

  window.addEventListener('error', (event) => {
    if (isResizeObserverError(event.message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && isResizeObserverError(event.reason.message || String(event.reason))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
