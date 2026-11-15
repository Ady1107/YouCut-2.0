import React from 'react';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  headerAction,
  children,
  className = '',
  ...props
}) => {
  const hasHeader = Boolean(title || subtitle || headerAction);

  return (
    <div
      className={`bg-card border border-border rounded-[18px] p-[18px] box-border ${className}`}
      {...props}
    >
      {hasHeader && (
        <div className="flex items-center justify-between gap-3 mb-3.5 px-1">
          <div>
            {title && (
              <div className="font-display text-base font-semibold text-foreground tracking-tight">
                {title}
              </div>
            )}
            {subtitle && (
              <div className="text-[13px] text-foreground-muted mt-0.5 leading-snug">
                {subtitle}
              </div>
            )}
          </div>
          {headerAction && <div className="flex items-center gap-2">{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
