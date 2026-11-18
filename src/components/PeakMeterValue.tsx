import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

interface PeakMeterValueProps {
  isPlaying: boolean;
  className?: string;
  showLimiterBadge?: boolean;
}

/**
 * Isolated, high-performance VU Peak Meter component.
 * Uses direct DOM reference updates in an animation frame loop to deliver
 * real-time analog meter ballistics with ZERO React re-renders of the root App tree.
 * Prevents main-thread starvation and audio buffer underruns during heavy bass punches.
 */
export const PeakMeterValue: React.FC<PeakMeterValueProps> = ({
  isPlaying,
  className = '',
  showLimiterBadge = true,
}) => {
  const dbTextRef = useRef<HTMLSpanElement>(null);
  const limiterBadgeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isPlaying) {
      if (dbTextRef.current) {
        dbTextRef.current.textContent = '-∞ dB';
      }
      if (limiterBadgeRef.current) {
        limiterBadgeRef.current.style.opacity = '0';
      }
      return;
    }

    let animId: number;
    let lastUpdate = 0;

    const renderLoop = (timestamp: number) => {
      // Throttle DOM text mutation to 20 FPS (50ms interval) for optimal human legibility & minimal CPU
      if (timestamp - lastUpdate >= 50) {
        lastUpdate = timestamp;
        const peak = audioEngine.getPeakLevelDb();

        if (dbTextRef.current) {
          dbTextRef.current.textContent = peak.formattedDb;
        }

        if (limiterBadgeRef.current) {
          limiterBadgeRef.current.style.opacity = peak.isLimiting ? '1' : '0';
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  return (
    <div className="inline-flex items-center gap-1.5 font-mono select-none">
      {showLimiterBadge && (
        <span
          ref={limiterBadgeRef}
          style={{ opacity: 0 }}
          className="text-[9px] px-1 py-0.2 rounded font-mono font-bold tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-opacity duration-150"
          title="Anti-Clipping Limiter Active: Protecting DAC from 0 dBFS square-wave distortion"
        >
          LIM
        </span>
      )}
      <span
        ref={dbTextRef}
        className={`text-orange-400 font-mono text-[10px] font-bold ${className}`}
      >
        -∞ dB
      </span>
    </div>
  );
};
