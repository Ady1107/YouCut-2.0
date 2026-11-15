import React, { useState } from 'react';
import { QueueGroup, QueueItem } from '../../../../shared/types';
import { ProgressBar } from './ProgressBar';
import { CheckIcon, PauseIcon, PlayIcon, RefreshCwIcon } from '../Icons';

export interface PlaylistGroupCardProps {
  group: QueueGroup;
  childrenItems: QueueItem[];
  onPauseGroup: (groupId: string) => void;
  onResumeGroup: (groupId: string) => void;
  onCancelGroup: (groupId: string) => void;
  className?: string;
}

export const PlaylistGroupCard: React.FC<PlaylistGroupCardProps> = ({
  group,
  childrenItems,
  onPauseGroup,
  onResumeGroup,
  onCancelGroup,
  className = ''
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAllChildren, setShowAllChildren] = useState(false);

  const totalCount = childrenItems.length;
  const doneItems = childrenItems.filter((c) => c.status === 'done');
  const activeItem = childrenItems.find((c) => c.status === 'downloading');
  const waitingItems = childrenItems.filter((c) => c.status === 'waiting');
  const pausedItems = childrenItems.filter((c) => c.status === 'paused');
  const isGroupPaused = activeItem === undefined && pausedItems.length > 0;

  // Group progress = (finished children + current child fraction) / total children
  const activeFraction = activeItem ? (activeItem.progress.percent || 0) / 100 : 0;
  const groupProgressPct = totalCount > 0
    ? Math.min(100, Math.round(((doneItems.length + activeFraction) / totalCount) * 100))
    : 0;

  const currentIdx = activeItem
    ? (activeItem.indexInGroup || childrenItems.indexOf(activeItem) + 1)
    : doneItems.length + 1;

  const speedStr = activeItem?.progress.speed && activeItem.progress.speed !== '—'
    ? activeItem.progress.speed
    : '—';
  const etaStr = activeItem?.progress.eta && activeItem.progress.eta !== '—'
    ? `about ${activeItem.progress.eta} left`
    : '';

  const formatText = group.options.format ? group.options.format.toUpperCase() : 'MP4';
  const qualityText = group.options.quality || 'Best available';

  // Visible children in inset list:
  // If not showAllChildren, show at most: last done item, current downloading, first waiting item
  const visibleChildren = showAllChildren
    ? childrenItems
    : childrenItems.slice(Math.max(0, currentIdx - 2), currentIdx + 2);

  const moreWaitingCount = Math.max(0, childrenItems.length - (currentIdx + 1));

  return (
    <div
      className={`p-4 sm:p-5 rounded-[18px] bg-card border border-border-strong shadow-sm hover:border-border-muted transition-all flex flex-col gap-3.5 ${className}`}
    >
      {/* Group Header */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Stack Icon */}
          <div className="w-10 h-10 rounded-[12px] bg-surface border border-border flex items-center justify-center text-foreground flex-none">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>

          {/* Group Title & Details */}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-center flex-wrap gap-2">
              <h3
                className="font-display font-bold text-base text-foreground truncate max-w-sm"
                title={group.title}
              >
                {group.title}
              </h3>

              <span className="px-2 py-0.5 rounded-full bg-accent-tint text-accent-tintText font-semibold text-[11px] capitalize">
                YouTube
              </span>

              <span className="px-2 py-0.5 rounded-full bg-surface text-foreground-subtle text-[11px] font-medium border border-border-subtle">
                Playlist
              </span>

              <span className="px-2 py-0.5 rounded-[6px] bg-surface text-foreground-subtle font-mono text-[11px] border border-border-subtle">
                {formatText} · {qualityText}
              </span>
            </div>

            <div className="text-xs text-foreground-muted font-mono">
              Video {Math.min(currentIdx, totalCount)} of {totalCount} {speedStr !== '—' ? `· ${speedStr}` : ''} {etaStr ? `· ${etaStr}` : ''}
            </div>
          </div>
        </div>

        {/* Big Percent & Controls */}
        <div className="flex items-center gap-3 flex-none">
          <span className="font-display font-bold text-2xl text-foreground select-none">
            {groupProgressPct}%
          </span>

          {isGroupPaused ? (
            <button
              type="button"
              onClick={() => onResumeGroup(group.id)}
              aria-label="Resume playlist"
              className="w-9 h-9 rounded-[10px] bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors flex items-center justify-center text-sm font-semibold"
            >
              <PlayIcon size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onPauseGroup(group.id)}
              aria-label="Pause playlist"
              className="w-9 h-9 rounded-[10px] bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors flex items-center justify-center text-sm font-semibold"
            >
              <PauseIcon size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => onCancelGroup(group.id)}
            aria-label="Cancel playlist"
            className="w-9 h-9 rounded-[10px] bg-surface border border-border text-foreground-muted hover:text-status-danger hover:border-status-danger/30 transition-colors flex items-center justify-center text-sm font-semibold"
          >
            ✕
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expand playlist' : 'Collapse playlist'}
            className="w-9 h-9 rounded-[10px] bg-surface border border-border text-foreground-muted hover:text-foreground transition-colors flex items-center justify-center text-sm"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <ProgressBar
        progress={groupProgressPct}
        height={6}
        isDownloading={!isGroupPaused && activeItem !== undefined}
        isPaused={isGroupPaused}
      />

      {/* Inset Child List */}
      {!isCollapsed && (
        <div className="bg-inset rounded-[14px] p-2.5 sm:p-3 border border-border-subtle flex flex-col gap-1 transition-all">
          {visibleChildren.map((child, idx) => {
            const childIdx = child.indexInGroup || childrenItems.indexOf(child) + 1;
            const isDone = child.status === 'done';
            const isDownloading = child.status === 'downloading';
            const isWaiting = child.status === 'waiting';
            const isFailed = child.status === 'failed';

            return (
              <div
                key={child.id}
                className="flex items-center gap-3 px-2 py-2 rounded-[8px] hover:bg-surface/50 text-xs min-h-[44px]"
              >
                {/* Index zero padded */}
                <span className="font-mono text-foreground-muted/70 w-6 flex-none text-[11px]">
                  {childIdx.toString().padStart(2, '0')}
                </span>

                {/* Status Icon */}
                <div className="flex-none w-4 flex items-center justify-center">
                  {isDone && <CheckIcon size={13} className="text-status-success" strokeWidth={2.5} />}
                  {isDownloading && (
                    <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  )}
                  {isWaiting && (
                    <div className="w-3.5 h-3.5 rounded-full border border-foreground-muted/40" />
                  )}
                  {isFailed && (
                    <span className="text-status-danger font-bold text-xs">!</span>
                  )}
                </div>

                {/* Child Title */}
                <span className={`flex-1 truncate ${isDone ? 'text-foreground' : isDownloading ? 'text-foreground font-semibold' : 'text-foreground-muted'}`}>
                  {child.title}
                </span>

                {/* Right Progress / Status */}
                <div className="flex items-center gap-3 flex-none font-mono">
                  {isDownloading && (
                    <>
                      <div className="w-20 sm:w-28">
                        <ProgressBar progress={child.progress.percent} height={4} isDownloading />
                      </div>
                      <span className="text-foreground text-[11px]">
                        {child.progress.percent}% {child.progress.speed && child.progress.speed !== '—' ? `· ${child.progress.speed}` : ''}
                      </span>
                    </>
                  )}

                  {isDone && (
                    <span className="text-status-success font-semibold text-[11px]">
                      Done
                    </span>
                  )}

                  {isWaiting && (
                    <span className="text-foreground-muted text-[11px]">
                      Waiting
                    </span>
                  )}

                  {isFailed && (
                    <span className="text-status-danger text-[11px]">
                      Failed
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Inset Footer */}
          <div className="flex items-center justify-between pt-2 px-2 border-t border-border-subtle mt-1 text-xs">
            <span className="text-foreground-muted font-mono">
              {moreWaitingCount > 0 && !showAllChildren ? `${moreWaitingCount} more waiting` : `${childrenItems.length} videos total`}
            </span>

            {childrenItems.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAllChildren(!showAllChildren)}
                className="text-accent hover:underline font-semibold text-xs"
              >
                {showAllChildren ? 'Show less' : `Show all ${childrenItems.length}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
