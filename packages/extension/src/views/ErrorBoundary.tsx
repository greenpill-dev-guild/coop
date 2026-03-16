import React from 'react';

export class ErrorBoundary extends React.Component<
  { fallback?: React.ReactNode; children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { fallback?: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }}>
            <h2>Something went wrong</h2>
            <p style={{ color: '#666', marginBottom: '1rem' }}>{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null });
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: '1px solid #ccc',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
