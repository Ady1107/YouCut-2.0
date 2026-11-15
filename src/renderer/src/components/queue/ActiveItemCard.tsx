import React from 'react';
import { QueueItem } from '../../../../shared/types';
import { ProgressBar } from './ProgressBar';
import { PauseIcon, PlayIcon } from '../Icons';
import { secondsToMs } from '../../utils/time';

export interface ActiveItemCardProps {
  item: QueueItem;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  className?: string;
}

export const ActiveItemCard: React.FC<ActiveItemCardProps> = ({
  item,
  onPause,
  onResume,
  onCancel,
  className = ''
}) => {
  const isPaused = item.status === 'paused';
  const progressPct = item.progress?.percent || 0;
  const downloadedMb = ((item.progress?.downloadedBytes || 0) / (1024 * 1024)).toFixed(1);
  const totalMb = ((item.progress?.totalBytes || item.sizeBytes || 0) / (1024 * 1024)).toFixed(1);
  const speedStr = item.progress?.speed && item.progress.speed !== '—' ? item.progress.speed : 'calculating...';
  const etaStr = item.progress?.eta && item.progress.eta !== '—' ? `${item.progress.eta} left` : 'calculating...';

  const clipLabel = item.clip
    ? `Clip ${secondsToMs(item.clip.startSec)} - ${secondsToMs(item.clip.endSec)}`
    : 'Full video';

  return (
    <div
      className={`p-4 rounded-[18px] bg-card border border-border-strong shadow-sm hover:border-border-muted transition-all flex flex-col gap-3.5 ${className}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Thumbnail Preview */}
        <div className="relative w-24 sm:w-28 h-14 sm:h-16 rounded-[10px] overflow-hidden bg-surface flex-none border border-border-subtle shadow-sm group">
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-surface to-surface-active" />
          )}
          {item.durationSec > 0 && (
            <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded-[4px] bg-black/80 text-[10px] font-mono text-white select-none">
              {secondsToMs(item.durationSec)}
            </span>
          )}
        </div>

        {/* Info Column */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <h3
            className="font-display font-semibold text-sm sm:text-base text-foreground truncate"
            title={item.title}
          >
            {item.title}
          </h3>

          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Platform pill */}
            <span className="px-2 py-0.5 rounded-full bg-accent-tint text-accent-tintText font-semibold text-[11px] capitalize">
              {item.platform}
            </span>

            {/* Format & Quality */}
            <span className="px-2 py-0.5 rounded-[6px] bg-surface text-foreground-subtle font-mono text-[11px] border border-border-subtle">
              {item.format.toUpperCase()} · {item.quality}
            </span>

            {/* Clip or Full video */}
            <span className="text-[11px] text-foreground-muted">
              {clipLabel}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-none">
          {isPaused ? (
            <button
              type="button"
              onClick={() => onResume(item.id)}
              aria-label="Resume download"
              className="h-9 px-3 rounded-[10px] bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              <PlayIcon size={14} />
              <span>Resume</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onPause(item.id)}
              aria-label="Pause download"
              className="h-9 px-3 rounded-[10px] bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              <PauseIcon size={14} />
              <span>Pause</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onCancel(item.id)}
            aria-label="Cancel download"
            className="w-9 h-9 rounded-[10px] bg-surface border border-border text-foreground-muted hover:text-status-danger hover:border-status-danger/30 transition-colors flex items-center justify-center text-sm font-semibold"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Progress Bar & Real-time Metrics */}
      <div className="flex flex-col gap-2 pt-0.5">
        <ProgressBar
          progress={progressPct}
          height={6}
          isDownloading={!isPaused}
          isPaused={isPaused}
        />

        <div className="flex items-center justify-between text-xs font-mono text-foreground-muted">
          <span>
            {isPaused ? 'Paused' : `${progressPct}% · ${downloadedMb} / ${totalMb} MB · ${speedStr} · ${etaStr}`}
          </span>
          <span className="font-semibold text-foreground">
            {progressPct}%
          </span>
        </div>
      </div>
    </div>
  );
};
