import React, { useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { HistoryIcon, SearchIcon, ScissorsIcon, TrashIcon, FolderIcon } from '../components/Icons';

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  platform: 'youtube' | 'instagram' | 'facebook';
  format: string;
  quality: string;
  duration: string;
  clipStart?: string;
  clipEnd?: string;
  filePath: string;
  fileSizeBytes: number;
  downloadedAt: number;
}

export const HistoryRoute: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'youtube' | 'instagram' | 'facebook'>('all');

  const handleClearHistory = () => {
    setHistoryItems([]);
    showToast('Download history cleared', 'info');
  };

  const filteredItems = historyItems.filter((item) => {
    const matchesQuery = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
            <Card key={item.id} className="p-4 bg-[#14161D] border-border-strong flex items-center justify-between">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-sm font-semibold text-foreground truncate">{item.title}</span>
                <span className="text-xs text-foreground-muted">{item.quality} · {item.format} · {item.duration}</span>
              </div>
              <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
                <FolderIcon size={14} />
                <span>Show in folder</span>
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
