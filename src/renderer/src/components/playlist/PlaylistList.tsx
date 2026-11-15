import React, { useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PlaylistEntry } from '../../../../shared/types';
import { CheckIcon } from '../Icons';

export interface PlaylistListProps {
  entries: PlaylistEntry[];
  selectedIndices: Set<number>;
  onToggleIndex: (index: number, isShiftKey: boolean) => void;
  className?: string;
}

export const PlaylistList: React.FC<PlaylistListProps> = ({
  entries,
  selectedIndices,
  onToggleIndex,
  className = ''
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10
  });

  const handleKeyDown = (e: React.KeyboardEvent, index: number, available: boolean) => {
    if (!available) return;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onToggleIndex(index, e.shiftKey);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(entries.length, index + 1);
      setFocusedIndex(next);
      const nextEl = parentRef.current?.querySelector(`[data-index="${next}"]`) as HTMLElement;
      nextEl?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(1, index - 1);
      setFocusedIndex(prev);
      const prevEl = parentRef.current?.querySelector(`[data-index="${prev}"]`) as HTMLElement;
      prevEl?.focus();
    }
  };

  return (
    <div
      ref={parentRef}
      className={`overflow-y-auto max-h-[560px] min-h-[300px] w-full divide-y divide-border-subtle/50 select-none ${className}`}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const entry = entries[virtualRow.index];
          const isSelected = selectedIndices.has(entry.index);
          const isAvailable = entry.available;

          return (
            <div
              key={entry.id || virtualRow.index}
              data-index={entry.index}
              tabIndex={isAvailable ? 0 : -1}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
              onClick={(e) => {
                if (isAvailable) {
                  onToggleIndex(entry.index, e.shiftKey);
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, entry.index, isAvailable)}
              onFocus={() => setFocusedIndex(entry.index)}
              className={`flex items-center gap-3.5 px-3 h-[52px] cursor-pointer transition-colors ${
                !isAvailable
                  ? 'opacity-35 cursor-not-allowed bg-transparent'
                  : isSelected
                  ? 'bg-surface/40 hover:bg-surface/60'
                  : 'hover:bg-surface/20'
              } ${focusedIndex === entry.index ? 'outline-none ring-1 ring-accent/30' : ''}`}
            >
              {/* Checkbox */}
              <div
                className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors flex-none ${
                  !isAvailable
                    ? 'border-border bg-transparent'
                    : isSelected
                    ? 'bg-accent border-accent text-onAccent shadow-sm'
                    : 'border-border-strong bg-transparent hover:border-border'
                }`}
              >
                {isSelected && isAvailable && <CheckIcon size={12} strokeWidth={3} />}
              </div>

              {/* Index Number */}
              <span className="font-mono text-xs text-foreground-muted/70 w-5 flex-none select-none">
                {entry.index.toString().padStart(2, '0')}
              </span>

              {/* 64x36 Thumbnail */}
              <div className="relative w-16 h-9 rounded-[6px] overflow-hidden bg-surface border border-border-subtle flex-none shadow-sm">
                {entry.thumbnailUrl ? (
                  <img
                    src={entry.thumbnailUrl}
                    alt={entry.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-surface to-surface-active" />
                )}
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0 pr-2">
                <span
                  className={`text-xs block truncate ${
                    !isAvailable
                      ? 'text-foreground-muted line-through'
                      : isSelected
                      ? 'text-foreground font-medium'
                      : 'text-foreground-muted'
                  }`}
                  title={entry.title}
                >
                  {entry.title}
                </span>
              </div>

              {/* Duration or Unavailable label */}
              <div className="flex-none font-mono text-xs text-foreground-muted">
                {!isAvailable ? (
                  <span className="text-[11px] text-status-danger/70 font-sans">
                    Unavailable
                  </span>
                ) : (
                  <span>{entry.durationFormatted}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
