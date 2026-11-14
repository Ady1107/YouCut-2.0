import React from 'react';
import { Card } from './Card';
import { Button } from './Button';

export interface DialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-md shadow-2xl border-border-strong animate-in zoom-in-95">
        <div className="font-display text-lg font-semibold text-foreground mb-1">
          {title}
        </div>
        {description && (
          <div className="text-sm text-foreground-muted mb-4 leading-relaxed">
            {description}
          </div>
        )}
        {children && <div className="mb-4">{children}</div>}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button variant="secondary" size="md" onClick={onCancel}>
            {cancelLabel}
          </Button>
          {onConfirm && (
            <Button
              variant={isDestructive ? 'danger' : 'primary'}
              size="md"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};
