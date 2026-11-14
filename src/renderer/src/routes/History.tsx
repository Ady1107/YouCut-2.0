import React, { useState, useEffect } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import {
  HistoryIcon,
  SearchIcon,
  ScissorsIcon,
  TrashIcon,
  FolderIcon,
  PlayIcon,
  YouTubeIcon,
  InstagramIcon,
  FacebookIcon
} from '../components/Icons';
import { secondsToMs } from '../utils/time';

export interface HistoryRecord {
  id: string;
  title: string;
  url: string;
  platform: 'youtube' | 'instagram' | 'facebook';
  format: string;
  quality: string;
  durationFormatted: string;
  durationSeconds: number;
  filePath: string;
  fileSizeBytes: number;
  downloadedAt: number;
  isFullVideo: boolean;
  startSec?: number;
  endSec?: number;
}

export const HistoryRoute: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [historyItems, setHistoryItems] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'youtube' | 'instagram' | 'facebook'>('all');

  const loadHistory = async () => {
    try {
      if (typeof window !== 'undefined' && window.api?.getHistory) {
        const records = await window.api.getHistory();
        setHistoryItems(records as HistoryRecord[]);
      }
    } catch (err) {
      console.error('[History] Failed to load history:', err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleClearHistory = async () => {
    try {
      if (window.api?.clearHistory) {
        await window.api.clearHistory();
        setHistoryItems([]);
        showToast('Download history cleared', 'info');
      }
    } catch {
      showToast('Failed to clear download history', 'error');
    }
  };

  const handleRemoveItem = async (id: string) => {
    try {
      if (window.api?.removeHistoryItem) {
        await window.api.removeHistoryItem(id);
        setHistoryItems((prev) => prev.filter((i) => i.id !== id));
        showToast('Item removed from history', 'info');
      }
    } catch {
      showToast('Failed to remove item', 'error');
    }
  };

  const handleShowInFolder = async (filePath: string) => {
    try {
      if (window.api?.openFolder) {
        const ok = await window.api.openFolder(filePath);
        if (!ok) showToast('File may have been moved or deleted', 'error');
      }
    } catch {
      showToast('Could not open folder', 'error');
    }
  };

  const handleOpenFile = async (filePath: string) => {
    try {
      if (window.api?.openFile) {
        const ok = await window.api.openFile(filePath);
        if (!ok) showToast('Could not play file (file may have been moved)', 'error');
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

  const formatDate = (timestamp: number): string => {
    if (!timestamp) return '—';
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPlatformIcon = (platform: string) => {
    if (platform === 'youtube') return <YouTubeIcon size={14} className="text-[#FF8C7E]" />;
    if (platform === 'instagram') return <InstagramIcon size={14} className="text-[#F28BB8]" />;
    return <FacebookIcon size={14} className="text-[#8DB4FF]" />;
  };

  const filteredItems = historyItems.filter((item) => {
    const matchesQuery =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = platformFilter === 'all' || item.platform === platformFilter;
    return matchesQuery && matchesPlatform;
  });

  return (
    <div className="flex-1 flex flex-col gap-6 p-8 overflow-y-auto max-w-5xl mx-auto w-full box-border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Download History
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#1B1E27] text-foreground-subtle text-xs font-semibold">
              {historyItems.length} {historyItems.length === 1 ? 'download' : 'downloads'}
            </span>
          </div>
          <p className="text-foreground-muted text-xs">
            Review completed clips, check file sizes, and jump directly to files on disk.
          </p>
        </div>

        <Button
          variant="secondary"
          size="md"
          disabled={historyItems.length === 0}
          onClick={handleClearHistory}
          className="flex items-center gap-2"
        >
          <TrashIcon size={14} />
          <span>Clear history</span>
        </Button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex items-center gap-3">
        <label className="flex-1 h-11 box-border flex items-center gap-3 px-3.5 rounded-[12px] bg-[#14161D] border border-border-strong focus-within:border-accent transition-colors">
          <SearchIcon size={16} className="text-foreground-muted flex-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search downloads by title or URL..."
            className="flex-1 bg-transparent border-0 outline-none text-foreground font-sans text-[13px] placeholder-foreground-muted"
          />
        </label>

        <div className="flex items-center p-1 rounded-[12px] bg-[#0F1116] border border-border">
          {(['all', 'youtube', 'instagram', 'facebook'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setPlatformFilter(filter)}
              className={`h-9 px-3 rounded-[10px] text-xs font-semibold capitalize transition-all ${
                platformFilter === filter
                  ? 'bg-accent text-[#1A0805] shadow-sm'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {filter === 'all' ? 'All' : filter}
            </button>
          ))}
        </div>
      </div>

      {/* History Items or Empty State */}
      {filteredItems.length === 0 ? (
        <Card className="p-12 bg-[#14161D] border-border-strong flex flex-col items-center justify-center text-center gap-4 my-auto">
          <div className="w-14 h-14 rounded-full bg-[#1B1E27] flex items-center justify-center text-foreground-muted">
            <HistoryIcon size={28} />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-display font-semibold text-lg text-foreground">
              No download history yet
            </h3>
            <p className="text-foreground-muted text-xs max-w-md leading-relaxed">
              Videos and audio clips you download will appear here with one-click access to open their folders or play them.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('youtube')}
            className="flex items-center gap-2 mt-2"
          >
            <ScissorsIcon size={16} />
            <span>Start Clipping</span>
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className="p-5 bg-[#14161D] border-border-strong flex flex-col gap-3 shadow-sm hover:border-border-muted transition-colors"
            >
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
                      {item.isFullVideo ? 'Full video' : `Clip ${secondsToMs(item.startSec || 0)} - ${secondsToMs(item.endSec || item.durationSeconds)}`}
                    </span>
                    <span className="text-xs text-foreground-muted font-mono">
                      · {formatBytes(item.fileSizeBytes)}
                    </span>
                    <span className="text-[11px] text-foreground-muted ml-auto font-mono">
                      {formatDate(item.downloadedAt)}
                    </span>
                  </div>

                  <h3 className="font-display font-semibold text-sm text-foreground truncate mt-0.5" title={item.title}>
                    {item.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border-subtle mt-1">
                <span className="text-[11px] font-mono text-foreground-muted truncate max-w-md" title={item.filePath}>
                  {item.filePath}
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleShowInFolder(item.filePath)}
                    className="flex items-center gap-1.5"
                  >
                    <FolderIcon size={12} />
                    <span>Show in folder</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenFile(item.filePath)}
                    className="flex items-center gap-1.5"
                  >
                    <PlayIcon size={12} />
                    <span>Play file</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-foreground-muted hover:text-status-error p-1.5"
                    aria-label="Remove from history"
                  >
                    <TrashIcon size={13} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
