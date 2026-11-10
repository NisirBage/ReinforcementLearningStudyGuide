// @vitest-environment jsdom
// Milestone 3C mock exams in the UI, with a test clock: setup, the countdown, navigation palette, mark for review,
// leaving and returning, reloading, the submission dialog, automatic submission at time-out, results, written
// answers marked afterwards, history, and the phone navigation's More menu.
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { decodeSaved, STORAGE_KEY } from "../src/store/persistence";
import { memoryStore } from "../src/store/idb";
import { SLOT_PREFIX } from "../src/store/ProgressContext";
import { preloadAll, renderApp } from "./helpers";
import { startExam } from "../src/domain/exam";
import { buildIndexes } from "../src/content/indexes";
import { loadBundle } from "../../tools/content_loader.ts";

beforeAll(preloadAll);
afterEach(cleanup);

const MIN = 60_000;
const ready = () => screen.findByRole("heading", { level: 1 });
const saved = (store: ReturnType<typeof memoryStore>) => decodeSaved(store.dump()[STORAGE_KEY]);
const slot = (store: ReturnType<typeof memoryStore>) => JSON.parse(store.dump()[SLOT_PREFIX + "exam"] ?? "null");
/**
 * A click that navigates to another page, inside an awaited act(). The router renders the new page in a
 * transition; under the testing library's synchronous act() React reports that as an un-awaited suspension even
 * though no content or code is pending (instrumented and confirmed). Assertions are unchanged; the same flows were
 * checked by hand in the browser.
 */
const go = (el: HTMLElement) => act(async () => void fireEvent.click(el));

/** A test clock: starts at a fixed time and moves only when told to. */
function testClock() {
  let t = 1_800_000_000_000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

/**
 * The paper these tests take: ch04-q003 (ordering, 2 marks) and ch04-q007 (true/false, 1 mark). Until Milestone 4E
 * these were the only Chapter 4 Beginner questions, and the tests started the exam from that filter. The bank grows
 * with every chapter, so the paper is now put in place with the exam engine's own startExam, exactly as the page
 * stores an exam it has started; the page then resumes it. Starting a paper from the setup form is tested in
 * "mock exam setup".
 */
const idx = buildIndexes(loadBundle());
async function seedCh04Paper(store: ReturnType<typeof memoryStore>, now: () => number, minutes = 10) {
  const cfg = { units: ["ch04"], difficulties: [1], count: 2, minutes, includeWritten: false, seed: 7 };
  const e = startExam(`e-${now()}-7`, "Mock exam: Chapter 4", cfg, ["ch04-q003", "ch04-q007"], (id) => idx.question(id)!, now());
  await store.set(SLOT_PREFIX + "exam", JSON.stringify(e));
}
async function openSeeded(store: ReturnType<typeof memoryStore>, now: () => number, minutes = 10) {
  await seedCh04Paper(store, now, minutes);
  renderApp("/exam", store, now);
  expect(await screen.findByRole("timer")).toHaveTextContent(`${String(minutes).padStart(2, "0")}:00`);
}
/** Answers the true/false question (False is right) wherever it is in the paper. */
async function answerTrueFalse(user: ReturnType<typeof userEvent.setup>, value: "True" | "False") {
  if (!screen.queryAllByText(/True or false/).length) await user.click(screen.getByRole("button", { name: "Next →" }));
  await user.click(screen.getByLabelText(value));
}

describe("mock exam setup", () => {
  test("Mock exams is in the navigation; written answers and supplementary modules are excluded unless chosen", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await ready();
    await go(screen.getByRole("link", { name: /Mock exams/ }));
    expect(await ready()).toHaveTextContent("Mock exams");
    expect(screen.getByText(/^135 questions available/)).toBeInTheDocument(); // 182 core minus 47 written (Milestone 4G added 22 and 7)
    await user.click(screen.getByLabelText(/Include written answers/));
    expect(screen.getByText(/^182 questions available/)).toBeInTheDocument();
    // Starting from the form: Chapter 4, Beginner, written answers off again: 7 questions since Milestone 4E.
    await user.click(screen.getByLabelText(/Include written answers/));
    await user.click(screen.getByLabelText(/Chapter 4: Dynamic Programming/));
    await user.click(screen.getByLabelText("Beginner"));
    expect(screen.getByText(/^7 questions available/)).toBeInTheDocument();
    await go(screen.getByRole("button", { name: "Start exam" }));
    expect(await screen.findByRole("timer")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Question \d/ })).toHaveLength(7); // the palette: one button per question
  });

  test("on a phone-width layout, Search, Progress and Settings sit under More", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await ready();
    const more = screen.getByRole("button", { name: /More/ });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await user.click(more);
    const menu = document.getElementById("more-menu")!;
    expect(within(menu).getAllByRole("link").map((a) => a.textContent!.replace(/^\S+\s+/, ""))).toEqual(["Search", "Progress", "Settings"]); // after the icon
    await go(within(menu).getByRole("link", { name: /Settings/ }));
    expect(await ready()).toHaveTextContent("Settings");
    expect(document.getElementById("more-menu")).toBeNull(); // closes on navigation
  });
});

