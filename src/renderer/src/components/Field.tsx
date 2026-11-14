import React from 'react';

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
  rightAction?: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  suffix,
  prefix,
  rightAction,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <div className="text-xs font-semibold text-foreground-muted mb-2 tracking-wide">
          {label}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center h-11 rounded-[12px] border border-border-strong bg-[#0F1116] px-3 focus-within:border-accent transition-colors overflow-hidden">
          {prefix && <div className="mr-2.5 flex items-center">{prefix}</div>}
          <input
            className={`flex-1 min-w-0 bg-transparent text-foreground placeholder-foreground-muted text-[13px] font-sans focus:outline-none ${className}`}
            {...props}
          />
          {suffix && <div className="text-foreground-muted text-[13px] pl-2 select-none">{suffix}</div>}
        </div>
        {rightAction}
      </div>
    </div>
  );
};

export interface SelectFieldProps {
  label?: string;
  value: string;
  displayValue?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  displayValue,
  onClick,
  icon
}) => {
  return (
    <div className="w-full">
      {label && (
        <div className="text-xs font-semibold text-foreground-muted mb-2 tracking-wide">
          {label}
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        className="w-full h-11 px-3.5 rounded-[12px] border border-border-strong bg-[#0F1116] text-foreground text-sm flex items-center justify-between hover:border-border-muted transition-colors text-left"
      >
        <span>{displayValue}</span>
        {icon || (
          <svg className="w-4 h-4 text-foreground-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        )}
      </button>
    </div>
  );
};
