import React from 'react';
import { QueueItem } from '../../../../shared/types';
import { RefreshCwIcon } from '../Icons';

export interface FailedCardProps {
  item: QueueItem;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  className?: string;
}

export const FailedCard: React.FC<FailedCardProps> = ({
  item,
  onRetry,
  onRemove,
  className = ''
}) => {
  return (
    <div
      className={`p-3.5 sm:p-4 rounded-[18px] bg-card border border-border-strong shadow-sm hover:border-border-muted transition-all flex items-center gap-3.5 ${className}`}
    >
      {/* Red Alert Icon */}
      <div className="w-6 h-6 rounded-full bg-status-dangerTint border border-status-danger/30 flex items-center justify-center text-status-danger flex-none font-bold text-xs">
        !
      </div>

      {/* Thumbnail */}
      <div className="relative w-20 sm:w-24 h-12 sm:h-14 rounded-[8px] overflow-hidden bg-surface flex-none border border-border-subtle shadow-sm group">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="w-full h-full object-cover opacity-60"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface to-surface-active" />
        )}
      </div>

      {/* Title, Badges & Error */}
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
          <span className="text-[11px] font-medium text-status-danger truncate">
            {item.error || 'Download failed'}
          </span>
        </div>
      </div>

      {/* Actions (Right) */}
      <div className="flex items-center gap-2 flex-none">
        <button
          type="button"
          onClick={() => onRetry(item.id)}
          className="h-8 px-3 rounded-[8px] bg-surface border border-accent/30 text-accent hover:bg-accent hover:text-onAccent transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <RefreshCwIcon size={12} />
          <span>Retry</span>
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
