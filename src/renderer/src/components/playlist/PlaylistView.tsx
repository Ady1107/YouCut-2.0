import React, { useState, useEffect, useMemo } from 'react';
import { PlaylistInfo, QueueGroup, QueueItem } from '../../../../shared/types';
import { Card } from '../Card';
import { Button } from '../Button';
import { Chip } from '../Chip';
import { SegmentedToggle } from '../SegmentedToggle';
import { SwitchRow } from './SwitchRow';
import { PlaylistList } from './PlaylistList';
import { DownloadIcon, CheckIcon, FolderIcon } from '../Icons';
import { useQueue } from '../../context/QueueContext';
import { useNavigation } from '../../context/NavigationContext';
import { sanitizeFilename } from '../../utils/filename';

export interface PlaylistViewProps {
  playlistInfo: PlaylistInfo;
  playlistUrl: string;
  defaultSaveFolder: string;
  className?: string;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlistInfo,
  playlistUrl,
  defaultSaveFolder,
  className = ''
}) => {
  const { addGroup } = useQueue();
  const { navigate, showToast } = useNavigation();

  // Selection state: set of 1-based indices
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    playlistInfo.entries.forEach((e) => {
      if (e.available) initial.add(e.index);
    });
    return initial;
  });

  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // Range inputs
  const [rangeFrom, setRangeFrom] = useState<string>('1');
  const [rangeTo, setRangeTo] = useState<string>(playlistInfo.entries.length.toString());

  // Quality & Format settings
  const [mode, setMode] = useState<'video' | 'audio'>('audio');
  const [outputFormat, setOutputFormat] = useState<'mp4' | 'mov' | 'mp3' | 'm4a' | 'wav'>('mp3');
  const [selectedQuality, setSelectedQuality] = useState<string>('Best available');

  // Save options
  const [saveFolder, setSaveFolder] = useState<string>(defaultSaveFolder);
  const [createPlaylistFolder, setCreatePlaylistFolder] = useState<boolean>(true);
  const [numberFiles, setNumberFiles] = useState<boolean>(true);
  const [skipAlreadyDownloaded, setSkipAlreadyDownloaded] = useState<boolean>(true);

  // Sync range inputs with selection
  useEffect(() => {
    const selectedArr = Array.from(selectedIndices).sort((a, b) => a - b);
    if (selectedArr.length === 0) {
      setRangeFrom('');
      setRangeTo('');
      return;
    }

    const min = selectedArr[0];
    const max = selectedArr[selectedArr.length - 1];

    // Check if contiguous
    let isContiguous = true;
    for (let i = 0; i < selectedArr.length; i++) {
      if (selectedArr[i] !== min + i) {
        isContiguous = false;
        break;
      }
    }

    if (isContiguous) {
      setRangeFrom(min.toString());
      setRangeTo(max.toString());
    } else {
      setRangeFrom('custom');
      setRangeTo('custom');
    }
  }, [selectedIndices]);

  // Handle Select All / None
  const isAllSelected = useMemo(() => {
    const availableEntries = playlistInfo.entries.filter((e) => e.available);
    return availableEntries.length > 0 && availableEntries.every((e) => selectedIndices.has(e.index));
  }, [playlistInfo, selectedIndices]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIndices(new Set());
    } else {
      const all = new Set<number>();
      playlistInfo.entries.forEach((e) => {
        if (e.available) all.add(e.index);
      });
      setSelectedIndices(all);
    }
  };

  const handleInvertSelection = () => {
    const inverted = new Set<number>();
    playlistInfo.entries.forEach((e) => {
      if (e.available && !selectedIndices.has(e.index)) {
        inverted.add(e.index);
      }
    });
    setSelectedIndices(inverted);
  };

  const handleToggleIndex = (index: number, isShiftKey: boolean) => {
    const entry = playlistInfo.entries.find((e) => e.index === index);
    if (!entry || !entry.available) return;

    if (isShiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const updated = new Set(selectedIndices);
      const shouldSelect = !selectedIndices.has(index);

      for (let i = start; i <= end; i++) {
        const item = playlistInfo.entries.find((e) => e.index === i);
        if (item && item.available) {
          if (shouldSelect) updated.add(i);
          else updated.delete(i);
        }
      }
      setSelectedIndices(updated);
    } else {
      const updated = new Set(selectedIndices);
      if (updated.has(index)) {
        updated.delete(index);
      } else {
        updated.add(index);
      }
      setSelectedIndices(updated);
      setLastClickedIndex(index);
    }
  };

  const handleRangeApply = (fromVal: string, toVal: string) => {
    const f = parseInt(fromVal, 10);
    const t = parseInt(toVal, 10);
    if (!isNaN(f) && !isNaN(t) && f > 0 && t >= f) {
      const updated = new Set<number>();
      for (let i = f; i <= Math.min(playlistInfo.entries.length, t); i++) {
        const item = playlistInfo.entries.find((e) => e.index === i);
        if (item && item.available) {
          updated.add(i);
        }
      }
      setSelectedIndices(updated);
    }
  };

  const handleBrowseFolder = async () => {
    if (window.api?.openDirectoryDialog) {
      const chosen = await window.api.openDirectoryDialog(saveFolder);
      if (chosen) setSaveFolder(chosen);
    }
  };

  // Selected videos calculation
  const selectedEntries = useMemo(() => {
    return playlistInfo.entries.filter((e) => selectedIndices.has(e.index) && e.available);
  }, [playlistInfo, selectedIndices]);

  const selectedCount = selectedEntries.length;

  // Size Estimate
  const estimatedSizeBytes = useMemo(() => {
    const totalDuration = selectedEntries.reduce((acc, cur) => acc + cur.durationSec, 0);
    if (mode === 'audio') {
      // 256 kbps audio ~ 32 KB/sec
      return totalDuration * 32 * 1024;
    } else {
      // 1080p ~ 25 MB/min (~426 KB/sec)
      return totalDuration * 426 * 1024;
    }
  }, [selectedEntries, mode]);

  const estimatedSizeMbFormatted = useMemo(() => {
    const mb = estimatedSizeBytes / (1024 * 1024);
    if (mb >= 1024) {
      return `≈ ${(mb / 1024).toFixed(1)} GB`;
    }
    return `≈ ${Math.round(mb)} MB`;
  }, [estimatedSizeBytes]);

  const handleAddPlaylistToQueue = async (andNavigateToQueue = false) => {
    if (selectedCount === 0) return;

    if (selectedCount > 200) {
      const confirmAdd = window.confirm(
        `You have selected ${selectedCount} videos. Adding this many videos may take a while. Continue?`
      );
      if (!confirmAdd) return;
    }

    const groupId = Math.random().toString(36).substring(2, 9);
    const sanitizedPlaylistTitle = sanitizeFilename(playlistInfo.title, 60);

    // If "Playlist folder" is on, save inside a folder named after the sanitized playlist title
    const finalOutputDir = createPlaylistFolder
      ? `${saveFolder}\\${sanitizedPlaylistTitle}`
      : saveFolder;

    const zeroPadWidth = playlistInfo.count.toString().length;

    const children: QueueItem[] = selectedEntries.map((e) => {
      const childId = Math.random().toString(36).substring(2, 9);
      const sanitizedTitle = sanitizeFilename(e.title, 80);

      // File name numbering: "<NN> - <sanitized title>.<ext>"
      const numberedPrefix = numberFiles
        ? `${e.index.toString().padStart(zeroPadWidth, '0')} - `
        : '';
      const fileName = `${numberedPrefix}${sanitizedTitle}`;

      return {
        id: childId,
        platform: 'youtube',
        url: `https://www.youtube.com/watch?v=${e.id}`,
        title: e.title,
        thumbnailUrl: e.thumbnailUrl,
        durationSec: e.durationSec,
        format: outputFormat,
        quality: selectedQuality,
        mode,
        clip: null, // Full video in playlist mode
        outputDir: finalOutputDir,
        fileName,
        status: 'waiting',
        progress: {
          percent: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          speedBps: 0,
          speed: '—',
          etaSec: 0,
          eta: '—'
        },
        attempts: 0,
        groupId,
        indexInGroup: e.index,
        addedAt: Date.now()
      };
    });

    const group: QueueGroup = {
      id: groupId,
      kind: 'playlist',
      title: playlistInfo.title,
      channel: playlistInfo.channel,
      sourceUrl: playlistUrl,
      thumbnailUrl: playlistInfo.thumbnailUrl,
      childIds: children.map((c) => c.id),
      options: {
        createPlaylistFolder,
        numberFiles,
        skipAlreadyDownloaded,
        format: outputFormat,
        quality: selectedQuality,
        mode
      },
      createdAt: Date.now()
    };

    await addGroup(group, children);

    if (andNavigateToQueue) {
      navigate('queue');
    } else {
      showToast(`${selectedCount} videos added to the queue`, 'success');
    }
  };

  return (
    <div className={`flex flex-col gap-4 w-full select-none ${className}`}>
      {/* Playlist Info Header Card */}
      <Card className="p-4 sm:p-5 rounded-[18px] bg-card border-border-strong flex items-center gap-4 shadow-sm">
        {/* Playlist Stack Tile Icon */}
        <div className="w-16 h-16 rounded-[14px] bg-surface border border-border flex items-center justify-center text-foreground flex-none shadow-sm">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-status-successTint text-status-success text-xs font-semibold select-none border border-status-success/20">
              Playlist found · {playlistInfo.count} videos
            </span>
          </div>

          <h2
            className="font-display font-bold text-lg sm:text-xl text-foreground truncate"
            title={playlistInfo.title}
          >
            {playlistInfo.title}
          </h2>

          <div className="text-xs text-foreground-muted font-mono">
            {playlistInfo.channel} · {playlistInfo.totalDurationFormatted} in total
          </div>
        </div>
      </Card>

      {/* Main Grid: Left Column (Virtual List) & Right Column (Quality, Save, Actions) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_342px] gap-4 items-start">
        {/* Left Card: Playlist Entries List */}
        <Card className="rounded-[18px] bg-card border-border-strong flex flex-col overflow-hidden shadow-sm">
          {/* Header Controls: Select All, Range, Invert */}
          <div className="p-3.5 sm:p-4 border-b border-border-subtle flex items-center justify-between gap-3 bg-surface/30">
            {/* Select All Checkbox */}
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-foreground select-none">
              <div
                onClick={handleToggleSelectAll}
                className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${
                  isAllSelected
                    ? 'bg-accent border-accent text-onAccent shadow-sm'
                    : 'border-border-strong bg-transparent hover:border-border'
                }`}
              >
                {isAllSelected && <CheckIcon size={12} strokeWidth={3} />}
              </div>
              <span>Select all</span>
            </label>

            {/* Range and Invert */}
            <div className="flex items-center gap-2.5 text-xs font-mono">
              <span className="text-foreground-muted font-sans text-xs">Range</span>
              <input
                type="text"
                data-testid="range-from"
                value={rangeFrom}
                onChange={(e) => {
                  setRangeFrom(e.target.value);
                  handleRangeApply(e.target.value, rangeTo);
                }}
                className="w-10 h-7 rounded-[6px] bg-inset border border-border text-center text-foreground font-mono text-xs focus:outline-none focus:border-accent"
              />
              <span className="text-foreground-muted">to</span>
              <input
                type="text"
                data-testid="range-to"
                value={rangeTo}
                onChange={(e) => {
                  setRangeTo(e.target.value);
                  handleRangeApply(rangeFrom, e.target.value);
                }}
                className="w-10 h-7 rounded-[6px] bg-inset border border-border text-center text-foreground font-mono text-xs focus:outline-none focus:border-accent"
              />

              <button
                type="button"
                onClick={handleInvertSelection}
                className="h-7 px-2.5 rounded-[6px] bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors font-sans text-xs font-medium"
              >
                Invert
              </button>
            </div>
          </div>

          {/* Virtualized Video List */}
          <PlaylistList
            entries={playlistInfo.entries}
            selectedIndices={selectedIndices}
            onToggleIndex={handleToggleIndex}
          />
        </Card>

        {/* Right Column: Settings & Download */}
        <div className="flex flex-col gap-4">
          {/* Card 1: Quality and format */}
          <Card className="p-4 sm:p-5 rounded-[18px] bg-card border-border-strong flex flex-col gap-4 shadow-sm">
            <h3 className="font-display font-semibold text-sm text-foreground">
              Quality and format
            </h3>

            {/* Segmented Video / Audio only */}
            <SegmentedToggle
              value={mode}
              onChange={(val) => {
                setMode(val as any);
                if (val === 'audio') setOutputFormat('mp3');
                else setOutputFormat('mp4');
              }}
              options={[
                { value: 'video', label: 'Video' },
                { value: 'audio', label: 'Audio only' }
              ]}
            />

            {/* Quality Dropdown */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground-muted">
                {mode === 'audio' ? 'Audio quality' : 'Video quality'}
              </label>
              <select
                value={selectedQuality}
                onChange={(e) => setSelectedQuality(e.target.value)}
                className="h-10 px-3 rounded-[10px] bg-inset border border-border-strong text-foreground text-xs focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="Best available">Best available</option>
                {mode === 'audio' ? (
                  <>
                    <option value="320 kbps (High)">320 kbps (High)</option>
                    <option value="256 kbps (Standard)">256 kbps (Standard)</option>
                    <option value="128 kbps (Compact)">128 kbps (Compact)</option>
                  </>
                ) : (
                  <>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                  </>
                )}
              </select>
            </div>

            {/* Output format chips */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground-muted">
                Output format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {mode === 'audio' ? (
                  <>
                    <Chip
                      variant="format"
                      selected={outputFormat === 'mp3'}
                      onClick={() => setOutputFormat('mp3')}
                    >
                      MP3
                    </Chip>
                    <Chip
                      variant="format"
                      selected={outputFormat === 'm4a'}
                      onClick={() => setOutputFormat('m4a')}
                    >
                      M4A
                    </Chip>
                    <Chip
                      variant="format"
                      selected={outputFormat === 'wav'}
                      onClick={() => setOutputFormat('wav')}
                    >
                      WAV
                    </Chip>
                  </>
                ) : (
                  <>
                    <Chip
                      variant="format"
                      selected={outputFormat === 'mp4'}
                      onClick={() => setOutputFormat('mp4')}
                    >
                      MP4
                    </Chip>
                    <Chip
                      variant="format"
                      selected={outputFormat === 'mov'}
                      onClick={() => setOutputFormat('mov')}
                    >
                      MOV
                    </Chip>
                    <Chip
                      variant="format"
                      selected={false}
                      disabled
                      title="GIF not supported for full playlists"
                    >
                      GIF
                    </Chip>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Card 2: Save Options */}
          <Card className="p-4 sm:p-5 rounded-[18px] bg-card border-border-strong flex flex-col gap-4 shadow-sm">
            <h3 className="font-display font-semibold text-sm text-foreground">
              Save
            </h3>

            {/* Folder Location */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground-muted">
                Folder
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-9 px-3 rounded-[10px] bg-inset border border-border text-foreground-muted text-xs flex items-center font-mono truncate select-text">
                  <span className="truncate">{saveFolder}</span>
                </div>
                <button
                  type="button"
                  onClick={handleBrowseFolder}
                  className="h-9 px-3 rounded-[10px] bg-surface border border-border text-foreground hover:bg-surface-hover text-xs font-medium transition-colors flex-none"
                >
                  Browse
                </button>
              </div>
            </div>

            <div className="h-[1px] bg-border-subtle my-1" />

            {/* Switches */}
            <div className="flex flex-col gap-3.5">
              <SwitchRow
                label="Playlist folder"
                description="Saves into a folder named after the playlist"
                checked={createPlaylistFolder}
                onChange={setCreatePlaylistFolder}
              />

              <SwitchRow
                label="Number the files"
                description="01 - Time, 02 - Cornfield Chase ..."
                checked={numberFiles}
                onChange={setNumberFiles}
              />

              <SwitchRow
                label="Skip already downloaded"
                description="Great for updating a playlist later"
                checked={skipAlreadyDownloaded}
                onChange={setSkipAlreadyDownloaded}
              />
            </div>
          </Card>

          {/* Summary Line */}
          <div className="flex items-center justify-between text-xs text-foreground-muted font-mono px-1">
            <span>
              {selectedCount} of {playlistInfo.entries.length} selected · {outputFormat.toUpperCase()}
            </span>
            <span className="font-semibold text-foreground font-sans">
              {estimatedSizeMbFormatted}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              size="lg"
              disabled={selectedCount === 0}
              onClick={() => handleAddPlaylistToQueue(false)}
              className="w-full h-12 rounded-[14px] font-semibold text-sm justify-center"
            >
              Add to queue
            </Button>

            <Button
              variant="primary"
              size="lg"
              disabled={selectedCount === 0}
              onClick={() => handleAddPlaylistToQueue(true)}
              className="w-full h-14 rounded-[14px] font-bold text-[15px] justify-center flex items-center gap-2 shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              <DownloadIcon size={18} />
              <span>Download {selectedCount} videos</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
