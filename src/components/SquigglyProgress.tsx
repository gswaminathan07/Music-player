import React, { useRef, useState, useEffect } from 'react';

interface SquigglyProgressProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (seconds: number) => void;
  className?: string;
  waveColor?: string;
  railColor?: string;
  thumbColor?: string;
}

export const SquigglyProgress: React.FC<SquigglyProgressProps> = ({
  currentTime,
  duration,
  isPlaying,
  onSeek,
  className = '',
  waveColor = '#ffffff',
  railColor = 'rgba(255, 255, 255, 0.25)',
  thumbColor = '#ffffff',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState<number | null>(null);
  const [phase, setPhase] = useState(0);

  // Time-based wave animation when playing
  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setPhase((prev) => (prev + dt * 5) % (Math.PI * 2));
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  const activeTime = isDragging && dragTime !== null ? dragTime : currentTime;
  const progressRatio = duration > 0 ? Math.max(0, Math.min(1, activeTime / duration)) : 0;

  // Handle Drag / Scrubbing
  const calculateSeekTime = (clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pos * duration;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    const newTime = calculateSeekTime(e.clientX);
    setDragTime(newTime);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newTime = calculateSeekTime(e.clientX);
    setDragTime(newTime);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragTime !== null) {
      onSeek(dragTime);
    }
    setDragTime(null);
  };

  // Generate SVG squiggly path for the elapsed portion
  // Length in percentage: 0 to progressRatio * 100
  const width = 1000;
  const height = 24;
  const centerY = height / 2;
  const thumbX = progressRatio * width;

  // Squiggly sine wave parameters
  const waveLength = 28; // pixels per cycle
  const amplitude = isPlaying ? 3.5 : 2.5;

  let wavePath = '';
  if (thumbX > 0) {
    wavePath = `M 0 ${centerY}`;
    const step = 4;
    for (let x = 0; x <= thumbX; x += step) {
      // Sine wave with forward phase animation
      const y = centerY + Math.sin((x / waveLength) * Math.PI * 2 - phase) * amplitude;
      wavePath += ` L ${x} ${y}`;
    }
    wavePath += ` L ${thumbX} ${centerY}`;
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative w-full h-8 flex items-center cursor-pointer select-none touch-none ${className}`}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
      >
        {/* Unplayed Rail (flat straight line) */}
        <line
          x1={thumbX}
          y1={centerY}
          x2={width}
          y2={centerY}
          stroke={railColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Played Wave (Google Pixel authentic squiggly line) */}
        {thumbX > 0 && (
          <path
            d={wavePath}
            fill="none"
            stroke={waveColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Thumb: Google Pixel / Android 13/14 rounded capsule */}
        <rect
          x={Math.max(0, Math.min(width - 5, thumbX - 2.5))}
          y={centerY - 9}
          width="5"
          height="18"
          rx="2.5"
          fill={thumbColor}
          className="transition-transform duration-75"
        />
      </svg>
    </div>
  );
};
