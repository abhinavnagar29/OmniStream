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
      <div className="min-h-screen bg-ink-950 text-paper p-6">
        <div className="max-w-3xl mx-auto rounded-2xl bg-ink-900 border border-ink-700 p-6">
          <div className="text-xl font-semibold">Frontend crashed</div>
          <div className="text-paper-dim mt-2">Copy this error and send it back:</div>
          <pre className="mt-4 text-xs text-paper-dim whitespace-pre-wrap break-words">{String(error?.stack || error?.message || error)}</pre>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
