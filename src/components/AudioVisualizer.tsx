import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

interface AudioVisualizerProps {
  mode?: 'bars' | 'waveform' | 'minimal';
  height?: number;
  className?: string;
  isPlaying?: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  mode = 'bars',
  height = 56,
  className = '',
  isPlaying = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedBarsRef = useRef<number[]>([]);
  const peakBarsRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const updateWidth = () => {
      if (mode === 'minimal') {
        canvas.width = 24;
      } else if (canvas.parentElement) {
        const parentW = canvas.parentElement.clientWidth;
        if (parentW > 0 && canvas.width !== parentW) {
          canvas.width = parentW;
        }
      }
    };
    updateWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    const render = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        animId = requestAnimationFrame(render);
        return;
      }
      const width = canvas.width || 280;
      const h = canvas.height || height;
      ctx.clearRect(0, 0, width, h);

      const { frequencyData, waveformData } = audioEngine.getVisualizerData();

      if (mode === 'bars') {
        // High-precision studio audio spectrum analyzer with logarithmic frequency scaling
        const barCount = Math.max(18, Math.min(42, Math.floor(width / 9)));
        const barWidth = Math.max(2.5, (width / barCount) * 0.68);
        const gap = (width - barCount * barWidth) / Math.max(1, barCount - 1);

        // Ensure state arrays match bar count
        if (smoothedBarsRef.current.length !== barCount) {
          smoothedBarsRef.current = new Array(barCount).fill(0);
          peakBarsRef.current = new Array(barCount).fill(0);
        }

        const smoothed = smoothedBarsRef.current;
        const peaks = peakBarsRef.current;

        for (let i = 0; i < barCount; i++) {
          // Logarithmic audio frequency distribution across spectrum:
          // Low index: Sub-bass (32Hz)
          // Quarter index: Bass & Lower Mids (250Hz)
          // Center index: Lead Vocals / Snare (1kHz)
          // Three-quarter index: Presence & Guitars (4kHz)
          // High index: Air & Cymbals (16kHz)
          const minFreqBin = 1;
          const maxFreqBin = Math.max(minFreqBin + 2, Math.floor(frequencyData.length * 0.85));
          const logFactor = Math.pow(maxFreqBin / minFreqBin, i / (barCount - 1));
          const dataIndex = Math.min(frequencyData.length - 1, Math.max(0, Math.round(minFreqBin * logFactor)));

          const rawValue = isPlaying ? (frequencyData[dataIndex] || 0) : 0;

          // Studio ballistic filter: Instantaneous attack (up), smooth decay (down)
          if (rawValue > smoothed[i]) {
            smoothed[i] = rawValue;
          } else {
            smoothed[i] = Math.max(0, smoothed[i] * 0.86);
          }

          // Peak hold with gravity falloff
          if (smoothed[i] >= peaks[i]) {
            peaks[i] = smoothed[i];
          } else {
            peaks[i] = Math.max(0, peaks[i] - 3.5);
          }

          const barHeight = Math.max(2, (smoothed[i] / 255) * (h * 0.85));
          const x = i * (barWidth + gap);
          const y = h - barHeight;

          // Studio segmented LED gradient
          const intensity = Math.min(1, smoothed[i] / 210);
          if (intensity > 0.82) {
            ctx.fillStyle = '#f97316'; // peak bright orange
          } else if (intensity > 0.48) {
            ctx.fillStyle = '#fb923c'; // mid amber
          } else {
            ctx.fillStyle = '#ea580c'; // low warm amber
          }

          ctx.fillRect(x, y, barWidth, barHeight);

          // Top peak hold LED
          if (peaks[i] > 8) {
            const peakY = Math.max(0, h - (peaks[i] / 255) * (h * 0.85) - 2.5);
            ctx.fillStyle = intensity > 0.85 ? '#fed7aa' : '#fb923c';
            ctx.fillRect(x, peakY, barWidth, 1.5);
          }
        }
      } else if (mode === 'waveform') {
        // Precise analog oscilloscope trace
        ctx.beginPath();
        const sliceWidth = width / (waveformData.length - 1);
        let x = 0;

        for (let i = 0; i < waveformData.length; i++) {
          const v = isPlaying
            ? waveformData[i] / 128.0
            : 1.0;
          const y = (v * h) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.75;
        ctx.shadowColor = 'rgba(249, 115, 22, 0.45)';
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (mode === 'minimal') {
        const bars = 4;
        const bw = 2.5;
        const bg = 2;
        const totalW = bars * bw + (bars - 1) * bg;
        const startX = (width - totalW) / 2;

        for (let i = 0; i < bars; i++) {
          const v = isPlaying
            ? (frequencyData[i * 6] || 0) / 255
            : 0.15;
          const bh = Math.max(3, v * h * 0.9);
          const x = startX + i * (bw + bg);
          const y = h - bh;

          ctx.fillStyle = '#f97316';
          ctx.fillRect(x, y, bw, bh);
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
    };
  }, [mode, isPlaying, height]);

  return (
    <canvas
      ref={canvasRef}
      width={mode === 'minimal' ? 24 : 320}
      height={height}
      className={`block ${className}`}
    />
  );
};
