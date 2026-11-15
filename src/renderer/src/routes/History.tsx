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
  FacebookIcon,
  ChevronDownIcon,
  CheckIcon
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
  groupId?: string;
  groupTitle?: string;
  indexInGroup?: number;
  totalInGroup?: number;
}

interface HistoryGroup {
  groupId: string;
  groupTitle: string;
  platform: 'youtube' | 'instagram' | 'facebook';
  format: string;
  quality: string;
  items: HistoryRecord[];
  totalSizeBytes: number;
  downloadedAt: number;
  folderPath: string;
}

export const HistoryRoute: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const [historyItems, setHistoryItems] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'youtube' | 'instagram' | 'facebook'>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

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

  const handleRemoveGroup = async (ids: string[]) => {
    try {
      for (const id of ids) {
        if (window.api?.removeHistoryItem) {
          await window.api.removeHistoryItem(id);
        }
      }
      setHistoryItems((prev) => prev.filter((i) => !ids.includes(i.id)));
      showToast('Playlist removed from history', 'info');
    } catch {
      showToast('Failed to remove playlist from history', 'error');
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

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
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

  // Filter items
  const filteredItems = historyItems.filter((item) => {
    const matchesQuery =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.groupTitle && item.groupTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPlatform = platformFilter === 'all' || item.platform === platformFilter;
    return matchesQuery && matchesPlatform;
  });

  // Group items: assemble playlists/shorts into HistoryGroup and keep standalone items separate
  type HistoryEntry =
    | { type: 'single'; record: HistoryRecord }
    | { type: 'group'; group: HistoryGroup };

  const groupedEntries: HistoryEntry[] = [];
  const groupMap = new Map<string, HistoryGroup>();

  for (const item of filteredItems) {
    if (item.groupId) {
      if (!groupMap.has(item.groupId)) {
        // Derive folder path
        let dir = '';
        if (item.filePath) {
          const parts = item.filePath.split(/[/\\]/);
          parts.pop();
          dir = parts.join('\\');
        }
        const group: HistoryGroup = {
          groupId: item.groupId,
          groupTitle: item.groupTitle || 'Playlist',
          platform: item.platform,
          format: item.format,
          quality: item.quality,
          items: [item],
          totalSizeBytes: item.fileSizeBytes || 0,
          downloadedAt: item.downloadedAt,
          folderPath: dir || item.filePath
        };
        groupMap.set(item.groupId, group);
        groupedEntries.push({ type: 'group', group });
      } else {
        const group = groupMap.get(item.groupId)!;
        group.items.push(item);
        group.totalSizeBytes += item.fileSizeBytes || 0;
        if (item.downloadedAt > group.downloadedAt) {
          group.downloadedAt = item.downloadedAt;
        }
      }
    } else {
      groupedEntries.push({ type: 'single', record: item });
    }
  }

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
            Review completed clips and playlists, check file sizes, and jump directly to files on disk.
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
      {groupedEntries.length === 0 ? (
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
        <div className="flex flex-col gap-4">
          {groupedEntries.map((entry) => {
            if (entry.type === 'single') {
              const item = entry.record;
              return (
                <Card
                  key={item.id}
                  className="p-5 bg-[#14161D] border-border-strong flex flex-col gap-3 shadow-sm hover:border-border-muted transition-colors rounded-[18px]"
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
                        className="text-foreground-muted hover:text-status-danger p-1.5"
                        aria-label="Remove from history"
                      >
                        <TrashIcon size={13} />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            }

            // Playlist / Shorts Group Card (Matching Image 4 System)
            const group = entry.group;
            const isCollapsed = Boolean(collapsedGroups[group.groupId]);
            const childIds = group.items.map((i) => i.id);

            return (
              <div
                key={group.groupId}
                className="rounded-[18px] bg-[#14161D] border border-border-strong overflow-hidden shadow-sm transition-all"
              >
                {/* Playlist Group Header */}
                <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Stack Icon */}
                    <div className="w-10 h-10 rounded-[12px] bg-[#1B1E27] border border-border flex items-center justify-center text-foreground flex-none">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 2 7 12 12 22 7 12 2" />
                        <polyline points="2 17 12 22 22 17" />
                        <polyline points="2 12 12 17 22 12" />
                      </svg>
                    </div>

                    {/* Title & Badges */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="font-display font-semibold text-base sm:text-lg text-foreground truncate" title={group.groupTitle}>
                          {group.groupTitle}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-[#2A1B19] text-[#FF8C7E] text-[11px] font-semibold flex items-center gap-1">
                          {getPlatformIcon(group.platform)}
                          <span>YouTube</span>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#1B1E27] text-foreground-muted text-[11px] font-medium">
                          Playlist
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#1B1E27] text-foreground-muted text-[11px] font-mono font-medium">
                          {group.format} · {group.quality}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#12261D] text-[#34D399] text-[11px] font-medium">
                          Finished
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-foreground-muted">
                        <span>{group.items.length} downloaded</span>
                        <span>·</span>
                        <span className="font-mono">{formatBytes(group.totalSizeBytes)}</span>
                        <span>·</span>
                        <span className="font-mono">{formatDate(group.downloadedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Header Actions */}
                  <div className="flex items-center gap-3 flex-none">
                    <span className="font-display font-bold text-lg sm:text-xl text-foreground">
                      100%
                    </span>
                    <button
                      type="button"
                      onClick={() => handleShowInFolder(group.folderPath)}
                      aria-label="Open playlist folder"
                      title="Open playlist folder"
                      className="p-2 rounded-[10px] bg-[#1B1E27] border border-border text-foreground hover:bg-[#222632] transition-colors"
                    >
                      <FolderIcon size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveGroup(childIds)}
                      aria-label="Remove entire playlist from history"
                      title="Remove entire playlist from history"
                      className="p-2 rounded-[10px] bg-[#1B1E27] border border-border text-foreground-muted hover:text-status-danger transition-colors"
                    >
                      <TrashIcon size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapse(group.groupId)}
                      aria-label={isCollapsed ? 'Expand playlist' : 'Collapse playlist'}
                      title={isCollapsed ? 'Expand' : 'Collapse'}
                      className="p-2 rounded-[10px] bg-[#1B1E27] border border-border text-foreground-muted hover:text-foreground transition-colors"
                    >
                      <ChevronDownIcon
                        size={14}
                        className={`transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Solid Completed Progress Line */}
                <div className="px-4 sm:px-5">
                  <div className="w-full h-1 bg-[#10B981] rounded-full" />
                </div>

                {/* Expanded Items List (Image 4 format) */}
                {!isCollapsed && (
                  <div className="p-4 sm:p-5 pt-3">
                    <div className="divide-y divide-border-subtle/50">
                      {group.items.map((item, idx) => {
                        const indexStr = (item.indexInGroup !== undefined ? item.indexInGroup + 1 : idx + 1)
                          .toString()
                          .padStart(2, '0');

                        return (
                          <div
                            key={item.id}
                            className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-[#1B1E27]/40 px-2 rounded-lg transition-colors group/row"
                          >
                            {/* Left: Index & Title */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="font-mono text-foreground-muted w-5 flex-none text-right text-[11px]">
                                {indexStr}
                              </span>
                              <span className="text-[#34D399] flex-none">
                                <CheckIcon size={13} strokeWidth={2.6} />
                              </span>
                              <span className="font-medium text-foreground truncate" title={item.title}>
                                {item.title}
                              </span>
                            </div>

                            {/* Right: File Size, Done, and Actions */}
                            <div className="flex items-center gap-3 flex-none">
                              <span className="font-mono text-foreground-muted text-[11px]">
                                {formatBytes(item.fileSizeBytes)}
                              </span>
                              <span className="text-[#34D399] font-medium text-[11px]">
                                Done
                              </span>
                              <button
                                type="button"
                                onClick={() => handleShowInFolder(item.filePath)}
                                aria-label="Show in folder"
                                title="Show in folder"
                                className="p-1 rounded text-foreground-muted hover:text-foreground transition-colors"
                              >
                                <FolderIcon size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenFile(item.filePath)}
                                aria-label="Play file"
                                title="Play file"
                                className="p-1 rounded text-foreground-muted hover:text-foreground transition-colors"
                              >
                                <PlayIcon size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                aria-label="Remove item"
                                title="Remove item"
                                className="p-1 rounded text-foreground-muted hover:text-status-danger transition-colors opacity-0 group-hover/row:opacity-100"
                              >
                                <TrashIcon size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Count */}
                    <div className="mt-3 pt-2 border-t border-border-subtle/50 flex items-center justify-between text-xs text-foreground-muted">
                      <span>{group.items.length} videos total</span>
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapse(group.groupId)}
                        className="text-accent hover:underline font-medium cursor-pointer"
                      >
                        Show less
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
