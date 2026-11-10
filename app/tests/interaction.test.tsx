// @vitest-environment jsdom
// The interface wired to the foundation: search, statuses, exercises, persistence across a reload,
// backup export/import, settings, spaced review and keyboard use.
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { STORAGE_KEY, decodeSaved, exportProgress } from "../src/store/persistence";
import { emptyProgress, setConceptStatus } from "../src/domain/progress";
import { memoryStore } from "../src/store/idb";
import { preloadAll, renderApp } from "./helpers";

beforeAll(preloadAll);
afterEach(cleanup);
const saved = (store: ReturnType<typeof memoryStore>) => decodeSaved(store.dump()[STORAGE_KEY]);
const ready = () => screen.findByRole("heading", { level: 1 });

describe("search", () => {
  test("results show their type, tier and printed/PDF location, and link to a page", async () => {
    const user = userEvent.setup();
    renderApp("/search");
    await ready();
    await user.type(screen.getByLabelText("Search terms"), "UCB{Enter}");
    const list = await screen.findByRole("list", { name: "" }).catch(() => document.querySelector("ol.results") as HTMLElement);
    expect(screen.getByRole("status")).toHaveTextContent(/results? for “UCB”/);
    const first = within(list).getAllByRole("link")[0];
    expect(first.textContent).toMatch(/Upper-confidence-bound/);
    expect(list.textContent).toContain("S&B 2015 §2.6 · p. 41 (PDF 55)");
    await user.click(first);
    expect(await ready()).toHaveTextContent(/Upper-confidence-bound/);
  });

  test("the top-bar search box submits to the search page", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await ready();
    await user.type(screen.getByLabelText("Search the textbook"), "policy evaluation{Enter}");
    expect(await screen.findByText(/results? for “policy evaluation”/)).toBeInTheDocument();
    expect(screen.getAllByText(/Iterative policy evaluation/).length).toBeGreaterThan(0);
  });

  test("the 2015-only filter hides supplementary results", async () => {
    const user = userEvent.setup();
    renderApp("/search?q=robbins%20monro");
    await ready();
    expect(screen.getAllByText("Supplementary").length).toBeGreaterThan(0);
    await user.click(screen.getByLabelText(/2015 draft only/));
    expect(document.querySelector("ol.results li.is-sup")).toBeNull();
  });
});

describe("progress updates and persistence", () => {
  test("a concept status set on its page is saved and survives a reload", async () => {
    const user = userEvent.setup();
    const { store } = renderApp("/concept/ch02.ucb");
    await ready();
    await user.selectOptions(screen.getByLabelText("Status of Upper-confidence-bound (UCB) action selection"), "understood");
    await waitFor(() => expect(saved(store).conceptStatus["ch02.ucb"]?.status).toBe("understood"));
    cleanup();
    renderApp("/learn/ch02", store); // a "refresh": a new app instance reading the same store
    await ready();
    expect(screen.getByLabelText("Status of Upper-confidence-bound (UCB) action selection")).toHaveValue("understood");
    cleanup();
    renderApp("/", store);
    await ready();
    expect(screen.getByText("1 / 92")).toBeInTheDocument(); // dashboard counts it (92 core concepts since Milestone 4H added 12)
  });

  test("answering an exercise is graded, recorded and shown on the dashboard after reload", async () => {
    const user = userEvent.setup();
    const { store } = renderApp("/learn/ch02/2.4");
    await ready();
    const card = document.getElementById("ch02-q002")!;
    await user.type(within(card).getByRole("textbox"), "3.5");
    await user.click(within(card).getByRole("button", { name: "Check answer" }));
    expect(within(card).getByText(/Correct: 2 \/ 2/)).toBeInTheDocument();
    await waitFor(() => expect(saved(store).attempts).toHaveLength(1));
    cleanup();
    renderApp("/", store);
    await ready();
    const stat = screen.getByText("Questions attempted").parentElement!;
    expect(stat).toHaveTextContent("1");
    expect(screen.getByText(/Answered ch02-q002/)).toBeInTheDocument();
  });

  test("a wrong numeric part is marked and partial marks given", async () => {
    const user = userEvent.setup();
    renderApp("/learn/ch02/2.3");
    await ready();
    const card = document.getElementById("ch02-q001")!;
    const [a, b2, c] = within(card).getAllByRole("textbox");
    await user.type(a, "6");
    await user.type(b2, "4");
    await user.type(c, "5");
    await user.click(within(card).getByRole("button", { name: "Check answer" }));
    expect(within(card).getByText(/Partly correct: 2 \/ 3/)).toBeInTheDocument();
    expect(within(card).getByText("Solution")).toBeInTheDocument();
  });

  test("marking a question for revision lists it under Revise", async () => {
    const user = userEvent.setup();
    const { store } = renderApp("/learn/ch04/4.1");
    await ready();
    const card = document.getElementById("ch04-q002")!;
    await user.click(within(card).getByRole("button", { name: /Mark for revision/ }));
    await waitFor(() => expect(saved(store).marked).toEqual(["ch04-q002"]));
    cleanup();
    renderApp("/revision/marked", store);
    await ready();
    expect(document.getElementById("ch04-q002")).not.toBeNull();
  });
});

