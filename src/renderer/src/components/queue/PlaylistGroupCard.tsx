import React, { useState, useMemo } from 'react';
import { QueueGroup, QueueItem } from '../../../../shared/types';
import { ProgressBar } from './ProgressBar';
import {
  CheckIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  FolderIcon,
  CopyIcon,
  TrashIcon
} from '../Icons';

export interface PlaylistGroupCardProps {
  group: QueueGroup;
  childrenItems: QueueItem[];
  onPauseGroup: (groupId: string) => void;
  onResumeGroup: (groupId: string) => void;
  onCancelGroup: (groupId: string) => void;
  onRetryFailedGroup: (groupId: string) => void;
  onCancelRemainingGroup: (groupId: string) => void;
  onStartNowItem: (itemId: string) => void;
  onPauseItem: (itemId: string) => void;
  onResumeItem: (itemId: string) => void;
  onRetryItem: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onShowInFolder: (filePath: string) => void;
  onPlay: (filePath: string) => void;
  className?: string;
}

export const PlaylistGroupCard: React.FC<PlaylistGroupCardProps> = ({
  group,
  childrenItems,
  onPauseGroup,
  onResumeGroup,
  onCancelGroup,
  onRetryFailedGroup,
  onCancelRemainingGroup,
  onStartNowItem,
  onPauseItem,
  onResumeItem,
  onRetryItem,
  onRemoveItem,
  onShowInFolder,
  onPlay,
  className = ''
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAllChildren, setShowAllChildren] = useState(true);
  const [selectedChildIds, setSelectedChildIds] = useState<Set<string>>(new Set());
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const totalCount = childrenItems.length;
  const doneItems = childrenItems.filter((c) => c.status === 'done' || c.status === 'warning');
  const activeItem = childrenItems.find((c) => c.status === 'downloading');
  const waitingItems = childrenItems.filter((c) => c.status === 'waiting');
  const pausedItems = childrenItems.filter((c) => c.status === 'paused');
  const failedItems = childrenItems.filter((c) => c.status === 'failed');

  const isGroupRunning = activeItem !== undefined;
  const isGroupPaused = activeItem === undefined && pausedItems.length > 0 && waitingItems.length === 0;

  // C1: Group status is DERIVED from its children, never stored separately
  const derivedStatus = useMemo(() => {
    if (isGroupRunning) return 'Running';
    if (isGroupPaused) return 'Paused';
    if (waitingItems.length > 0) return pausedItems.length > 0 ? 'Paused' : 'Waiting';
    if (failedItems.length > 0 && doneItems.length > 0) return `Finished with ${failedItems.length} failed`;
    if (failedItems.length > 0 && doneItems.length === 0) return `Finished with ${failedItems.length} failed`;
    if (doneItems.length === totalCount && totalCount > 0) return 'Finished';
    if (totalCount === 0) return 'Empty';
    return 'Finished';
  }, [isGroupRunning, isGroupPaused, waitingItems.length, pausedItems.length, failedItems.length, doneItems.length, totalCount]);

  // C1: Counters text: "1 done · 5 failed · 0 waiting · 0 active"
  const countersText = `${doneItems.length} done · ${failedItems.length} failed · ${waitingItems.length + pausedItems.length} waiting · ${activeItem ? 1 : 0} active`;

  // Group progress = (finished children + current child fraction) / total children
  const activeFraction = activeItem ? (activeItem.progress.percent || 0) / 100 : 0;
  const groupProgressPct = totalCount > 0
    ? Math.min(100, Math.round(((doneItems.length + activeFraction) / totalCount) * 100))
    : 0;

  const currentIdx = activeItem
    ? (activeItem.indexInGroup || childrenItems.indexOf(activeItem) + 1)
    : doneItems.length;

  const speedStr = activeItem?.progress.speed && activeItem.progress.speed !== '—'
    ? activeItem.progress.speed
    : '—';
  const etaStr = activeItem?.progress.eta && activeItem.progress.eta !== '—'
    ? `about ${activeItem.progress.eta} left`
    : '';

  const formatText = group.options.format ? group.options.format.toUpperCase() : 'MP4';
  const qualityText = group.options.quality || 'Best available';

  const visibleChildren = showAllChildren
    ? childrenItems
    : childrenItems.slice(0, 5);

  const toggleSelectChild = (id: string) => {
    setSelectedChildIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedChildIds.size === childrenItems.length) {
      setSelectedChildIds(new Set());
    } else {
      setSelectedChildIds(new Set(childrenItems.map((c) => c.id)));
    }
  };

  const handleCopyStderr = (id: string, stderrTail?: string[]) => {
    const text = stderrTail && stderrTail.length > 0 ? stderrTail.join('\n') : 'No stderr available';
    if (window.api?.writeClipboard) {
      window.api.writeClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // C4: Batch actions on selection
  const handleBatchStartNow = () => {
    selectedChildIds.forEach((id) => onStartNowItem(id));
    setSelectedChildIds(new Set());
  };

  const handleBatchRetry = () => {
    selectedChildIds.forEach((id) => onRetryItem(id));
    setSelectedChildIds(new Set());
  };

  const handleBatchRemove = () => {
    selectedChildIds.forEach((id) => onRemoveItem(id));
    setSelectedChildIds(new Set());
  };

  return (
    <div
      className={`p-4 sm:p-5 rounded-[18px] bg-card border border-border-strong shadow-sm hover:border-border-muted transition-all flex flex-col gap-3.5 ${className}`}
      data-testid="playlist-group-card"
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

              {/* Derived status badge */}
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                isGroupRunning
                  ? 'bg-accent-tint text-accent'
                  : isGroupPaused
                    ? 'bg-amber-500/15 text-amber-400'
                    : failedItems.length > 0
                      ? 'bg-status-danger/15 text-status-danger'
                      : 'bg-status-success/15 text-status-success'
              }`}>
                {derivedStatus}
              </span>
            </div>

            {/* Counters / Live Status */}
            <div className="text-xs text-foreground-muted font-mono flex items-center flex-wrap gap-1.5">
              {isGroupRunning ? (
                <span>Video {Math.min(currentIdx, totalCount)} of {totalCount} {speedStr !== '—' ? `· ${speedStr}` : ''} {etaStr ? `· ${etaStr}` : ''}</span>
              ) : (
                <span>{countersText}</span>
              )}
            </div>
          </div>
        </div>

        {/* Big Percent & Group Action Buttons (C1) */}
        <div className="flex items-center gap-2 flex-none">
          <span className="font-display font-bold text-2xl text-foreground select-none mr-2">
            {groupProgressPct}%
          </span>

          {/* Pause / Resume Group Button (only when it makes sense) */}
          {isGroupRunning && (
            <button
              type="button"
              onClick={() => onPauseGroup(group.id)}
              aria-label="Pause playlist"
              title="Pause playlist"
              className="h-9 px-3 rounded-[10px] bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <PauseIcon size={14} />
              <span>Pause</span>
            </button>
          )}

          {isGroupPaused && (
            <button
              type="button"
              onClick={() => onResumeGroup(group.id)}
              aria-label="Resume playlist"
              title="Resume playlist"
              className="h-9 px-3 rounded-[10px] bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <PlayIcon size={14} />
              <span>Resume</span>
            </button>
          )}

          {/* Retry Failed (N) Group Button */}
          {failedItems.length > 0 && (
            <button
              type="button"
              onClick={() => onRetryFailedGroup(group.id)}
              aria-label="Retry failed items in playlist"
              title={`Retry ${failedItems.length} failed items`}
              className="h-9 px-3 rounded-[10px] bg-surface border border-status-danger/40 text-status-danger hover:bg-status-danger/10 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <RefreshCwIcon size={13} />
              <span>Retry failed ({failedItems.length})</span>
            </button>
          )}

          {/* Cancel remaining button (only when any child is running or waiting) */}
          {(isGroupRunning || waitingItems.length > 0) && (
            <button
              type="button"
              onClick={() => onCancelRemainingGroup(group.id)}
              aria-label="Cancel remaining in playlist"
              title="Cancel all remaining downloads"
              className="h-9 px-2.5 rounded-[10px] bg-surface border border-border text-foreground-muted hover:text-status-danger hover:border-status-danger/30 transition-colors flex items-center text-xs font-medium"
            >
              Cancel remaining
            </button>
          )}

          {/* Open folder button if any items completed */}
          {doneItems.length > 0 && doneItems[0].filePath && (
            <button
              type="button"
              onClick={() => onShowInFolder(doneItems[0].filePath!)}
              aria-label="Open playlist folder"
              title="Open playlist folder"
              className="w-9 h-9 rounded-[10px] bg-surface border border-border text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors flex items-center justify-center text-sm font-semibold"
            >
              <FolderIcon size={15} />
            </button>
          )}

          {/* Cancel / Remove Entire Group */}
          <button
            type="button"
            onClick={() => onCancelGroup(group.id)}
            aria-label="Remove playlist"
            title="Remove playlist"
            className="w-9 h-9 rounded-[10px] bg-surface border border-border text-foreground-muted hover:text-status-danger hover:border-status-danger/30 transition-colors flex items-center justify-center text-sm font-semibold"
          >
            ✕
          </button>

          {/* Expand / Collapse Chevron */}
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

      {/* C1: Segmented Progress Bar */}
      <div
        className="flex items-center gap-1.5 w-full h-2.5 rounded-full overflow-hidden bg-inset border border-border-subtle p-0.5"
        data-testid="playlist-segmented-bar"
      >
        {childrenItems.map((child, i) => {
          let segmentColor = 'bg-border/60';
          if (child.status === 'done' || child.status === 'warning') segmentColor = 'bg-status-success';
          else if (child.status === 'failed') segmentColor = 'bg-status-danger';
          else if (child.status === 'downloading') segmentColor = 'bg-accent animate-pulse';
          else if (child.status === 'paused') segmentColor = 'bg-amber-500';

          return (
            <div
              key={child.id || i}
              className={`flex-1 h-full rounded-[2px] transition-all duration-300 ${segmentColor}`}
              title={`${child.indexInGroup || i + 1}. ${child.title} (${child.status})`}
            />
          );
        })}
      </div>

      {/* Inset Child List (C2: Expanded List) */}
      {!isCollapsed && (
        <div className="bg-inset rounded-[14px] p-2.5 sm:p-3 border border-border-subtle flex flex-col gap-1 transition-all">
          {/* Multi-select Action Bar (C4) */}
          {selectedChildIds.size > 0 && (
            <div className="flex items-center justify-between px-3 py-2 mb-1 rounded-[10px] bg-surface border border-accent/30 text-xs font-semibold animate-in fade-in">
              <span className="text-foreground">
                {selectedChildIds.size} of {totalCount} items selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBatchStartNow}
                  className="px-2.5 py-1 rounded-[6px] bg-accent text-[#1A0805] hover:opacity-90 font-bold"
                >
                  Start now
                </button>
                <button
                  type="button"
                  onClick={handleBatchRetry}
                  className="px-2.5 py-1 rounded-[6px] bg-surface hover:bg-surface-hover border border-border text-foreground"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={handleBatchRemove}
                  className="px-2.5 py-1 rounded-[6px] bg-status-danger/10 text-status-danger hover:bg-status-danger/20 border border-status-danger/20"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedChildIds(new Set())}
                  className="px-2 py-1 text-foreground-muted hover:text-foreground"
                >
                  Deselect all
                </button>
              </div>
            </div>
          )}

          {/* Child Rows */}
          {visibleChildren.map((child, idx) => {
            const childIdx = child.indexInGroup || idx + 1;
            const isDone = child.status === 'done' || child.status === 'warning';
            const isDownloading = child.status === 'downloading';
            const isWaiting = child.status === 'waiting';
            const isPaused = child.status === 'paused';
            const isFailed = child.status === 'failed';
            const isSelected = selectedChildIds.has(child.id);

            const sizeMb = child.sizeBytes ? `${(child.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : '';

            return (
              <div
                key={child.id}
                className={`flex flex-col gap-1 px-2.5 py-2 rounded-[10px] hover:bg-surface/50 text-xs transition-colors border ${
                  isSelected ? 'bg-surface/80 border-accent/40' : 'border-transparent'
                }`}
                data-testid={`playlist-row-${childIdx}`}
              >
                <div className="flex items-center gap-3 min-h-[36px]">
                  {/* C4 Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectChild(child.id)}
                    className="w-3.5 h-3.5 rounded border border-border accent-accent cursor-pointer flex-none"
                    aria-label={`Select video ${childIdx}`}
                  />

                  {/* Index zero-padded */}
                  <span className="font-mono text-foreground-muted/70 w-6 flex-none text-[11px]">
                    {childIdx.toString().padStart(2, '0')}
                  </span>

                  {/* Status Indicator Icon */}
                  <div className="flex-none w-4 flex items-center justify-center">
                    {isDone && <CheckIcon size={14} className="text-status-success" strokeWidth={2.5} />}
                    {isDownloading && (
                      <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    )}
                    {isWaiting && (
                      <div className="w-3.5 h-3.5 rounded-full border border-foreground-muted/40" />
                    )}
                    {isPaused && (
                      <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                    )}
                    {isFailed && (
                      <span className="text-status-danger font-bold text-sm">!</span>
                    )}
                  </div>

                  {/* Child Title (Unicode / Hindi must render) */}
                  <span
                    className={`flex-1 truncate ${
                      isDone
                        ? 'text-foreground'
                        : isDownloading
                          ? 'text-foreground font-semibold'
                          : isFailed
                            ? 'text-status-danger'
                            : 'text-foreground-muted'
                    }`}
                    title={child.title}
                  >
                    {child.title}
                  </span>

                  {/* Right Progress / Status Text / Inline Actions */}
                  <div className="flex items-center gap-2 flex-none font-mono">
                    {/* Active Download Progress Bar & Speed */}
                    {isDownloading && (
                      <div className="flex items-center gap-2">
                        <div className="w-20 sm:w-28">
                          <ProgressBar progress={child.progress.percent} height={4} isDownloading />
                        </div>
                        <span className="text-foreground text-[11px] font-semibold">
                          {child.progress.percent}% {child.progress.speed && child.progress.speed !== '—' ? `· ${child.progress.speed}` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => onPauseItem(child.id)}
                          aria-label="Pause item"
                          title="Pause"
                          className="w-6 h-6 rounded bg-surface border border-border text-foreground hover:bg-surface-hover flex items-center justify-center"
                        >
                          <PauseIcon size={11} />
                        </button>
                      </div>
                    )}

                    {/* Done Row Status + Size + Open folder + Play */}
                    {isDone && (
                      <div className="flex items-center gap-2">
                        {sizeMb && <span className="text-foreground-muted text-[11px]">{sizeMb}</span>}
                        <span className="text-status-success font-semibold text-[11px]">
                          Done
                        </span>
                        {child.filePath && (
                          <button
                            type="button"
                            onClick={() => onShowInFolder(child.filePath!)}
                            aria-label="Open folder"
                            title="Open folder"
                            className="p-1 rounded text-foreground-muted hover:text-foreground hover:bg-surface"
                          >
                            <FolderIcon size={13} />
                          </button>
                        )}
                        {child.filePath && (
                          <button
                            type="button"
                            onClick={() => onPlay(child.filePath!)}
                            aria-label="Play file"
                            title="Play"
                            className="p-1 rounded text-foreground-muted hover:text-foreground hover:bg-surface"
                          >
                            <PlayIcon size={13} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Waiting Row Actions */}
                    {isWaiting && (
                      <div className="flex items-center gap-2">
                        <span className="text-foreground-muted text-[11px]">Waiting</span>
                        <button
                          type="button"
                          onClick={() => onStartNowItem(child.id)}
                          aria-label="Start item now"
                          title="Start now"
                          className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] text-foreground hover:bg-surface-hover font-sans font-medium"
                        >
                          Start now
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(child.id)}
                          aria-label="Remove item"
                          title="Remove"
                          className="p-1 rounded text-foreground-muted hover:text-status-danger"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Paused Row Actions */}
                    {isPaused && (
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-semibold text-[11px]">Paused</span>
                        <button
                          type="button"
                          onClick={() => onResumeItem(child.id)}
                          aria-label="Resume item"
                          title="Resume"
                          className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] text-foreground hover:bg-surface-hover font-sans font-medium"
                        >
                          Resume
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(child.id)}
                          aria-label="Remove item"
                          title="Remove"
                          className="p-1 rounded text-foreground-muted hover:text-status-danger"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Failed Row Actions & Retry (C2) */}
                    {isFailed && (
                      <div className="flex items-center gap-2">
                        <span className="text-status-danger font-semibold text-[11px]">Failed</span>
                        <button
                          type="button"
                          onClick={() => onRetryItem(child.id)}
                          aria-label="Retry item"
                          title="Retry this download"
                          className="h-6 px-2 rounded bg-surface border border-status-danger/40 text-status-danger hover:bg-status-danger/10 text-[11px] font-sans font-medium flex items-center gap-1"
                        >
                          <RefreshCwIcon size={11} />
                          <span>Retry</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedErrorId(expandedErrorId === child.id ? null : child.id)}
                          aria-label="View error details"
                          title="Error details"
                          className="p-1 rounded text-foreground-muted hover:text-foreground text-[11px]"
                        >
                          ⓘ
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(child.id)}
                          aria-label="Remove failed item"
                          title="Remove"
                          className="p-1 rounded text-foreground-muted hover:text-status-danger"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Failed Item One-Line Error and Stderr Details Accordion (C2) */}
                {isFailed && (
                  <div className="pl-9 pr-2 text-[11px] text-status-danger/90 font-sans flex items-center justify-between">
                    <span className="truncate" title={child.error}>
                      {child.error || 'Download failed'}
                    </span>
                    {child.stderrTail && child.stderrTail.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleCopyStderr(child.id, child.stderrTail)}
                        className="text-[10px] text-foreground-muted hover:text-foreground flex items-center gap-1 flex-none underline ml-2"
                      >
                        <CopyIcon size={10} />
                        <span>{copiedId === child.id ? 'Copied!' : 'Copy details'}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Expanded Stderr Details Box */}
                {expandedErrorId === child.id && child.stderrTail && child.stderrTail.length > 0 && (
                  <div className="mt-1 ml-9 mr-2 p-2 rounded bg-[#0B0C10] border border-border text-[10px] font-mono text-foreground-muted overflow-x-auto max-h-32">
                    <pre className="whitespace-pre-wrap">{child.stderrTail.join('\n')}</pre>
                  </div>
                )}
              </div>
            );
          })}

          {/* Inset Footer */}
          <div className="flex items-center justify-between pt-2 px-2 border-t border-border-subtle mt-1 text-xs">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedChildIds.size === childrenItems.length && childrenItems.length > 0}
                onChange={toggleSelectAll}
                className="w-3.5 h-3.5 rounded border border-border accent-accent cursor-pointer"
                aria-label="Select all videos in playlist"
              />
              <span className="text-foreground-muted font-mono text-[11px]">
                Select all ({childrenItems.length} videos)
              </span>
            </div>

            {childrenItems.length > 5 && (
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
