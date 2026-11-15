import React from 'react';
import { QueueItem } from '../../../../shared/types';
import { secondsToMs } from '../../utils/time';

export interface WaitingCardProps {
  item: QueueItem;
  queueIndex: number;
  onStartNow: (id: string) => void;
  onRemove: (id: string) => void;
  dragHandleProps?: any;
  className?: string;
}

export const WaitingCard: React.FC<WaitingCardProps> = ({
  item,
  queueIndex,
  onStartNow,
  onRemove,
  dragHandleProps,
  className = ''
}) => {
  const clipLabel = item.clip
    ? `Clip ${secondsToMs(item.clip.startSec)} - ${secondsToMs(item.clip.endSec)}`
    : 'Full video';

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-[18px] bg-card border border-border-strong shadow-sm hover:border-border-muted transition-all flex items-center gap-3.5 ${className}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...dragHandleProps}
        aria-label="Reorder card"
        className="text-foreground-subtle/50 hover:text-foreground cursor-grab active:cursor-grabbing p-1 flex-none select-none"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="2" />
          <circle cx="15" cy="6" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="9" cy="18" r="2" />
          <circle cx="15" cy="18" r="2" />
        </svg>
      </button>

      {/* Thumbnail */}
      <div className="relative w-20 sm:w-24 h-12 sm:h-14 rounded-[8px] overflow-hidden bg-surface flex-none border border-border-subtle shadow-sm group">
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
          <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded-[3px] bg-black/80 text-[9px] font-mono text-white select-none">
            {secondsToMs(item.durationSec)}
          </span>
        )}
      </div>

      {/* Title & Metadata */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <h3
          className="font-display font-semibold text-sm text-foreground truncate"
          title={item.title}
        >
          {item.title}
        </h3>

        <div className="flex items-center flex-wrap gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-accent-tint text-accent-tintText font-semibold text-[11px] capitalize">
            {item.platform}
          </span>
          <span className="px-2 py-0.5 rounded-[6px] bg-surface text-foreground-subtle font-mono text-[11px] border border-border-subtle">
            {item.format.toUpperCase()} · {item.quality}
          </span>
          <span className="text-[11px] text-foreground-muted">
            {clipLabel}
          </span>
        </div>
      </div>

      {/* Status & Actions (Right) */}
      <div className="flex items-center gap-3 flex-none">
        <span className="text-xs font-mono text-foreground-muted">
          Waiting · #{queueIndex + 1}
        </span>

        <button
          type="button"
          onClick={() => onStartNow(item.id)}
          className="h-8 px-3 rounded-[8px] bg-transparent text-accent hover:bg-accent-tint text-xs font-semibold transition-colors"
        >
          Start now
        </button>

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label="Remove item"
          className="w-8 h-8 rounded-[8px] bg-surface border border-border text-foreground-muted hover:text-status-danger transition-colors flex items-center justify-center text-xs font-semibold"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