describe("backup", () => {
  test("export produces a download of the current profile", async () => {
    const user = userEvent.setup();
    const created: Blob[] = [];
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: (b: Blob) => (created.push(b), "blob:x"), revokeObjectURL: () => undefined }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const store = memoryStore();
    renderApp("/progress", store);
    await ready();
    await user.click(screen.getByRole("button", { name: "Export backup" }));
    expect(click).toHaveBeenCalled();
    const text = await created[0].text();
    expect(JSON.parse(text)).toMatchObject({ app: "rl-study-lab", schema: 2 });
    expect(screen.getByText("Backup downloaded.")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  test("import merges a backup file; a bad file is refused with a message", async () => {
    const store = memoryStore();
    renderApp("/progress", store);
    await ready();
    const input = screen.getByTestId("import") as HTMLInputElement;
    const backup = exportProgress(setConceptStatus(emptyProgress(), "ch04.policy-evaluation", "mastered", 3));
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([backup], "b.json", { type: "application/json" })] } });
    });
    expect(await screen.findByText("Backup merged into this browser's progress.")).toBeInTheDocument();
    await waitFor(() => expect(saved(store).conceptStatus["ch04.policy-evaluation"]?.status).toBe("mastered"));
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["{}"], "x.json")] } });
    });
    expect(await screen.findByText(/Import failed: This file is not an RL Study Lab export/)).toBeInTheDocument();
  });

  test("reset asks first and clears progress only on confirmation", async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    renderApp("/concept/ch02.ucb", store);
    await ready();
    await user.selectOptions(screen.getByRole("combobox"), "learning");
    cleanup();
    renderApp("/progress", store);
    await ready();
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: "Reset all progress" }));
    expect(saved(store).conceptStatus["ch02.ucb"]).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Reset all progress" }));
    await waitFor(() => expect(saved(store).conceptStatus).toEqual({}));
  });
});

describe("settings", () => {
  test("theme and the 2018 cross-references are saved and applied", async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    renderApp("/settings", store);
    await ready();
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await user.click(screen.getByLabelText(/cross-references to the/));
    await waitFor(() => expect(saved(store).settings).toEqual({ theme: "dark", show2018Notation: true }));
    cleanup();
    renderApp("/equation/eq.ch02.sample-average", store);
    await ready();
    expect(screen.getByText("2018 edition (unverified)")).toBeInTheDocument();
    cleanup();
    renderApp("/revision/notation", store);
    await ready();
    expect(screen.getByRole("columnheader", { name: "2018 edition" })).toBeInTheDocument();
    document.documentElement.removeAttribute("data-theme");
  });

  test("2018 cross-references are hidden by default", async () => {
    renderApp("/equation/eq.ch02.sample-average");
    await ready();
    expect(screen.queryByText("2018 edition (unverified)")).toBeNull();
  });
});

