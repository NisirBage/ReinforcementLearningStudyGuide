import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../src/App";
import { ProgressProvider } from "../src/store/ProgressContext";
import { memoryStore } from "../src/store/idb";

/** Renders the whole app at `path` with an in-memory store standing in for IndexedDB. */
export function renderApp(path = "/", store: ReturnType<typeof memoryStore> = memoryStore()) {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <ProgressProvider store={store}>
        <App />
      </ProgressProvider>
    </MemoryRouter>,
  );
  return { ...view, store };
}
