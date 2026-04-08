import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#1A1C20', padding: 24,
        }}>
          <div style={{
            maxWidth: 480, width: '100%', background: '#2B2E34', borderRadius: 20,
            padding: '48px 40px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#F5F5F3', marginBottom: 8 }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 14, color: '#C9CDD2', marginBottom: 24 }}>
              Varda encountered an unexpected error.
            </p>
            {this.state.error && (
              <pre style={{
                background: '#1A1C20', borderRadius: 10, padding: '14px 16px',
                fontSize: 12, color: '#D46A6A', textAlign: 'left', overflowX: 'auto',
                marginBottom: 24, maxHeight: 120, border: '1px solid #D46A6A33',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '12px 24px', borderRadius: 10, background: '#C6A86A',
                  color: '#1A1C20', border: 'none', cursor: 'pointer', fontSize: 14,
                  fontWeight: 600, minHeight: 44,
                }}
              >
                Reload
              </button>
              <button
                onClick={() => { localStorage.clear(); window.location.reload() }}
                style={{
                  padding: '12px 24px', borderRadius: 10, background: '#D46A6A22',
                  color: '#D46A6A', border: '1px solid #D46A6A44', cursor: 'pointer',
                  fontSize: 14, fontWeight: 500, minHeight: 44,
                }}
              >
                Clear Data & Reload
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