describe("learning page content", () => {
  test("a lesson section shows layers, an equation, a derivation, key terms, exercises and citations", async () => {
    renderApp("/learn/ch02/2.3");
    await ready();
    for (const label of ["Intuition", "Formal definition", "Derivation", "Worked example", "As an algorithm", "Connections"]) expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    expect(document.querySelectorAll(".katex").length).toBeGreaterThan(5);
    expect(screen.getAllByText(/Derivation, step by step \(5 steps\)/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Key terms" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Exercises" })).toBeInTheDocument();
    expect(screen.getAllByText(/S&B 2015 §2\.3 · p\. 37 \(PDF 51\)/).length).toBeGreaterThan(0);
    expect(screen.getByRole("navigation", { name: "Sections" })).toHaveTextContent("2.4 Tracking a Nonstationary Problem");
  });

  test("§4.1 shows the pseudocode, the redrawn figure with its rounding flag, and the worked example", async () => {
    const user = userEvent.setup();
    renderApp("/learn/ch04/4.1");
    await ready();
    expect(screen.getByRole("group", { name: "Pseudocode" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /k = 0/ })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "k = 2" }));
    const grid = screen.getByRole("table", { name: /k = 2/ });
    expect(grid.textContent).toContain("-1.7");
    await user.click(screen.getByLabelText(/Show exact values/));
    expect(screen.getByRole("table", { name: /k = 2/ }).textContent).toContain("-1.75");
    expect(screen.getAllByText(/Printed values are rounded/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Run the checks in your browser" }));
    expect(document.querySelectorAll(".facts .ok").length).toBe(5);
  });

  test("supplementary material is labelled and kept off the core path", async () => {
    renderApp("/learn/sup-zhao-06/6.2");
    await ready();
    expect(screen.getAllByText(/is not from the April 2015 Sutton & Barto draft/).length).toBeGreaterThan(0);
    cleanup();
    renderApp("/learn/ch02/2.4");
    await ready();
    expect(screen.getByRole("heading", { name: "Go further (supplementary)" })).toBeInTheDocument();
    expect(screen.queryByText(/Robbins–Monro iteration/)).toBeNull(); // linked, not merged in
  });

  test("a concept page shows prerequisites and what it leads to", async () => {
    renderApp("/concept/ch03.bellman-equation-v");
    await ready();
    expect(screen.getByText("Learn first:").parentElement).toHaveTextContent("State-value function v_π");
    expect(screen.getByText("Leads to:").parentElement).toHaveTextContent("Policy evaluation");
  });
});

describe("spaced review and keyboard use", () => {
  test("Space flips a card and number keys grade it; grades are saved", async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    renderApp("/revision/review", store);
    await ready();
    expect(screen.getByText(/Card 1 of 10/)).toBeInTheDocument();
    await user.keyboard(" ");
    expect(screen.getByRole("group", { name: "How well did you recall it?" })).toBeInTheDocument();
    await user.keyboard("3");
    expect(screen.getByText(/Card 2 of 10/)).toBeInTheDocument();
    await waitFor(() => expect(Object.keys(saved(store).cards)).toHaveLength(1));
  });

  test("the skip link is the first tab stop and moves focus to the main content", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await ready();
    (document.activeElement as HTMLElement)?.blur();
    await user.tab();
    expect(document.activeElement).toHaveTextContent("Skip to content");
    await user.keyboard("{Enter}");
    expect(document.activeElement?.id).toBe("main");
  });

  test("navigation moves focus to the new page's heading", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await ready();
    // The main navigation's Learn link (the dashboard also lists "Temporal-Difference Learning").
    await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: /Learn/ }));
    await waitFor(() => expect(document.activeElement?.tagName).toBe("H1"));
    expect(document.activeElement).toHaveTextContent("Learn");
  });

  test("ordering questions can be solved with buttons alone", async () => {
    const user = userEvent.setup();
    renderApp("/learn/ch04/4.1");
    await ready();
    const card = document.getElementById("ch04-q003")!;
    // Sort the shuffled steps into the correct order using only the move buttons.
    const correct = ["Set", "For the next state", "Replace", "Update", "After all states"];
    for (let target = 0; target < correct.length; target++) {
      let items = within(card).getAllByRole("listitem");
      let at = items.findIndex((li) => li.textContent!.includes(correct[target]));
      while (at > target) {
        await user.click(within(card).getByRole("button", { name: `Move step ${at + 1} up` }));
        items = within(card).getAllByRole("listitem");
        at = items.findIndex((li) => li.textContent!.includes(correct[target]));
      }
    }
    await user.click(within(card).getByRole("button", { name: "Check answer" }));
    expect(within(card).getByText(/Correct: 2 \/ 2/)).toBeInTheDocument();
  });
});
