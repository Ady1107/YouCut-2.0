import React from 'react';
import { QueueItem } from '../../../../shared/types';
import { CheckIcon, FolderIcon, PlayIcon } from '../Icons';
import { secondsToMs } from '../../utils/time';

export interface DoneCardProps {
  item: QueueItem;
  onShowInFolder: (path?: string) => void;
  onPlay: (path?: string) => void;
  className?: string;
}

export const DoneCard: React.FC<DoneCardProps> = ({
  item,
  onShowInFolder,
  onPlay,
  className = ''
}) => {
  const sizeMb = item.sizeBytes ? `${(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : '';
  const clipLabel = item.clip
    ? `Clip ${secondsToMs(item.clip.startSec)} - ${secondsToMs(item.clip.endSec)}${sizeMb ? ` · ${sizeMb}` : ''}`
    : `Full video${sizeMb ? ` · ${sizeMb}` : ''}`;

  const formatDoneTime = (ts?: number) => {
    if (!ts) return 'Done';
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return 'Done · just now';
    if (diffSec < 3600) return `Done · ${Math.floor(diffSec / 60)} min ago`;
    return `Done · ${Math.floor(diffSec / 3600)}h ago`;
  };

  const isWarning = item.status === 'warning';

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-[18px] bg-card border border-border-strong shadow-sm hover:border-border-muted transition-all flex items-center gap-3.5 ${className}`}
    >
      {/* Icon: Warning or Green Check */}
      {isWarning ? (
        <div
          className="w-6 h-6 rounded-full bg-status-dangerTint border border-status-danger/40 flex items-center justify-center text-status-danger flex-none font-bold text-xs"
          title={item.warning}
        >
          !
        </div>
      ) : (
        <div className="w-6 h-6 rounded-full bg-status-successTint border border-status-success/30 flex items-center justify-center text-status-success flex-none">
          <CheckIcon size={13} strokeWidth={2.5} />
        </div>
      )}

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
        <span
          className={`text-xs font-medium ${isWarning ? 'text-status-danger' : 'text-status-success'}`}
          title={item.warning}
        >
          {isWarning
            ? item.warning
              ? `Finished with warning: ${item.warning}`
              : 'Finished with warning'
            : formatDoneTime(item.finishedAt)}
        </span>

        <button
          type="button"
          onClick={() => onShowInFolder(item.filePath)}
          className="h-8 px-3 rounded-[8px] bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <FolderIcon size={12} />
          <span>Open folder</span>
        </button>

        <button
          type="button"
          onClick={() => onPlay(item.filePath)}
          aria-label="Play downloaded file"
          className="w-8 h-8 rounded-[8px] bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors flex items-center justify-center text-xs"
        >
          <PlayIcon size={12} />
        </button>
      </div>
    </div>
  );
};
