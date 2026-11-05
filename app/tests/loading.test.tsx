// @vitest-environment jsdom
// Milestone 3A: the catalogue matches the content, pages fetch only the units they need, loading states show,
// and a failed download is reported with a retry that works.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { catalog, loadNotation, loadUnit } from "virtual:rl-content";
import { loadBundle } from "../../tools/content_loader.ts";
import { stripLocal } from "../plugins/vite_content.ts";
import { buildCatalog, unitContent } from "../src/content/catalog";
import { cat, fetchIndexes, fetchUnit, resetContentCache, setUnitLoaderForTests } from "../src/content/load";
import { RouteBoundary, lazyPage } from "../src/components/Boundary";
import { allowConsoleError } from "./console";
import { appWasUpdated, resetUpdateFlag, watchForUpdates } from "../src/store/update";
import { renderApp } from "./helpers";

const full = loadBundle();

afterEach(() => {
  cleanup();
  setUnitLoaderForTests();
  resetContentCache();
});

describe("catalogue", () => {
  test("is exactly what the content files give (no hand-kept copy)", () => {
    expect(catalog).toEqual(stripLocal(buildCatalog(full)));
  });

  test("holds stubs only: no summaries, formulas, lesson text, stems or solutions", () => {
    const text = JSON.stringify(catalog);
    for (const c of full.concepts) expect(text).not.toContain(c.summary);
    for (const e of full.equations) expect(text).not.toContain(JSON.stringify(e.tex).slice(1, -1));
    for (const q of full.questionFiles.flatMap((f) => f.questions)) expect(text).not.toContain(JSON.stringify(q.stem).slice(1, -1));
    expect(text).not.toContain('"exercises"');
  });

  test("lists one stub per concept, item and question", () => {
    expect(catalog.concepts).toHaveLength(full.concepts.length);
    expect(catalog.items).toHaveLength(full.equations.length + full.algorithms.length + full.examples.length + full.figures.length);
    expect(catalog.questions).toHaveLength(full.questionFiles.flatMap((f) => f.questions).length);
    expect(catalog.notationCount).toBe(full.notation.length);
  });

  test("carries each question's provenance kind for filtering", () => {
    expect(cat.question("ch04-q001")?.provenance).toBe("textbook-exercise");
    expect(cat.question("sup-zhao-06-q001")?.provenance).toBe("supplementary");
  });

  test("revision card ids are the same as from the full content", async () => {
    const { buildIndexes } = await import("../src/content/indexes");
    expect(cat.cardIds()).toEqual(buildIndexes(full).cardIds());
  });
});

