import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { ScissorsIcon } from './Icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex-1 flex items-center justify-center p-8 bg-background text-foreground h-full">
          <Card className="max-w-md w-full p-6 bg-[#14161D] border-border-strong flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#2A1B19] flex items-center justify-center text-accent">
              <ScissorsIcon size={24} />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-display font-semibold text-lg text-foreground">
                Something went wrong in this view
              </h2>
              <p className="text-xs text-foreground-muted font-mono bg-[#0A0B0E] p-3 rounded-[8px] max-w-full overflow-x-auto text-left mt-2 border border-border">
                {this.state.error?.message || 'Unknown error occurred'}
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={this.handleReset}
              className="mt-2 w-full"
            >
              Reload View
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
