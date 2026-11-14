import React from 'react';

export type StatusState = 'ready' | 'fetching' | 'downloading' | 'update';

export interface StatusPillProps {
  state?: StatusState;
  text?: string;
  count?: { n: number; m: number };
}

export const StatusPill: React.FC<StatusPillProps> = ({
  state = 'ready',
  text,
  count
}) => {
  let dotColor = 'bg-status-success';
  let defaultText = 'Ready to clip';

  if (state === 'fetching') {
    dotColor = 'bg-yellow-400 animate-pulse';
    defaultText = 'Fetching info';
  } else if (state === 'downloading') {
    dotColor = 'bg-blue-400 animate-pulse';
    defaultText = count ? `Downloading ${count.n} of ${count.m}` : 'Downloading';
  } else if (state === 'update') {
    dotColor = 'bg-purple-400';
    defaultText = 'Update available';
  }

  return (
    <div className="p-3.5 rounded-[14px] bg-[#14161D] border border-border flex items-center gap-2.5">
      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
      <div className="text-[13px] text-foreground-subtle font-medium">
        {text || defaultText}
      </div>
    </div>
  );
};

export interface FullVideoCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const FullVideoCheckbox: React.FC<FullVideoCheckboxProps> = ({
  checked,
  onChange,
  disabled
}) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`h-9 px-3.5 pl-2 rounded-full text-[13px] font-semibold flex items-center gap-2 transition-all select-none ${
        checked
          ? 'bg-accent text-[#1A0805] font-bold border-0'
          : 'bg-transparent text-foreground border border-border-muted hover:border-foreground-subtle'
      }`}
    >
      <span
        className={`w-5 h-5 rounded-[6px] flex items-center justify-center transition-colors ${
          checked ? 'bg-[#1A0805]' : 'border-2 border-border-gray'
        }`}
      >
        {checked && (
          <svg className="w-3.5 h-3.5 stroke-white" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span>Full video</span>
    </button>
  );
};