describe("per-unit chunks", () => {
  test("each unit chunk holds exactly that unit's content", async () => {
    for (const u of catalog.contentUnits) expect(await loadUnit(u), u).toEqual(stripLocal(unitContent(full, u)));
  });

  test("a unit without content files has nothing to fetch", async () => {
    expect(await loadUnit("ch12")).toBeNull();
    expect((await fetchUnit("ch12")).concepts).toEqual([]);
  });

  test("core chunks never contain supplementary items", async () => {
    for (const u of catalog.contentUnits.filter((x) => !x.startsWith("sup-"))) {
      const c = (await loadUnit(u))!;
      const units = [...c.concepts, ...c.equations, ...c.algorithms, ...c.examples, ...c.figures, ...c.questionFiles.flatMap((f) => f.questions)].map((x) => x.unit);
      expect(units.every((x) => x === u), u).toBe(true);
    }
  });

  test("the notation is its own chunk", async () => {
    expect(await loadNotation()).toEqual(stripLocal(full.notation));
  });

  test("a chapter page fetches only its own unit; a concept page fetches the units with items about it", async () => {
    const seen: string[] = [];
    setUnitLoaderForTests((u) => (seen.push(u), loadUnit(u)));
    await fetchIndexes(["ch02"]);
    expect(seen).toEqual(["ch02"]);
    seen.length = 0;
    // ch03's Bellman equation is used by a ch04 question, so its concept page needs both.
    expect(cat.unitsForConcept("ch03.bellman-equation-v")).toEqual(["ch03", "ch04"]);
    await fetchIndexes(cat.unitsForConcept("ch03.bellman-equation-v"));
    expect(seen.sort()).toEqual(["ch03", "ch04"]);
  });

  test("opening core pages never fetches supplementary units", async () => {
    const seen: string[] = [];
    setUnitLoaderForTests((u) => (seen.push(u), loadUnit(u)));
    for (const u of catalog.curriculum.core) {
      renderApp(`/learn/${u.id}`);
      await screen.findByRole("heading", { level: 1 });
      cleanup();
    }
    expect(seen.filter((u) => u.startsWith("sup-"))).toEqual([]);
  });

  test("the app's own code never imports the eager all-content bundle", () => {
    const root = join(import.meta.dirname, "..", "src");
    const files = readdirSync(root, { recursive: true, withFileTypes: true }).filter((d) => d.isFile() && /\.tsx?$/.test(d.name));
    const offenders = files.map((d) => join(d.parentPath, d.name)).filter((f) => /content\/bundle"/.test(readFileSync(f, "utf-8")));
    expect(offenders).toEqual([]);
  });
});

describe("loading states and failures", () => {
  test("a page shows a loading state, then its content", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    setUnitLoaderForTests((u) => gate.then(() => loadUnit(u)));
    renderApp("/learn/ch02");
    expect(await screen.findByText("Loading page…")).toBeInTheDocument();
    release();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Multi-arm Bandits");
  });

  test("a failed download shows an error panel; Try again fetches again and succeeds", async () => {
    allowConsoleError(/Failed to fetch dynamically imported module/);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let fail = true;
    setUnitLoaderForTests((u) => (fail ? Promise.reject(new TypeError("Failed to fetch dynamically imported module: ch02")) : loadUnit(u)));
    renderApp("/learn/ch02");
    expect(await screen.findByRole("alert")).toHaveTextContent("This page could not be loaded");
    // The shell still works around the failed page.
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    fail = false;
    // The retry suspends while it fetches, so the click goes through an awaited act().
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Multi-arm Bandits");
  });

  test("a failed page-code download is retried too (unlike React.lazy, which keeps the failure)", async () => {
    allowConsoleError(/Importing a module script failed/);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let attempts = 0;
    const Page = lazyPage(
      () => (++attempts === 1 ? Promise.reject(new TypeError("Importing a module script failed.")) : Promise.resolve({ P: () => <h1>Loaded page</h1> })),
      (m) => m.P,
    );
    // Rendering suspends at once, so it must happen inside an awaited act().
    await act(async () => {
      render(
        <MemoryRouter>
          <RouteBoundary resetKey="x">
            <Page />
          </RouteBoundary>
        </MemoryRouter>,
      );
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
    // The retry suspends while it fetches, so the click goes through an awaited act().
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(await screen.findByRole("heading", { name: "Loaded page" })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  test("a bug inside a page is reported without taking down the shell", async () => {
    allowConsoleError(/boom/);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const Broken = () => {
      throw new Error("boom");
    };
    render(
      <MemoryRouter>
        <RouteBoundary resetKey="y">
          <Broken />
        </RouteBoundary>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong on this page");
    expect(screen.getByRole("alert")).toHaveTextContent("Your progress is safe");
  });

  test("after an update took over the page, a missing code file asks for a reload instead of a retry that cannot work", async () => {
    allowConsoleError(/Failed to fetch dynamically imported module/);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const listeners: (() => void)[] = [];
    const sw = { controller: {} as ServiceWorker, addEventListener: (_: string, f: () => void) => void listeners.push(f) };
    watchForUpdates(sw as never);
    expect(appWasUpdated()).toBe(false);
    listeners.forEach((f) => f()); // the new version's worker claims the page
    expect(appWasUpdated()).toBe(true);
    const Page = lazyPage(() => Promise.reject(new TypeError("Failed to fetch dynamically imported module: /assets/old-abc.js")), () => () => null);
    await act(async () => {
      render(
        <MemoryRouter>
          <RouteBoundary resetKey="z">
            <Page />
          </RouteBoundary>
        </MemoryRouter>,
      );
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("The app was updated");
    expect(screen.getByRole("button", { name: "Reload the app" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    resetUpdateFlag();
  });

  test("the first worker taking control of a fresh page is not an update", () => {
    const listeners: (() => void)[] = [];
    watchForUpdates({ controller: null, addEventListener: (_: string, f: () => void) => void listeners.push(f) } as never);
    listeners.forEach((f) => f());
    expect(appWasUpdated()).toBe(false);
  });
});
