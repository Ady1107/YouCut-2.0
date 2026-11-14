import React, { useState, useEffect } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import {
  QueueIcon,
  ScissorsIcon,
  TrashIcon,
  DownloadIcon,
  PlayIcon,
  PauseIcon,
  FolderIcon,
  YouTubeIcon,
  InstagramIcon,
  FacebookIcon,
  CheckIcon,
  RefreshCwIcon
} from '../components/Icons';
import { secondsToMs, secondsToHms } from '../utils/time';

export interface QueueItem {
  id: string;
  title: string;
  url: string;
  platform: 'youtube' | 'instagram' | 'facebook';
  thumbnail?: string;
  duration?: number;
  format: string;
  quality: string;
  startSec: number;
  endSec: number;
  isFullVideo: boolean;
  frameAccurate: boolean;
  saveFolder: string;
  fileName: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'paused' | 'warning';
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: string;
  eta: string;
  finalPath?: string;
  warning?: string;
  error?: string;
  addedAt: number;
}

export const QueueRoute: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [items, setItems] = useState<QueueItem[]>([]);

  // Fetch initial queue list and subscribe to updates
  useEffect(() => {
    if (typeof window !== 'undefined' && window.api?.getQueue) {
      window.api.getQueue().then((qItems) => {
        setItems(qItems as QueueItem[]);
      }).catch((err) => console.error('Failed to get queue:', err));
    }

    if (typeof window !== 'undefined' && window.api?.onQueueUpdate) {
      const unsubUpdate = window.api.onQueueUpdate((qItems) => {
        setItems(qItems as QueueItem[]);
      });
      return unsubUpdate;
    }
  }, []);

  // Subscribe to real-time download progress
  useEffect(() => {
    if (typeof window !== 'undefined' && window.api?.onQueueProgress) {
      const unsubProgress = window.api.onQueueProgress((data) => {
        setItems((prev) =>
          prev.map((item) =>
            item.id === data.id
              ? {
                  ...item,
                  progress: data.progress,
                  speed: data.speed,
                  eta: data.eta,
                  downloadedBytes: data.downloadedBytes,
                  totalBytes: data.totalBytes
                }
              : item
          )
        );
      });
      return unsubProgress;
    }
  }, []);

  const handlePauseItem = async (id: string) => {
    try {
      if (window.api?.pauseQueueItem) {
        await window.api.pauseQueueItem(id);
        showToast('Download paused (.part file preserved)', 'info');
      }
    } catch {
      showToast('Failed to pause download', 'error');
    }
  };

  const handleResumeItem = async (id: string) => {
    try {
      if (window.api?.resumeQueueItem) {
        await window.api.resumeQueueItem(id);
        showToast('Resuming download...', 'info');
      }
    } catch {
      showToast('Failed to resume download', 'error');
    }
  };

  const handleCancelItem = async (id: string) => {
    try {
      if (window.api?.cancelQueueItem) {
        await window.api.cancelQueueItem(id);
        showToast('Download cancelled and partial files removed', 'info');
      }
    } catch {
      showToast('Failed to cancel download', 'error');
    }
  };

  const handleClearCompleted = async () => {
    try {
      if (window.api?.clearCompletedQueue) {
        await window.api.clearCompletedQueue();
        showToast('Cleared completed items from queue', 'info');
      }
    } catch {
      showToast('Failed to clear completed items', 'error');
    }
  };

  const handleShowInFolder = async (filePath?: string) => {
    if (!filePath) return;
    try {
      if (window.api?.openFolder) {
        const ok = await window.api.openFolder(filePath);
        if (!ok) showToast('Could not open folder (file may have been moved)', 'error');
      }
    } catch {
      showToast('Could not open folder', 'error');
    }
  };

  const handleOpenFile = async (filePath?: string) => {
    if (!filePath) return;
    try {
      if (window.api?.openFile) {
        const ok = await window.api.openFile(filePath);
        if (!ok) showToast('Could not open file (file may have been moved)', 'error');
      }
    } catch {
      showToast('Could not play file', 'error');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getPlatformIcon = (platform: string) => {
    if (platform === 'youtube') return <YouTubeIcon size={13} className="text-[#FF5B4A]" />;
    if (platform === 'instagram') return <InstagramIcon size={13} className="text-[#E1306C]" />;
    return <FacebookIcon size={13} className="text-[#1877F2]" />;
  };

  const completedCount = items.filter((i) => i.status === 'completed' || i.status === 'warning').length;
  const activeCount = items.filter((i) => i.status === 'downloading' || i.status === 'queued').length;

  return (
    <div className="flex-1 flex flex-col gap-6 p-6 sm:p-8 overflow-y-auto max-w-5xl mx-auto w-full box-border">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Download Queue
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-surface border border-border text-foreground-subtle text-xs font-semibold">
              {items.length} {items.length === 1 ? 'item' : 'items'}
              {activeCount > 0 ? ` · ${activeCount} active` : ''}
            </span>
          </div>
          <p className="text-foreground-muted text-xs">
            Sequential downloads with automatic watchdog monitoring and verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClearCompleted}
              className="flex items-center gap-1.5"
            >
              <TrashIcon size={14} />
              <span>Clear completed ({completedCount})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Queue Body */}
      {items.length === 0 ? (
        <Card className="p-12 bg-card border-border-strong flex flex-col items-center justify-center text-center gap-4 my-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center text-foreground-muted">
            <QueueIcon size={32} />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-display font-semibold text-lg text-foreground">
              Your download queue is empty
            </h3>
            <p className="text-foreground-muted text-xs max-w-md leading-relaxed">
              When you clip videos or add downloads from YouTube, Instagram, or Facebook, they will appear here and process sequentially with high-speed fragments.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('youtube')}
            className="flex items-center gap-2 mt-2 shadow-md hover:scale-[1.02] transition-transform"
          >
            <ScissorsIcon size={16} />
            <span>Clip a video</span>
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3.5">
          {items.map((item, index) => {
            const isDownloading = item.status === 'downloading';
            const isQueued = item.status === 'queued';
            const isPaused = item.status === 'paused';
            const isCompleted = item.status === 'completed';
            const isWarning = item.status === 'warning';
            const isFailed = item.status === 'failed';
            const clipDurationSec = Math.max(0, item.endSec - item.startSec);

            return (
              <Card
                key={item.id}
                className="p-4 sm:p-5 bg-card border-border-strong flex flex-col gap-4 shadow-sm hover:border-border-muted transition-all rounded-[16px]"
              >
                {/* Top Row: Thumbnail + Details + Status Badge */}
                <div className="flex items-start gap-4">
                  {/* Visual Thumbnail */}
                  <div className="relative w-28 sm:w-36 h-18 sm:h-20 rounded-[10px] overflow-hidden bg-surface flex-none border border-border-subtle shadow-sm group">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Hide broken image and fallback to placeholder
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface to-surface-elevated text-foreground-muted">
                        <DownloadIcon size={24} className="opacity-40" />
                      </div>
                    )}

                    {/* Duration badge overlay */}
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-[4px] bg-black/80 backdrop-blur-sm text-[10px] font-mono text-white font-semibold select-none shadow">
                      {item.isFullVideo
                        ? secondsToMs(item.duration || item.endSec)
                        : secondsToMs(clipDurationSec)}
                    </div>

                    {/* Platform icon chip overlay */}
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center shadow">
                      {getPlatformIcon(item.platform)}
                    </div>
                  </div>

                  {/* Title and Metadata */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    {/* Metadata tags */}
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-surface border border-border flex items-center gap-1.5 text-[11px] font-semibold text-foreground-subtle capitalize">
                        {getPlatformIcon(item.platform)}
                        <span>{item.platform}</span>
                      </span>

                      <span className="px-2 py-0.5 rounded-[6px] bg-surface text-foreground-subtle text-[11px] font-mono font-medium border border-border-subtle">
                        {item.format} · {item.quality}
                      </span>

                      {item.isFullVideo ? (
                        <span className="px-2 py-0.5 rounded-full bg-surface text-foreground-muted text-[11px] font-medium border border-border-subtle">
                          Full video
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--accent-tint)] text-[var(--accent-tint-text)] text-[11px] font-mono font-semibold border border-accent/20 flex items-center gap-1">
                          <ScissorsIcon size={11} />
                          <span>{secondsToMs(item.startSec)} → {secondsToMs(item.endSec)} ({clipDurationSec}s)</span>
                        </span>
                      )}

                      {item.frameAccurate && !item.isFullVideo && (
                        <span className="px-2 py-0.5 rounded-[6px] bg-surface text-foreground-muted text-[10px] font-mono border border-border-subtle">
                          Frame-accurate
                        </span>
                      )}
                    </div>

                    {/* Video Title */}
                    <h3
                      className="font-display font-semibold text-sm sm:text-base text-foreground truncate select-text"
                      title={item.title}
                    >
                      {item.title}
                    </h3>

                    {/* Save Path */}
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-foreground-muted truncate select-text">
                      <FolderIcon size={12} className="flex-none opacity-60" />
                      <span className="truncate">{item.finalPath || item.saveFolder}</span>
                    </div>
                  </div>

                  {/* Status Badge (Right) */}
                  <div className="flex items-center gap-2 flex-none">
                    {isDownloading && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-semibold shadow-[0_0_12px_rgba(255,91,74,0.2)] animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                        <span>Downloading {item.progress}%</span>
                      </span>
                    )}

                    {isQueued && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-foreground-subtle text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-foreground-muted" />
                        <span>Queued · #{index + 1} in line</span>
                      </span>
                    )}

                    {isPaused && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2A2318] text-[#F5A623] border border-[#F5A623]/25 text-xs font-semibold">
                        <PauseIcon size={12} />
                        <span>Paused</span>
                      </span>
                    )}

                    {isCompleted && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#182A20] text-[#3DDC97] border border-[#3DDC97]/25 text-xs font-semibold">
                        <CheckIcon size={12} strokeWidth={2.5} />
                        <span>Completed</span>
                      </span>
                    )}

                    {isWarning && (
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2A2318] text-[#F5A623] border border-[#F5A623]/25 text-xs font-semibold"
                        title={item.warning}
                      >
                        <span>Warning</span>
                      </span>
                    )}

                    {isFailed && (
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2A1819] text-[#E5484D] border border-[#E5484D]/25 text-xs font-semibold"
                        title={item.error}
                      >
                        <span>Failed</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Modern Glowing Download Progress Bar */}
                {(isDownloading || isPaused || isQueued) && (
                  <div className="flex flex-col gap-2 pt-1">
                    {/* The Track */}
                    <div className="w-full h-2.5 rounded-full bg-[#0A0B0E] border border-border-subtle p-0.5 overflow-hidden shadow-inner relative">
                      {isQueued ? (
                        <div className="h-full w-full rounded-full bg-surface relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/30 to-transparent animate-pulse" />
                        </div>
                      ) : (
                        <div
                          className={`h-full rounded-full transition-all duration-300 relative ${
                            isPaused
                              ? 'bg-gradient-to-r from-[#F5A623] to-[#F7BA55]'
                              : 'bg-gradient-to-r from-accent via-[#FF7B6E] to-[#FFA07A] shadow-[0_0_12px_rgba(255,91,74,0.4)]'
                          }`}
                          style={{ width: `${Math.max(item.progress, 2)}%` }}
                        />
                      )}
                    </div>

                    {/* Progress Metrics Row */}
                    <div className="flex items-center justify-between text-xs font-mono text-foreground-muted px-0.5">
                      <div className="flex items-center gap-2">
                        {isDownloading ? (
                          item.downloadedBytes > 0 ? (
                            <span className="text-foreground-subtle font-medium">
                              {formatBytes(item.downloadedBytes)} / {formatBytes(item.totalBytes)}
                            </span>
                          ) : (
                            <span>Starting fragments...</span>
                          )
                        ) : isPaused ? (
                          <span>Download paused ({formatBytes(item.downloadedBytes)} saved)</span>
                        ) : (
                          <span>Waiting in queue...</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {isDownloading && (
                          <span className="font-bold text-accent">
                            {item.progress}%
                          </span>
                        )}

                        {isDownloading && item.speed && item.speed !== '—' && (
                          <span className="text-foreground-subtle">
                            ⚡ {item.speed}
                          </span>
                        )}

                        {isDownloading && item.eta && item.eta !== '—' && (
                          <span className="text-foreground-muted">
                            ETA {item.eta}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Warning details banner */}
                {isWarning && item.warning && (
                  <div className="text-xs text-[#F5A623] bg-[#2A2318]/60 p-3 rounded-[10px] border border-[#F5A623]/30">
                    <span className="font-semibold">Note:</span> {item.warning}
                  </div>
                )}

                {/* Error details banner */}
                {isFailed && item.error && (
                  <div className="text-xs text-[#E5484D] bg-[#2A1819]/60 p-3 rounded-[10px] border border-[#E5484D]/30 line-clamp-3">
                    <span className="font-semibold">Error:</span> {item.error}
                  </div>
                )}

                {/* Bottom Action Controls */}
                <div className="flex items-center justify-between pt-2.5 border-t border-border-subtle">
                  <div className="text-[11px] text-foreground-muted">
                    {new Date(item.addedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  <div className="flex items-center gap-2">
                    {isDownloading && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handlePauseItem(item.id)}
                        className="flex items-center gap-1.5"
                      >
                        <PauseIcon size={13} />
                        <span>Pause</span>
                      </Button>
                    )}

                    {isPaused && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleResumeItem(item.id)}
                        className="flex items-center gap-1.5 text-accent hover:border-accent"
                      >
                        <PlayIcon size={13} />
                        <span>Resume</span>
                      </Button>
                    )}

                    {(isDownloading || isQueued || isPaused) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelItem(item.id)}
                        className="text-foreground-muted hover:text-status-error hover:bg-surface"
                      >
                        Cancel
                      </Button>
                    )}

                    {(isCompleted || isWarning) && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleShowInFolder(item.finalPath)}
                          className="flex items-center gap-1.5"
                        >
                          <FolderIcon size={13} />
                          <span>Show in folder</span>
                        </Button>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenFile(item.finalPath)}
                          className="flex items-center gap-1.5 shadow-sm"
                        >
                          <PlayIcon size={13} />
                          <span>Play</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelItem(item.id)}
                          className="text-foreground-muted hover:text-foreground"
                          title="Remove from queue"
                        >
                          <TrashIcon size={13} />
                        </Button>
                      </>
                    )}

                    {isFailed && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleResumeItem(item.id)}
                          className="flex items-center gap-1.5 text-accent"
                        >
                          <RefreshCwIcon size={13} />
                          <span>Retry</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelItem(item.id)}
                          className="text-foreground-muted hover:text-status-error"
                        >
                          Remove
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
