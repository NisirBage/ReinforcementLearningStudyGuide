// @vitest-environment jsdom
// Milestone 3B Practice section: setup and filters, immediate and end-of-session feedback, step-by-step
// solutions, bookmarks and flags, attempts recorded with time, re-attempting mistakes, self-marking with a
// rubric, and resuming a session after a reload.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { decodeSaved, STORAGE_KEY } from "../src/store/persistence";
import { memoryStore } from "../src/store/idb";
import { SLOT_PREFIX } from "../src/store/ProgressContext";
import { preloadAll, renderApp } from "./helpers";

beforeAll(preloadAll);
afterEach(cleanup);

const ready = () => screen.findByRole("heading", { level: 1 });
const saved = (store: ReturnType<typeof memoryStore>) => decodeSaved(store.dump()[STORAGE_KEY]);
const savedSession = (store: ReturnType<typeof memoryStore>) => JSON.parse(store.dump()[SLOT_PREFIX + "practice"] ?? "null");

/** Chapter 4, book order, `n` questions: ch04-q001 (Exercise 4.1), ch04-q002, … */
async function setupCh04(user: ReturnType<typeof userEvent.setup>, n: number, feedback: "after" | "end" = "after") {
  await user.click(screen.getByLabelText(/Chapter 4: Dynamic Programming/));
  await user.click(screen.getByLabelText("Book order"));
  if (feedback === "end") await user.click(screen.getByLabelText(/At the end/));
  const count = screen.getByLabelText("Number of questions");
  await user.clear(count);
  await user.type(count, String(n));
}

