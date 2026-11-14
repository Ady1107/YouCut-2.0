import React from 'react';

export interface ToastProps {
  id: string;
  type?: 'success' | 'error' | 'info';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  type = 'info',
  message,
  action,
  onClose
}) => {
  const borderColors = {
    success: 'border-status-success/40',
    error: 'border-red-500/40',
    info: 'border-border-strong'
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-[12px] bg-[#14161D] border ${borderColors[type]} shadow-xl text-sm max-w-md animate-in fade-in slide-in-from-bottom-2`}>
      <span className="flex-1 text-foreground leading-snug">{message}</span>
      {action && (
        <button
          onClick={action.onClick}
          className="text-xs font-semibold text-accent hover:underline px-1 py-0.5"
        >
          {action.label}
        </button>
      )}
      <button
        onClick={() => onClose(id)}
        className="text-foreground-muted hover:text-foreground text-xs p-1"
      >
        ✕
      </button>
    </div>
  );
};
