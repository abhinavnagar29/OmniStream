import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error('UI crashed:', error, errorInfo);
  }

  render() {
    const { error } = this.state;
    const { children } = this.props;

    if (!error) return children;

    return (
      <div className="min-h-screen bg-[#070A12] text-white p-6">
        <div className="max-w-3xl mx-auto rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="text-xl font-semibold">Frontend crashed</div>
          <div className="text-white/60 mt-2">Copy this error and send it back:</div>
          <pre className="mt-4 text-xs text-white/70 whitespace-pre-wrap break-words">{String(error?.stack || error?.message || error)}</pre>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