describe("practice setup", () => {
  test("Practice is in the main navigation and its setup shows real match counts", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await ready();
    await user.click(screen.getByRole("link", { name: /Practice/ }));
    expect(await ready()).toHaveTextContent("Practice");
    // With nothing ticked, every 2015-draft question matches and supplementary ones do not.
    expect(screen.getByText(/^252 questions match/)).toBeInTheDocument(); // 2015-draft questions in content/questions (Milestone 4J added 21)
    await user.click(screen.getByLabelText(/Zhao: stochastic approximation/));
    expect(screen.getByText(/^2 questions match/)).toBeInTheDocument();
    // The quick starts show the learner's real (empty) history.
    expect(screen.getByRole("button", { name: /Re-attempt questions I got wrong/ })).toBeDisabled();
  });

  test("filters narrow the set; an impossible combination disables Start", async () => {
    const user = userEvent.setup();
    renderApp("/practice");
    await ready();
    await user.click(screen.getByLabelText(/Chapter 3: Finite Markov Decision Processes/));
    expect(screen.getByText(/^43 questions match/)).toBeInTheDocument(); // Chapter 3 since Milestone 4D
    await user.click(screen.getByText("Sections, topics, question types and sources"));
    await user.click(screen.getByLabelText("New application question"));
    expect(screen.getByText(/^0 questions match/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start practice" })).toBeDisabled();
  });
});

describe("a practice session", () => {
  test("immediate feedback, step-by-step solution, bookmark, flag, navigation and results", async () => {
    const user = userEvent.setup();
    const { store } = renderApp("/practice");
    await ready();
    await setupCh04(user, 2);
    await user.click(screen.getByRole("button", { name: "Start practice" }));
    expect(screen.getByText(/Question 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText("Exercise 4.1, reworded")).toBeInTheDocument(); // provenance is visible
    const [a, b] = screen.getAllByRole("textbox");
    await user.type(a, "-1");
    await user.type(b, "-15");
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText(/Correct: 4 \/ 4/)).toBeInTheDocument();
    // Solution steps are revealed one at a time.
    await user.click(screen.getByRole("button", { name: /Show next step \(1 of 3\)/ }));
    expect(screen.getByRole("button", { name: /Show next step \(2 of 3\)/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show all steps" }));
    expect(screen.queryByRole("button", { name: /Show next step/ })).toBeNull();
    // The attempt is recorded at once, with mode, time and session.
    await waitFor(() => expect(saved(store).attempts).toHaveLength(1));
    expect(saved(store).attempts[0]).toMatchObject({ qid: "ch04-q001", score: 4, max: 4, mode: "practice" });
    expect(typeof saved(store).attempts[0].ms).toBe("number");
    expect(saved(store).attempts[0].sessionId).toMatch(/^p-/);
    // Bookmark and flag are kept apart.
    await user.click(screen.getByRole("button", { name: "Bookmark" }));
    await user.click(screen.getByRole("button", { name: /Flag for revision/ }));
    await waitFor(() => expect(saved(store).bookmarks).toEqual(["ch04-q001"]));
    expect(saved(store).marked).toEqual(["ch04-q001"]);
    // The palette shows the state of each question.
    expect(screen.getByRole("button", { name: "Question 1: correct" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next →" }));
    expect(screen.getByText(/Question 2 of 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Question 2: not answered" })).toHaveAttribute("aria-current", "step");
    // Finishing with an unanswered question asks first; unanswered questions are not attempts.
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Finish and see results" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/1 question is not answered/));
    expect(await ready()).toHaveTextContent("Practice results");
    expect(screen.getByText("Score").parentElement).toHaveTextContent("4 / 4");
    expect(screen.getByText("Unanswered").parentElement).toHaveTextContent("1");
    expect(saved(store).attempts).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Re-attempt the 0 not fully correct/ })).toBeDisabled();
  });

  test("a wrong answer can be re-attempted from the results and later from the setup page", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { store } = renderApp("/practice");
    await ready();
    await setupCh04(user, 1);
    await user.click(screen.getByRole("button", { name: "Start practice" }));
    const [a, b] = screen.getAllByRole("textbox");
    await user.type(a, "-14"); // wrong: that is v_π(11)
    await user.type(b, "-15");
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText(/Partly correct: 2 \/ 4/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish and see results" }));
    await user.click(await screen.findByRole("button", { name: /Re-attempt the 1 not fully correct/ }));
    expect(screen.getByText(/Question 1 of 1/)).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")[0]).toHaveValue(""); // a fresh attempt
    // Back on the setup page, the history-based quick start knows about the mistake.
    await user.click(screen.getByRole("button", { name: "Finish and see results" }));
    await user.click(await screen.findByRole("button", { name: "New practice" }));
    const quick = await screen.findByRole("button", { name: /Re-attempt questions I got wrong/ });
    expect(quick).toHaveTextContent("1 question");
    await user.click(quick);
    expect(screen.getByText(/^1 question matches/)).toBeInTheDocument();
    expect(saved(store).attempts.map((x) => x.qid)).toEqual(["ch04-q001"]);
  });

  test("feedback at the end shows no answers until the session is finished", async () => {
    const user = userEvent.setup();
    const { store } = renderApp("/practice");
    await ready();
    await setupCh04(user, 2, "end");
    await user.click(screen.getByRole("button", { name: "Start practice" }));
    expect(screen.queryByRole("button", { name: "Check answer" })).toBeNull();
    const [a, b] = screen.getAllByRole("textbox");
    await user.type(a, "-1");
    await user.type(b, "-14");
    expect(screen.getByRole("button", { name: "Question 1: answered" })).toBeInTheDocument();
    expect(screen.queryByText("Solution")).toBeNull();
    expect(saved(store).attempts).toHaveLength(0); // nothing recorded yet
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Finish and see results" }));
    expect(await ready()).toHaveTextContent("Practice results");
    await waitFor(() => expect(saved(store).attempts).toHaveLength(1));
    expect(saved(store).attempts[0]).toMatchObject({ qid: "ch04-q001", score: 2, max: 4 });
    expect(screen.getByText("Score").parentElement).toHaveTextContent("2 / 4");
  });

  test("short answers are self-marked against a rubric, never graded by the app", async () => {
    const user = userEvent.setup();
    const { store } = renderApp("/practice");
    await ready();
    await user.click(screen.getByLabelText(/Chapter 2: Multi-arm Bandits/));
    await user.click(screen.getByText("Sections, topics, question types and sources"));
    await user.click(screen.getByLabelText("Short answer"));
    expect(screen.getByText(/^5 questions match/)).toBeInTheDocument(); // Chapter 2 short answers since Milestone 4C
    await user.click(screen.getByLabelText(/^§2\.4 Tracking a Nonstationary Problem/));
    expect(screen.getByText(/^1 question matches/)).toBeInTheDocument(); // ch02-q010
    await user.click(screen.getByRole("button", { name: "Start practice" }));
    await user.type(screen.getByRole("textbox"), "Recent rewards get more weight with a constant step.");
    await user.click(screen.getByRole("button", { name: "Show model answer" }));
    expect(screen.getByText("Model answer")).toBeInTheDocument();
    const rubric = screen.getByRole("group", { name: /Mark your answer/ });
    const boxes = within(rubric).getAllByRole("checkbox");
    await user.click(boxes[0]);
    await user.click(boxes[2]);
    expect(within(rubric).getByText("Your mark: 2 / 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Record my mark" }));
    expect(screen.getByText(/Partly correct: 2 \/ 3 \(your own mark\)/)).toBeInTheDocument();
    await waitFor(() => expect(saved(store).attempts[0]).toMatchObject({ qid: "ch02-q010", score: 2, max: 3, selfMarked: true }));
  });

  test("an open session survives a reload, with the answer typed so far", async () => {
    const user = userEvent.setup();
    const { store } = renderApp("/practice");
    await ready();
    await setupCh04(user, 2);
    await user.click(screen.getByRole("button", { name: "Start practice" }));
    await user.type(screen.getAllByRole("textbox")[0], "-1");
    await waitFor(() => expect(savedSession(store)?.items["ch04-q001"].draft.texts[0]).toBe("-1"));
    cleanup();
    renderApp("/practice", store);
    expect(await screen.findByText(/Question 1 of 2/)).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("-1");
    // Starting over clears the saved session.
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Finish and see results" }));
    await user.click(await screen.findByRole("button", { name: "New practice" }));
    await waitFor(() => expect(savedSession(store)).toBeNull());
  });
});
