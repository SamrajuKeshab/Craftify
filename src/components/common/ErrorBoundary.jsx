import { Component } from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('Craftify UI error boundary caught:', error, info);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF6F0] text-[#2C2018] flex items-center justify-center px-6 py-12">
          <div className="max-w-md w-full bg-white border border-[#E6DDD1] rounded-2xl p-8 text-center shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-[#8B4B28]/10 text-[#8B4B28] flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="font-['Fraunces'] text-2xl font-semibold text-[#2C2018] mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-[#6B5B4E] leading-relaxed mb-6">
              An unexpected display issue occurred while loading this page. Your cart and
              account remain safe — try reloading or returning to the storefront.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#8B4B28] text-white text-sm font-medium hover:bg-[#733D20] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-[#D8CBB9] bg-[#FAF6F0] text-[#2C2018] text-sm font-medium hover:bg-[#F2E9DC] transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Back to Storefront
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
