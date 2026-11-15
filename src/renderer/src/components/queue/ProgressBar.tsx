import React from 'react';

export interface ProgressBarProps {
  progress: number; // 0 to 100
  height?: number; // default 6
  isDownloading?: boolean;
  isPaused?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 6,
  isDownloading = false,
  isPaused = false,
  className = ''
}) => {
  const clamped = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full rounded-full bg-track overflow-hidden relative ${className}`}
      style={{ height: `${height}px` }}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 relative overflow-hidden ${
          isPaused
            ? 'bg-status-warning'
            : 'bg-gradient-to-r from-accent via-[#FF7B6E] to-[#FFA07A]'
        }`}
        style={{
          width: `${clamped}%`,
          boxShadow: isDownloading ? 'var(--progress-glow)' : 'none'
        }}
      >
        {/* Soft highlight sweep animation while active downloading */}
        {isDownloading && clamped > 0 && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent w-1/3 animate-sweep pointer-events-none" />
        )}
      </div>
    </div>
  );
};
