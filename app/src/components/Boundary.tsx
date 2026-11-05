// Loading states, error boundaries and route-level code splitting.
//
// lazyPage() is used instead of React.lazy because React.lazy remembers a failed import for good: after one
// failed fetch (offline, page never saved), "Try again" could never succeed. Here "Try again" forgets failed
// imports and failed content downloads (retryFailed in content/load.ts), so they are fetched again.
import { Component, Suspense, use, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { onRetry, retryFailed, tracked } from "../content/load";

export function Loading({ what = "page" }: { what?: string }) {
  return (
    <p className="muted loading" role="status">
      Loading {what}…
    </p>
  );
}

export type LazyPage<P> = ComponentType<P> & { preload: () => Promise<unknown> };

export function lazyPage<M, P extends object = object>(load: () => Promise<M>, pick: (m: M) => ComponentType<P>): LazyPage<P> {
  let pending: Promise<ComponentType<P>> | null = null;
  const get = () => {
    if (!pending) {
      pending = tracked(load().then(pick));
      pending.catch(() => undefined); // shown by the error boundary
    }
    return pending;
  };
  onRetry(() => {
    if ((pending as { status?: string } | null)?.status === "rejected") pending = null;
  });
  function LazyPage(props: P) {
    const C = use(get());
    return <C {...props} />;
  }
  return Object.assign(LazyPage, { preload: get });
}

/** True for a failed fetch of a code or content chunk (as opposed to a bug in a page). */
export const isLoadError = (e: unknown) =>
  e instanceof TypeError || /dynamically imported module|Importing a module script failed|Failed to fetch|error loading|Load failed/i.test(String((e as Error)?.message ?? e));

interface BoundaryProps {
  children: ReactNode;
  resetKey: string; // a new key (e.g. a new route) clears the error
}
interface BoundaryState {
  error: unknown;
  key: string;
}

export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Kept visible for debugging; the learner sees the panel below.
    console.warn("Page failed:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    return (
      <div className="error-panel" role="alert">
        <h1 tabIndex={-1}>{isLoadError(error) ? "This page could not be loaded" : "Something went wrong on this page"}</h1>
        <p>
          {isLoadError(error)
            ? offline
              ? "You are offline and this part of the app has not been saved on this device yet. Reconnect and try again, or use Settings → Save for offline next time you are online."
              : "Part of the app could not be downloaded. Check the connection and try again."
            : "The rest of the app still works. Your progress is safe."}
        </p>
        <p className="muted small">{String((error as Error)?.message ?? error)}</p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => {
              retryFailed();
              this.setState({ error: null });
            }}>
            Try again
          </button>
          <Link className="btn" to="/">
            Go to the home page
          </Link>
        </div>
      </div>
    );
  }
}

/** Error boundary + Suspense for one route: the rest of the shell (navigation, search box) keeps working. */
export function RouteBoundary({ children, resetKey }: { children: ReactNode; resetKey: string }) {
  return (
    <ErrorBoundary resetKey={resetKey}>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </ErrorBoundary>
  );
}
