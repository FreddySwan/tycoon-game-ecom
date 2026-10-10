import { Component, type ReactNode } from 'react';

/** Keeps one broken screen from taking down the whole game UI. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { key: string }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error) {
    console.error('Screen crashed', error);
  }

  render() {
    if (this.state.error)
      return (
        <div className="callout bad">
          <b>This screen hit a snag.</b> The game is still running. Try another tab and come back.
          <div className="tiny muted">{this.state.error.message}</div>
        </div>
      );
    return this.props.children;
  }
}
