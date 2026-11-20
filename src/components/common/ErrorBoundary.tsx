import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface ErrorBoundaryProps {
  children?: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  fallbackRender?: (props: { error: Error | null; resetError: () => void }) => ReactNode;
  onReset?: () => void;
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[Harmoniq ErrorBoundary caught error]:', error, errorInfo);
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallbackRender) {
        return this.props.fallbackRender({
          error: this.state.error,
          resetError: this.resetError,
        });
      }

      const title = this.props.fallbackTitle || 'Something went wrong';
      const description =
        this.props.fallbackDescription ||
        'An unexpected error occurred in this view. Audio playback and other features remain active.';

      return (
        <div
          className={`h-full w-full flex flex-col items-center justify-center p-8 select-none text-center ${
            this.props.className || ''
          }`}
        >
          <div className="max-w-md w-full p-8 rounded-3xl bg-[#14141B] border border-[#272733] shadow-2xl flex flex-col items-center text-center space-y-5 animate-in fade-in duration-300">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-inner">
              <AlertCircle size={28} />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-[#F5F3FF] tracking-tight">{title}</h2>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">{description}</p>
            </div>

            <button
              onClick={this.resetError}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-violet-950/40 transition flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <RefreshCw size={14} />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
