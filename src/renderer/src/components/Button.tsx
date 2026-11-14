import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'accent-tint' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  pill = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-sans transition-all duration-150 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed select-none whitespace-nowrap active:scale-[0.98]';

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'h-9 px-3 text-xs font-semibold gap-1.5 ' + (pill ? 'rounded-full' : 'rounded-[10px]'),
    md: 'h-11 px-4 text-sm font-semibold gap-2 ' + (pill ? 'rounded-full' : 'rounded-[12px]'),
    lg: 'h-[52px] px-5 text-sm font-semibold gap-2.5 ' + (pill ? 'rounded-full' : 'rounded-[14px]'),
    xl: 'h-[54px] px-6 text-[15px] font-bold gap-2.5 ' + (pill ? 'rounded-full' : 'rounded-[14px]'),
    icon: 'w-10 h-10 p-0 rounded-[10px]'
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-[#1A0805] hover:brightness-105 active:brightness-95 border-0 shadow-sm',
    secondary: 'bg-[#1B1E27] text-foreground border border-[#2A2E3B] hover:bg-[#242834] hover:border-[#3A3F4E]',
    'accent-tint': 'bg-[#2A1B19] text-[#FF8C7E] border border-accent hover:brightness-110',
    outline: 'bg-transparent text-foreground-subtle border border-[#2A2E3B] hover:text-foreground hover:border-[#3A3F4E]',
    ghost: 'bg-transparent text-foreground-muted hover:text-foreground hover:bg-[#1B1E27]/70',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {leftIcon && <span className="flex items-center justify-center">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="flex items-center justify-center">{rightIcon}</span>}
    </button>
  );
};