describe("taking an exam", () => {
  test("the countdown follows the clock; the palette shows answered, unanswered and marked questions", async () => {
    const user = userEvent.setup();
    const clock = testClock();
    await openSeeded(memoryStore(), clock.now);
    clock.advance(61_000);
    await waitFor(() => expect(screen.getByRole("timer")).toHaveTextContent("08:59"));
    await answerTrueFalse(user, "False");
    await user.click(screen.getByRole("button", { name: "Mark for review" }));
    const labels = screen.getAllByRole("button", { name: /^Question \d/ }).map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual(expect.arrayContaining([expect.stringMatching(/answered, marked for review$/)]));
    expect(screen.getByText(/1 answered · 1 unanswered · 1 marked for review/)).toBeInTheDocument();
    expect(screen.queryByText("Solution")).toBeNull(); // nothing is revealed during the exam
  });

  test("leaving the exam keeps the clock running and shows a banner; returning keeps the answers", async () => {
    const user = userEvent.setup();
    const clock = testClock();
    await openSeeded(memoryStore(), clock.now);
    await answerTrueFalse(user, "False");
    await go(screen.getByRole("link", { name: /Learn/ }));
    expect(await ready()).toHaveTextContent("Learn");
    clock.advance(2 * MIN);
    await waitFor(() => expect(screen.getByText(/A mock exam is in progress/)).toHaveTextContent("08:00 left"));
    await go(screen.getByRole("link", { name: "Return to the exam" }));
    expect(await screen.findByRole("timer")).toHaveTextContent("08:00");
    if (!screen.queryAllByText(/True or false/).length) await user.click(screen.getByRole("button", { name: "Next →" }));
    expect(screen.getByLabelText("False")).toBeChecked();
  });

  test("a reload resumes the exam with its time and answers; a reload after the deadline submits it as timed out", async () => {
    const user = userEvent.setup();
    const clock = testClock();
    const store = memoryStore();
    await openSeeded(store, clock.now, 5);
    await answerTrueFalse(user, "False");
    await waitFor(() => expect(slot(store)).not.toBeNull());
    cleanup();
    clock.advance(MIN);
    renderApp("/exam", store, clock.now);
    expect(await screen.findByRole("timer")).toHaveTextContent("04:00");
    if (!screen.queryAllByText(/True or false/).length) await user.click(screen.getByRole("button", { name: "Next →" }));
    expect(screen.getByLabelText("False")).toBeChecked();
    cleanup();
    clock.advance(10 * MIN); // well past the deadline
    renderApp("/exam", store, clock.now);
    expect(await screen.findByText(/submitted automatically when time ran out/)).toBeInTheDocument();
    const rec = saved(store).exams[0];
    expect(rec).toMatchObject({ endedBy: "timeout", elapsedMs: 5 * MIN, limitMs: 5 * MIN });
    expect(slot(store)).toBeNull();
  });

  test("time running out on the exam page submits it automatically", async () => {
    const user = userEvent.setup();
    const clock = testClock();
    const store = memoryStore();
    await openSeeded(store, clock.now, 1);
    await answerTrueFalse(user, "False");
    clock.advance(MIN);
    expect(await screen.findByText(/submitted automatically when time ran out/)).toBeInTheDocument();
    expect(screen.getByText("Total score").parentElement).toHaveTextContent("1 / 3");
    expect(saved(store).attempts.map((a) => [a.qid, a.mode])).toEqual([["ch04-q007", "exam"]]);
  });

  test("submitting asks for confirmation with the counts, then shows results computed from the record", async () => {
    const user = userEvent.setup();
    const clock = testClock();
    const store = memoryStore();
    await openSeeded(store, clock.now);
    await answerTrueFalse(user, "True"); // wrong
    clock.advance(3 * MIN);
    await user.click(screen.getByRole("button", { name: "Submit exam" }));
    const dialog = screen.getByRole("alertdialog", { name: "Submit the exam?" });
    expect(dialog).toHaveTextContent("1 of 2 answered, 1 unanswered (they score 0)");
    await user.click(within(dialog).getByRole("button", { name: "Keep working" }));
    expect(screen.getByRole("timer")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit exam" }));
    await go(screen.getByRole("button", { name: "Submit now" }));
    expect(await ready()).toHaveTextContent("results");
    expect(screen.getByText("Total score").parentElement).toHaveTextContent("0 / 3");
    expect(screen.getByText("Unattempted").parentElement).toHaveTextContent("1");
    expect(screen.getByText("Time taken").parentElement).toHaveTextContent("03:00");
    expect(screen.getByRole("table", { name: "By chapter" })).toHaveTextContent("Chapter 4: Dynamic Programming");
    expect(screen.getByRole("table", { name: "By difficulty" })).toHaveTextContent("Beginner");
    expect(screen.getByRole("heading", { name: "Answered incorrectly or partly (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unattempted (1)" })).toBeInTheDocument();
    await waitFor(() => expect(saved(store).exams).toHaveLength(1));
    expect(saved(store).exams[0]).toMatchObject({ endedBy: "submitted", elapsedMs: 3 * MIN });
    // The history lists it.
    await go(screen.getByRole("link", { name: "history" }));
    expect(await ready()).toHaveTextContent("Exam history");
    expect(screen.getByRole("link", { name: /Mock exam: Chapter 4/ })).toBeInTheDocument();
  });

  test("written answers are marked by the learner after submission and then count", async () => {
    const user = userEvent.setup();
    const clock = testClock();
    const store = memoryStore();
    renderApp("/exam", store, clock.now);
    await ready();
    await user.click(screen.getByLabelText(/Chapter 3: Finite Markov/));
    await user.click(screen.getByLabelText("Challenging"));
    await user.click(screen.getByLabelText(/Include written answers/));
    expect(screen.getByText(/^1 question available/)).toBeInTheDocument(); // ch03-q005 (Exercise 3.10)
    await go(screen.getByRole("button", { name: "Start exam" }));
    await user.type(await screen.findByRole("textbox"), "G' = G + c/(1-γ), so v shifts by c/(1-γ).");
    await user.click(screen.getByRole("button", { name: "Submit exam" }));
    await go(screen.getByRole("button", { name: "Submit now" }));
    expect(await screen.findByText(/1 written answer is waiting for your mark/)).toBeInTheDocument();
    expect(screen.getByText("Total score").parentElement).toHaveTextContent("0 / 4");
    const rubric = screen.getAllByRole("group", { name: /Mark your answer/ })[0];
    for (const box of within(rubric).getAllByRole("checkbox")) await user.click(box);
    await user.click(screen.getAllByRole("button", { name: "Record my mark" })[0]);
    await waitFor(() => expect(screen.getByText("Total score").parentElement).toHaveTextContent("4 / 4"));
    expect(saved(store).attempts).toEqual([expect.objectContaining({ qid: "ch03-q005", score: 4, selfMarked: true, mode: "exam" })]);
    expect(saved(store).exams[0].items[0]).toMatchObject({ score: 4 });
    expect(saved(store).exams[0].items[0].awaitingMark).toBeFalsy(); // a mark that is no longer pending is not stored
  });

  test("closing or reloading the tab during an exam asks first", async () => {
    await openSeeded(memoryStore(), testClock().now);
    const ev = new Event("beforeunload", { cancelable: true });
    const prevent = vi.spyOn(ev, "preventDefault");
    window.dispatchEvent(ev);
    expect(prevent).toHaveBeenCalled();
  });
});
