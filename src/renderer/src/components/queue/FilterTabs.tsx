import React from 'react';

export type QueueFilterTab = 'all' | 'downloading' | 'waiting' | 'done' | 'failed';

export interface FilterTabsProps {
  activeTab: QueueFilterTab;
  counts: {
    all: number;
    downloading: number;
    waiting: number;
    done: number;
    failed: number;
  };
  onSelect: (tab: QueueFilterTab) => void;
  className?: string;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({
  activeTab,
  counts,
  onSelect,
  className = ''
}) => {
  const tabs: Array<{ id: QueueFilterTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'downloading', label: 'Downloading', count: counts.downloading },
    { id: 'waiting', label: 'Waiting', count: counts.waiting },
    { id: 'done', label: 'Done', count: counts.done },
    { id: 'failed', label: 'Failed', count: counts.failed }
  ];

  return (
    <div
      role="tablist"
      aria-label="Filter queue items"
      className={`inline-flex items-center gap-1 p-1 rounded-[14px] bg-inset border border-border-subtle ${className}`}
    >
      {tabs.map((tab) => {
        const isSelected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[10px] text-xs font-medium transition-all select-none ${
              isSelected
                ? 'bg-card text-foreground shadow-sm font-semibold border border-border-strong'
                : 'text-foreground-muted hover:text-foreground hover:bg-surface/50 border border-transparent'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full ${
                isSelected
                  ? 'bg-surface text-foreground-subtle'
                  : 'text-foreground-subtle/70'
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
