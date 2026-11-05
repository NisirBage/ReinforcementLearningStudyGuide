import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App, preloadRoutes } from "../src/App";
import { fetchEverything, fetchSearchIndex } from "../src/content/load";
import { ProgressProvider } from "../src/store/ProgressContext";
import { memoryStore } from "../src/store/idb";

/** Renders the whole app at `path` with an in-memory store standing in for IndexedDB, and optionally a test clock. */
export function renderApp(path = "/", store: ReturnType<typeof memoryStore> = memoryStore(), now?: () => number) {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <ProgressProvider store={store} now={now}>
        <App />
      </ProgressProvider>
    </MemoryRouter>,
  );
  return { ...view, store };
}

/**
 * Loads every page's code and all content before a test, as a learner's device has them after a first visit.
 * Interaction tests use it: a user-event click that has to fetch a page suspends inside the testing library's
 * synchronous act(), which React reports as an error. Route tests do not preload, so they exercise the real
 * on-demand loading path; tests/loading.test.tsx covers loading states and failures directly.
 */
export const preloadAll = () => Promise.all([preloadRoutes(), fetchEverything(), fetchSearchIndex()]).then(() => undefined);
