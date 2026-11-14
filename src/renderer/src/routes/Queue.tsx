import React, { useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { QueueIcon, ScissorsIcon, TrashIcon, DownloadIcon, PlayIcon, PauseIcon } from '../components/Icons';

export interface QueueItem {
  id: string;
  title: string;
  url: string;
  platform: 'youtube' | 'instagram' | 'facebook';
  format: string;
  quality: string;
  duration: string;
  progress: number;
  speed: string;
  eta: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'paused';
}

export const QueueRoute: React.FC = () => {
  const { navigate, queueCount, showToast } = useNavigation();
  // Queue items state (empty by default, zero hardcoded fake items)
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isQueuePaused, setIsQueuePaused] = useState(false);

  const handleClearCompleted = () => {
    setItems((prev) => prev.filter((item) => item.status !== 'completed'));
    showToast('Cleared completed items', 'info');
  };

  const handleTogglePause = () => {
    setIsQueuePaused((prev) => !prev);
    showToast(isQueuePaused ? 'Queue resumed' : 'Queue paused', 'info');
  };

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
            </span>
          </div>
          <p className="text-foreground-muted text-xs">
            Sequential downloads with automatic watchdog monitoring and verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Button
              variant="secondary"
              size="md"
              onClick={handleTogglePause}
              className="flex items-center gap-2"
            >
              {isQueuePaused ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
              <span>{isQueuePaused ? 'Resume all' : 'Pause all'}</span>
            </Button>
          )}

          <Button
            variant="secondary"
            size="md"
            disabled={items.filter((i) => i.status === 'completed').length === 0}
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
          {/* Active Queue Items Rendered here in P3 */}
          {items.map((item) => (
            <Card key={item.id} className="p-4 bg-[#14161D] border-border-strong flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{item.title}</div>
                <div className="text-xs text-foreground-muted">{item.quality} · {item.format}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
