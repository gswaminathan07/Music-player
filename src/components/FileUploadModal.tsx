import React, { useState } from 'react';
import { Track } from '../types/music';
import {
  deviceFileService,
  ScanProgress,
  isAndroidDevice,
} from '../services/deviceFileService';
import {
  FolderOpen,
  Smartphone,
  X,
  Disc3,
  Loader2,
  HardDrive,
  Info,
  Cloud,
  CheckCircle2,
  Laptop,
} from 'lucide-react';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTracksAdded: (newTracks: Track[]) => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onTracksAdded,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isAndroid = isAndroidDevice();

  if (!isOpen) return null;

  const handlePickFiles = async () => {
    setErrorMsg(null);
    try {
      const files = await deviceFileService.selectDeviceFiles();
      if (!files || files.length === 0) return;
      await processSelectedFiles(files);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to access device files.');
    }
  };

  const handlePickFolder = async () => {
    setErrorMsg(null);
    try {
      const files = await deviceFileService.selectDeviceFolder();
      if (!files || files.length === 0) {
        if (isAndroid) {
          setErrorMsg(
            'No files were selected. In the Android file picker: navigate to your Music folder, tap ⋮ (menu) > "Select all", then tap "Open".'
          );
        } else {
          setErrorMsg('No audio files were found in the selected folder.');
        }
        return;
      }
      await processSelectedFiles(files);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to access device folder.');
    }
  };

  const processSelectedFiles = async (files: File[]) => {
    setIsScanning(true);
    setProgress({
      current: 0,
      total: files.length,
      filename: 'Reading audio tracks...',
      percent: 0,
    });

    try {
      const tracks = await deviceFileService.processDeviceFiles(files, (p) => {
        setProgress(p);
      });

      if (tracks.length > 0) {
        onTracksAdded(tracks);
        onClose();
      } else {
        setErrorMsg('No supported audio files (.mp3, .flac, .wav, .m4a, .aac, .ogg) found.');
      }
    } catch (err: any) {
      setErrorMsg('Error reading device audio files.');
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      await processSelectedFiles(files);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 select-none backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#141418] border border-zinc-800 rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-100 tracking-tight flex items-center gap-2">
              <span>Import Audio</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-semibold flex items-center gap-1">
                <Cloud className="w-2.5 h-2.5" />
                <span>Cloud Synced</span>
              </span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Audio uploaded from laptop will also show up on the phone version
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isScanning}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Laptop ⇄ Phone Cloud Sync Callout Banner */}
        <div className="mb-4 p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/50 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-900/60 text-cyan-300 shrink-0 mt-0.5">
            <Laptop className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <span className="font-semibold text-cyan-300 block mb-0.5 flex items-center gap-1.5">
              <span>Seamless Laptop to Phone Synchronization</span>
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            </span>
            <p className="text-zinc-300 text-[11px] leading-relaxed">
              When you upload tracks from this browser, they are instantly stored in the studio cloud and automatically appear in your track library on your mobile phone!
            </p>
          </div>
        </div>

        {/* Android Guidance Note */}
        {isAndroid && !isScanning && (
          <div className="mb-4 p-3.5 rounded-xl bg-[#1c1c22] border border-zinc-700/60 text-xs">
            <span className="font-semibold text-orange-400 block mb-1">
              Android Storage Navigation Tip
            </span>
            <p className="text-zinc-300 leading-relaxed text-[11px]">
              Tap <strong>Scan Music Folder</strong> below, navigate into your <strong>Music</strong> folder, tap <strong>⋮ (menu)</strong> in the top corner and choose <strong>"Select all"</strong>.
            </p>
          </div>
        )}

        {/* Progress Bar when reading and uploading */}
        {isScanning && progress ? (
          <div className="p-5 rounded-xl bg-[#0c0c0e] border border-zinc-800 text-center space-y-3 mb-5">
            <div className="relative w-8 h-8 mx-auto">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <Cloud className="w-4 h-4 text-cyan-200 absolute inset-0 m-auto" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-200">
                Processing & Cloud-Syncing ({progress.current}/{progress.total})
              </h4>
              <p className="text-xs font-mono text-zinc-400 truncate max-w-xs mx-auto mt-0.5">
                {progress.filename}
              </p>
              <p className="text-[11px] text-cyan-400/90 mt-1">
                Encoding acoustic tags & syncing to phone cloud...
              </p>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-orange-500 h-full transition-all duration-150"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            {/* Primary Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <button
                onClick={handlePickFolder}
                className="flex flex-col items-start p-4 rounded-xl bg-[#1c1c22] hover:bg-[#23232b] border border-zinc-700/80 text-left transition active:scale-[0.99] group"
              >
                <div className="w-10 h-10 rounded-lg bg-orange-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold text-zinc-100 block">
                  Scan Music Folder
                </span>
                <span className="text-xs text-zinc-400 mt-0.5">
                  Import entire folder & sync to phone
                </span>
              </button>

              <button
                onClick={handlePickFiles}
                className="flex flex-col items-start p-4 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-left transition active:scale-[0.99] group"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-200 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <HardDrive className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold text-zinc-100 block">
                  Select Audio Files
                </span>
                <span className="text-xs text-zinc-400 mt-0.5">
                  Pick individual tracks to upload
                </span>
              </button>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={handlePickFiles}
              className="p-5 rounded-xl border border-dashed border-zinc-700/80 hover:border-cyan-500 hover:bg-cyan-950/20 transition text-center cursor-pointer mb-4"
            >
              <Disc3 className="w-5 h-5 text-zinc-400 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-zinc-300">
                Or drag and drop audio files here from your laptop
              </p>
              <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
                FLAC · MP3 · WAV · M4A · AAC · OGG
              </p>
            </div>
          </>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2">
            <Info className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {/* Sync Note */}
        <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
          Uploaded audio tracks are preserved in studio storage and automatically synchronized so your phone displays them for immediate streaming.
        </p>
      </div>
    </div>
  );
};
