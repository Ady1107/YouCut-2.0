import React from 'react';

export type ChipVariant = 'format' | 'platform-youtube' | 'platform-instagram' | 'platform-facebook' | 'preview-tag' | 'accent-pill';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChipVariant;
  selected?: boolean;
  clickable?: boolean;
}

export const Chip: React.FC<ChipProps> = ({
  children,
  variant = 'format',
  selected = false,
  clickable = true,
  className = '',
  disabled,
  ...props
}) => {
  let styleClasses = '';

  if (variant === 'format') {
    styleClasses = selected
      ? 'border-accent bg-[#2A1B19] text-[#FF8C7E] font-semibold'
      : 'border-border-strong bg-transparent text-foreground-subtle hover:border-border-muted font-medium';
    return (
      <button
        type="button"
        disabled={disabled}
        className={`flex-1 h-10 rounded-[10px] border text-[13px] flex items-center justify-center transition-all ${styleClasses} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }

  if (variant === 'platform-youtube') {
    return (
      <span className={`px-2.5 py-1 rounded-full bg-[#2A1B19] text-[#FF8C7E] text-xs font-semibold select-none ${className}`}>
        {children}
      </span>
    );
  }

  if (variant === 'platform-instagram') {
    return (
      <span className={`px-2.5 py-1 rounded-full bg-[#2B1A26] text-[#F28BB8] text-xs font-semibold select-none ${className}`}>
        {children}
      </span>
    );
  }

  if (variant === 'platform-facebook') {
    return (
      <span className={`px-2.5 py-1 rounded-full bg-[#17233D] text-[#8DB4FF] text-xs font-semibold select-none ${className}`}>
        {children}
      </span>
    );
  }

  if (variant === 'preview-tag') {
    return (
      <span className={`px-3 py-1 rounded-full bg-black/60 text-xs font-semibold text-foreground backdrop-blur-sm select-none ${className}`}>
        {children}
      </span>
    );
  }

  if (variant === 'accent-pill') {
    return (
      <span className={`px-3 py-1.5 rounded-full bg-[#2A1B19] text-[#FF8C7E] text-[13px] font-semibold whitespace-nowrap select-none ${className}`}>
        {children}
      </span>
    );
  }

  return null;
};
