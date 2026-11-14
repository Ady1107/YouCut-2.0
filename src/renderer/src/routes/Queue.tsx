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
import { secondsToMs } from '../utils/time';

export interface QueueItem {
  id: string;
  title: string;
  url: string;
  platform: 'youtube' | 'instagram' | 'facebook';
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
    if (platform === 'youtube') return <YouTubeIcon size={14} className="text-[#FF8C7E]" />;
    if (platform === 'instagram') return <InstagramIcon size={14} className="text-[#F28BB8]" />;
    return <FacebookIcon size={14} className="text-[#8DB4FF]" />;
  };

  const completedCount = items.filter((i) => i.status === 'completed' || i.status === 'warning').length;
  const activeCount = items.filter((i) => i.status === 'downloading' || i.status === 'queued').length;

  return (
    <div className="flex-1 flex flex-col gap-6 p-8 overflow-y-auto max-w-5xl mx-auto w-full box-border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Download Queue
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#1B1E27] text-foreground-subtle text-xs font-semibold">
              {items.length} {items.length === 1 ? 'item' : 'items'}
              {activeCount > 0 ? ` (${activeCount} active)` : ''}
            </span>
          </div>
          <p className="text-foreground-muted text-xs">
            Sequential downloads with automatic watchdog monitoring and verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            disabled={completedCount === 0}
            onClick={handleClearCompleted}
            className="flex items-center gap-2"
          >
            <TrashIcon size={14} />
            <span>Clear completed</span>
          </Button>
        </div>
      </div>

      {/* Queue Body */}
      {items.length === 0 ? (
        <Card className="p-12 bg-[#14161D] border-border-strong flex flex-col items-center justify-center text-center gap-4 my-auto">
          <div className="w-14 h-14 rounded-full bg-[#1B1E27] flex items-center justify-center text-foreground-muted">
            <QueueIcon size={28} />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-display font-semibold text-lg text-foreground">
              Your download queue is empty
            </h3>
            <p className="text-foreground-muted text-xs max-w-md leading-relaxed">
              When you clip videos or add full downloads from YouTube, Instagram, or Facebook, they will appear here and process sequentially.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('youtube')}
            className="flex items-center gap-2 mt-2"
          >
            <ScissorsIcon size={16} />
            <span>Clip a video</span>
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const isDownloading = item.status === 'downloading';
            const isQueued = item.status === 'queued';
            const isPaused = item.status === 'paused';
            const isCompleted = item.status === 'completed';
            const isWarning = item.status === 'warning';
            const isFailed = item.status === 'failed';

            return (
              <Card
                key={item.id}
                className="p-5 bg-[#14161D] border-border-strong flex flex-col gap-3 shadow-sm hover:border-border-muted transition-colors"
              >
                {/* Item Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-[#1B1E27] border border-border flex items-center gap-1.5 text-[11px] font-semibold text-foreground-subtle capitalize">
                        {getPlatformIcon(item.platform)}
                        <span>{item.platform}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#1B1E27] text-foreground-muted text-[11px] font-mono font-medium">
                        {item.format} · {item.quality}
                      </span>
                      <span className="text-xs text-foreground-muted">
                        {item.isFullVideo ? 'Full video' : `Clip ${secondsToMs(item.startSec)} - ${secondsToMs(item.endSec)}`}
                      </span>
                    </div>

                    <h3 className="font-display font-semibold text-sm text-foreground truncate mt-0.5" title={item.title}>
                      {item.title}
                    </h3>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2 flex-none">
                    {isDownloading && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2A1B19] text-[#FF8C7E] text-xs font-semibold animate-pulse border border-accent/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                        Downloading {item.progress}%
                      </span>
                    )}
                    {isQueued && (
                      <span className="px-3 py-1 rounded-full bg-[#1B1E27] text-foreground-muted text-xs font-medium">
                        Queued
                      </span>
                    )}
                    {isPaused && (
                      <span className="px-3 py-1 rounded-full bg-[#2A2318] text-[#F5A623] text-xs font-medium">
                        Paused
                      </span>
                    )}
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#182A20] text-[#3DDC97] text-xs font-semibold">
                        <CheckIcon size={12} strokeWidth={2.5} />
                        Completed
                      </span>
                    )}
                    {isWarning && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2A2318] text-[#F5A623] text-xs font-semibold" title={item.warning}>
                        Completed with warning
                      </span>
                    )}
                    {isFailed && (
                      <span className="px-3 py-1 rounded-full bg-[#2A1819] text-[#E5484D] text-xs font-semibold" title={item.error}>
                        Failed
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar (when active or downloading or paused) */}
                {(isDownloading || isPaused || isQueued) && (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="w-full h-2 rounded-full bg-[#0F1116] overflow-hidden border border-border-subtle">
                      <div
                        className={`h-full transition-all duration-300 ${isPaused ? 'bg-[#F5A623]' : 'bg-accent'}`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-foreground-muted">
                      <span>
                        {item.downloadedBytes > 0
                          ? `${formatBytes(item.downloadedBytes)} of ${formatBytes(item.totalBytes)}`
                          : isDownloading ? 'Initializing download...' : 'Waiting in line'}
                      </span>
                      <span>
                        {item.speed && item.speed !== '—' ? `${item.speed} · ETA ${item.eta}` : ''}
                      </span>
                    </div>
                  </div>
                )}

                {/* Warning / Error Message details */}
                {isWarning && item.warning && (
                  <div className="text-xs text-[#F5A623] bg-[#2A2318]/50 p-2.5 rounded-[8px] border border-[#F5A623]/20">
                    {item.warning}
                  </div>
                )}
                {isFailed && item.error && (
                  <div className="text-xs text-[#E5484D] bg-[#2A1819]/50 p-2.5 rounded-[8px] border border-[#E5484D]/20 line-clamp-2">
                    {item.error}
                  </div>
                )}

                {/* Item Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-border-subtle mt-1">
                  <div className="text-[11px] font-mono text-foreground-muted truncate max-w-md">
                    {item.finalPath || item.saveFolder}
                  </div>

                  <div className="flex items-center gap-2">
                    {isDownloading && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handlePauseItem(item.id)}
                        className="flex items-center gap-1.5"
                      >
                        <PauseIcon size={12} />
                        <span>Pause</span>
                      </Button>
                    )}

                    {isPaused && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleResumeItem(item.id)}
                        className="flex items-center gap-1.5 text-accent"
                      >
                        <PlayIcon size={12} />
                        <span>Resume</span>
                      </Button>
                    )}

                    {(isDownloading || isQueued || isPaused) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelItem(item.id)}
                        className="text-foreground-muted hover:text-status-error"
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
                          <FolderIcon size={12} />
                          <span>Show in folder</span>
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenFile(item.finalPath)}
                          className="flex items-center gap-1.5"
                        >
                          <PlayIcon size={12} />
                          <span>Play</span>
                        </Button>
                      </>
                    )}

                    {isFailed && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleResumeItem(item.id)}
                        className="flex items-center gap-1.5 text-accent"
                      >
                        <RefreshCwIcon size={12} />
                        <span>Retry</span>
                      </Button>
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
