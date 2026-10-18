import React from 'react';
import { EqualizerSettings } from '../types/music';
import { EQ_FREQUENCIES, EQ_PRESETS, audioEngine } from '../services/audioEngine';
import { AudioVisualizer } from './AudioVisualizer';
import {
  Sliders,
  RotateCcw,
  X,
  Power,
} from 'lucide-react';

interface EqualizerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: EqualizerSettings;
  onChange: (newSettings: EqualizerSettings) => void;
  isPlaying: boolean;
}

export const EqualizerDrawer: React.FC<EqualizerDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onChange,
  isPlaying,
}) => {
  if (!isOpen) return null;

  const handleBandChange = (index: number, val: number) => {
    const updatedBands = [...settings.bands];
    updatedBands[index] = val;
    const updated = { ...settings, bands: updatedBands, preset: 'custom' };
    onChange(updated);
    audioEngine.applyEqualizer(updated);
  };

  const handlePresetSelect = (key: string) => {
    const p = EQ_PRESETS[key];
    if (!p) return;
    const updated: EqualizerSettings = {
      ...settings,
      preset: key,
      bands: [...p.bands],
      bassBoost: p.bass,
      spatialSurround: p.spatial,
    };
    onChange(updated);
    audioEngine.applyEqualizer(updated);
  };

  const handleReset = () => {
    handlePresetSelect('flat');
  };

  const toggleEq = () => {
    const updated = { ...settings, enabled: !settings.enabled };
    onChange(updated);
    audioEngine.applyEqualizer(updated);
  };

  const handleBassBoost = (val: number) => {
    const updated = { ...settings, bassBoost: val, preset: 'custom' };
    onChange(updated);
    audioEngine.applyEqualizer(updated);
  };

  const handleSpatial = (val: number) => {
    const updated = { ...settings, spatialSurround: val, preset: 'custom' };
    onChange(updated);
    audioEngine.applyEqualizer(updated);
  };

  const handlePreamp = (val: number) => {
    const updated = { ...settings, preamp: val, preset: 'custom' };
    onChange(updated);
    audioEngine.applyEqualizer(updated);
  };

  const formatFreq = (f: number) => (f >= 1000 ? `${f / 1000}k` : `${f}`);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md select-none animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#141418]/90 backdrop-blur-2xl border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
        {/* Rack Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
          <div>
            <h2 className="text-base font-bold text-zinc-100 tracking-tight">
              10-Band Parametric Equalizer
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Calibrated acoustic response and studio target presets
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleEq}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                settings.enabled
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              {settings.enabled ? 'ACTIVE' : 'BYPASS'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              aria-label="Close Equalizer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Real-time spectrum visualizer */}
        <div className="mb-5 bg-[#0c0c0e] border border-zinc-800 rounded-xl p-3">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mb-1.5">
            <span>REAL-TIME SPECTRUM</span>
            <span>20 Hz – 20 kHz</span>
          </div>
          <AudioVisualizer mode="bars" height={44} isPlaying={isPlaying && settings.enabled} />
        </div>

        {/* Segmented Preset Selector */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-300">Calibration Presets</span>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-orange-400 transition"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Flat
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(EQ_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => handlePresetSelect(key)}
                className={`px-3 py-2 rounded-xl text-left border transition text-xs font-medium truncate ${
                  settings.preset === key
                    ? 'bg-zinc-800 border-orange-500/60 text-orange-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {preset.name.split('/')[0].trim()}
              </button>
            ))}
          </div>
        </div>

        {/* 10-Band Sliders Rack */}
        <div className="mb-6 p-4 bg-[#0c0c0e] border border-zinc-800 rounded-2xl">
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-3 px-1">
            <span>+12 dB</span>
            <span>0 dB (CENTER)</span>
            <span>-12 dB</span>
          </div>

          {/* Sliders Container */}
          <div className="grid grid-cols-10 gap-1 sm:gap-2 items-center text-center h-44">
            {settings.bands.map((gain, index) => {
              const freq = EQ_FREQUENCIES[index];
              return (
                <div key={freq} className="flex flex-col items-center h-full justify-between py-1">
                  {/* dB readout */}
                  <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                    {gain > 0 ? `+${gain}` : gain}
                  </span>

                  {/* Vertical Fader */}
                  <div className="flex-1 flex items-center justify-center my-1 relative">
                    {/* Zero center tick */}
                    <div className="absolute w-4 h-[1px] bg-zinc-700 pointer-events-none" />
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      disabled={!settings.enabled}
                      value={gain}
                      onChange={(e) => handleBandChange(index, parseInt(e.target.value, 10))}
                      className="slider-vertical h-28 cursor-pointer disabled:opacity-40"
                    />
                  </div>

                  {/* Frequency label */}
                  <span className="text-[10px] font-mono font-medium text-zinc-400 mt-1">
                    {formatFreq(freq)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rotary Knobs / Fine Tuning Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Bass Boost */}
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="font-semibold text-zinc-300">Sub-Bass Boost</span>
              <span className="font-mono text-orange-400">{settings.bassBoost}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              disabled={!settings.enabled}
              value={settings.bassBoost}
              onChange={(e) => handleBassBoost(parseInt(e.target.value, 10))}
              className="w-full cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Spatial Acoustic Reflection */}
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="font-semibold text-zinc-300">Spatial Depth</span>
              <span className="font-mono text-orange-400">{settings.spatialSurround}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              disabled={!settings.enabled}
              value={settings.spatialSurround}
              onChange={(e) => handleSpatial(parseInt(e.target.value, 10))}
              className="w-full cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Preamp Gain */}
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="font-semibold text-zinc-300">Preamp Trim</span>
              <span className="font-mono text-orange-400">
                {settings.preamp > 0 ? `+${settings.preamp}` : settings.preamp} dB
              </span>
            </div>
            <input
              type="range"
              min="-6"
              max="6"
              step="1"
              disabled={!settings.enabled}
              value={settings.preamp}
              onChange={(e) => handlePreamp(parseInt(e.target.value, 10))}
              className="w-full cursor-pointer disabled:opacity-40"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
