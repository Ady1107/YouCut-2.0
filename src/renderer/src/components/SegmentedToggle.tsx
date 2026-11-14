import React from 'react';

export interface ToggleOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

export interface SegmentedToggleProps<T extends string> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
}

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  className = ''
}: SegmentedToggleProps<T>) {
  return (
    <div
      role="group"
      className={`flex p-1 rounded-[14px] bg-[#0F1116] border border-border box-border ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 h-10 rounded-[10px] text-sm font-sans transition-all duration-150 flex items-center justify-center select-none ${
              isSelected
                ? 'bg-accent text-[#1A0805] font-semibold shadow-sm'
                : 'bg-transparent text-foreground-muted font-medium hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
