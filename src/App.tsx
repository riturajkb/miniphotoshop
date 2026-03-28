import { Component, ReactNode, ErrorInfo } from "react";
import { AppShell } from "./components/layout/AppShell";

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{color: 'red', zIndex: 999999, position: 'absolute', top: 0, left: 0, background: 'black', padding: '20px', fontSize: '20px'}}>
          <p>Something went wrong:</p>
          <pre>{this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}

export { App };
