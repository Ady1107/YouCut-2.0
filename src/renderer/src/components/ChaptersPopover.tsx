import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { secondsToMs } from '../utils/time';
import { QueueIcon, ChevronDownIcon } from './Icons';

export interface Chapter {
  title: string;
  start_time: number;
  end_time: number;
}

export interface ChaptersPopoverProps {
  chapters: Chapter[];
  onSelectChapter: (chapter: Chapter) => void;
  onAddAllChapters?: (chapters: Chapter[]) => void;
}

export const ChaptersPopover: React.FC<ChaptersPopoverProps> = ({
  chapters,
  onSelectChapter,
  onAddAllChapters
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!chapters || chapters.length === 0) return null;

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-8 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all select-none ${
          isOpen
            ? 'bg-accent text-[#1A0805]'
            : 'bg-[#1B1E27] text-foreground-subtle hover:text-foreground border border-border'
        }`}
      >
        <span>Chapters ({chapters.length})</span>
        <ChevronDownIcon size={14} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-[#14161D] border border-border-strong rounded-[14px] shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3 border-b border-border-subtle flex items-center justify-between bg-[#111319]">
            <span className="text-xs font-bold text-foreground tracking-wide">
              Video Chapters ({chapters.length})
            </span>
            <span className="text-[10px] text-foreground-muted">Click to select range</span>
          </div>

          <div className="overflow-y-auto max-h-64 p-1.5 flex flex-col gap-1">
            {chapters.map((ch, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onSelectChapter(ch);
                  setIsOpen(false);
                }}
                className="w-full text-left p-2.5 rounded-[10px] hover:bg-[#1B1E27] flex items-center justify-between gap-3 group transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-[#1B1E27] group-hover:bg-[#2A1B19] group-hover:text-accent text-[10px] font-mono font-bold flex items-center justify-center text-foreground-muted flex-none">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-medium text-foreground-subtle group-hover:text-foreground truncate">
                    {ch.title}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-foreground-muted group-hover:text-accent flex-none">
                  {secondsToMs(ch.start_time)} - {secondsToMs(ch.end_time)}
                </span>
              </button>
            ))}
          </div>

          {onAddAllChapters && (
            <div className="p-2 border-t border-border-subtle bg-[#111319]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onAddAllChapters(chapters);
                  setIsOpen(false);
                }}
                className="w-full text-xs flex items-center justify-center gap-2"
              >
                <QueueIcon size={14} />
                <span>Add all {chapters.length} clips to queue</span>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
