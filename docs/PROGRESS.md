# Progress

## Milestone 1: Textbook audit (done)
See [TEXTBOOK_AUDIT.md](TEXTBOOK_AUDIT.md). §12's source hierarchy was superseded by DECISION_LOG D-021.

## Milestone 2: Architecture (in progress)

Status as of 2026-11-04. Only items marked **done** are implemented and tested.

| Part | Status | Evidence |
|---|---|---|
| Project scaffold, pinned dependencies | **done** | `app/package.json`; `npm audit`: 0 vulnerabilities |
| Source registry (2015 draft core, Zhao + lectures supplementary, page maps) | **done** | `tools/build_sources.py` → `content/source/sources.json`: 15 + 14 chapters, 90 + 134 sections, 10 lectures |
| Curriculum (core = draft chapters; supplementary units attached to draft sections) | **done** | `content/curriculum/curriculum.json` |
| Content schema and validator | **done** | `app/src/content/schema.ts`, `tools/validate_content.ts`; `tests/schema.test.ts` (24 tests, 19 of them deliberately broken content) |
| Automated checks (example facts, numeric answer keys) | **done** | `app/src/content/checks.ts`, 21 checks; `tests/checks.test.ts` |
| RL core: bandits (2.1–2.8), finite MDP + Bellman backup, iterative policy evaluation, 4×4 gridworld; Robbins–Monro (supplementary) | **done, partial scope** | `app/src/lib/rl/`; `tests/rl.test.ts`. Not yet: value/policy iteration, MC, TD, Sarsa, Q-learning |
| Progress domain: five concept states, attempts, weak areas, SM-2 cards, activity | **done** | `app/src/domain/progress.ts`; `tests/progress.test.ts` |
| Persistence: versioned save, corrupt-data backup, export/import/merge | **done** | `app/src/store/persistence.ts`; `tests/persistence.test.ts` (jsdom) |
| Search engine over content (synonyms, typo, prefix, cross-references, tier labels) | **done** | `app/src/domain/search.ts`, `app/src/content/searchDocs.ts`; `tests/search.test.ts` |
| Verbatim-overlap check | **done** | `tools/check_overlap.py`: 0 matches at 9 and 12 words |
| Representative content | **done** (sample only) | 16 concepts, 11 equations, 1 algorithm, 1 example, 2 lesson sections, 11 questions, 22 notation entries |
| React shell: routes, layout, theme, KaTeX rendering, pages | **done** | Milestone 2b below |
| Service worker, CSP, dist privacy check | **done** | offline and CSP checked in the browser (Milestone 2b) |

### Test results (2026-11-04)
- `npx vitest run`: **6 files, 102 tests, all passed**.
- `npx tsc --noEmit`: clean.
- `npm run validate`: content valid, all 21 checks pass.
- `npm run overlap`: 0 matches.

### Found and fixed during this milestone
- My first worked example for (3.12) used v_π(5) = −20; it is −18. Fixed, and the arithmetic is now a check (`ch03.bellman-example-state-1`).
- My first hypothesis for Figure 4.2's rounding (truncation) was wrong; the check showed it. See D-027.
- The validator was wrongly strict on front-matter page labels (p. xiv); fixed in the rule, not the data.

## Milestone 2b: React interface (done, 2026-11-04)

The application shell and learning experience, built on the `ee50f81` foundation with the representative content only.

**Pages:**
- Dashboard (real numbers only, with empty states when there is no data).
- Learn: all 15 draft chapters grouped by part, with supplementary modules listed separately.
- Chapter pages: the section list with printed and PDF pages, ∗ optional sections, and empty-in-draft flags.
- Section pages: lesson layers, key terms, equations, figures, pseudocode, worked examples, exercises, citations, previous/next.
- Concept pages: the prerequisite chain, what the concept leads to, and a status picker.
- One page for each equation, algorithm, example and figure.
- Search: kind filters and a 2015-only toggle.
- Revision: equation library, algorithms, notation (with an optional 2018 column), spaced review, marked questions.
- Progress: backup export, import and merge, reset.
- Settings: theme, 2018 cross-references.

**Changes to the foundation (all additive):**
- `decodeSaved` and `encodeSaved` extracted from `persistence.ts` (D-028).
- A `Figure` type, with `figures` added to the bundle (D-029).
- `reviewQueue()` added to the progress domain.
- Search links point at routes (D-030).

All 102 foundation tests still pass unchanged.

**Tests:** `npx vitest run` runs **10 files, 605 tests, all passed**.
- `tests/routes.test.tsx` (300): every static route and main-nav link, all 29 chapters and modules, all 90 textbook sections and every supplementary Zhao section, every concept, equation, algorithm, example and figure page, and not-found.
- `tests/katex.test.ts` (167): every TeX string and every Markdown field with maths renders without a KaTeX error; raw HTML in content is escaped.
- `tests/interaction.test.tsx` (20):
  - search: the search page, the top-bar box and the supplementary filter;
  - progress: a concept status kept after reload; exercises graded, recorded and shown on the dashboard after reload; partial marks; marking questions for revision;
  - backup: export, import and merge, refusal of a bad file, reset with confirmation;
  - settings: theme and the 2018 setting saved and applied;
  - pages: lesson, figure, pseudocode and example rendering; supplementary material kept off core pages;
  - keyboard: spaced review by keyboard, the skip link, focus moving to the page heading, ordering questions solved by buttons alone.
- `tests/domain-ui.test.ts` (16): grading, content indexes, IndexedDB store logic (fresh store, legacy move-in, corrupt-data backup, failed save), review queue.
- Any `console.error` during a UI test fails it.

**Checked in the real browser (by hand):**
- Phone width (375 px): none of 16 representative pages scrolls sideways.
- IndexedDB: a status survived a full page reload.
- Production build:
  - the CSP meta tag is present and the console shows no errors;
  - KaTeX fonts load under the CSP (§2.4 renders 50 formulas with 0 errors);
  - the service worker precaches 65 files and controls the page.
- Offline: with the preview server stopped, a reload still renders §4.1 (maths and Figure 4.2), and search still works.

`npm run check` passes (validate, typecheck, tests, overlap 0 matches, build, privacy check). `npm audit`: 0 vulnerabilities.

### Outstanding issues
- **No visual review.** Browser-pane screenshots timed out because the window was hidden, so layout was checked by DOM measurement, not by eye. Please look at it on a laptop and a phone.
- **One 746 kB JavaScript bundle (236 kB gzipped).** KaTeX, markdown-it and all content load on first visit. Code-splitting per chapter (NLP Lab D-019) is needed before content grows.
- **Not automated.** Real IndexedDB and offline behaviour were verified by hand in the browser, not by an automated end-to-end test; jsdom has neither.
- **Representative content only.** Most sections say, accurately, that no material has been written yet.
- **Not built yet:** practice and mock-exam modules, interactive labs (bandits, DP, TD…), the concept-graph explorer.

### Next
Superseded by Milestone 3 below.

## Milestone 3A: Performance, question and progress formats (done, 2026-11-05)

**Bundle size** (production build, raw / gzip, JS + CSS):

| What is downloaded | Before (2b) | After (3A) |
|---|---|---|
| Opening the dashboard | 784.9 / 243.9 kB (one script + one CSS) | 308.6 / 93.5 kB (shell script, runtime, base CSS) |
| Settings or progress page | same 784.9 / 243.9 kB | 316.0 / 96.3 kB |
| A section with maths (§4.1) | same 784.9 / 243.9 kB | 740.1 / 232.0 kB (adds the page code, the maths renderer and ch04) |
| First search (all units) | same 784.9 / 243.9 kB | 375.3 / 114.8 kB |

Maths pages still need the maths renderer (KaTeX and markdown-it, 358 kB raw / 120 kB gzipped), which is now a separate file fetched once. The main gain is that nothing else pays for it, and each new chapter adds its own chunk instead of growing the first load.

**Features:**
- Lazy-loaded routes, maths renderer and content: a catalogue up front, one chunk per unit, supplementary units fetched only when requested (D-031).
- Loading states, error boundaries and a "Try again" that really fetches again.
- Service worker:
  - stores the shell at install and chapters on first use;
  - **Save everything for offline** in Settings, with a real stored-file count;
  - an app update keeps saved chapters (D-032).
- Question format: provenance (4 kinds), section mapping, rubric, short-answer type, option notes, related questions, the code-interpretation category, and the exercise registry of the draft (D-033).
- The 11 existing questions moved to the new format. The question card shows provenance ("Exercise 4.1, reworded", "Derived from the textbook", "New application question") and option notes, and calls its items "Question" instead of "Exercise".
- Progress format version 2: bookmarks, exam records, attempt mode and time, with migration from version 1 (D-034).

**Tests:** `npx vitest run` runs **13 files, 659 tests, all passed** (605 before).
- New `tests/questions-schema.test.ts` (28): the exercise registry, all real questions, and 19 deliberately broken questions rejected.
- New `tests/progress-v2.test.ts` (10): v1 saves and exports, IndexedDB re-save, bookmarks, exam records, malformed records, merge.
- New `tests/loading.test.tsx` (16): the catalogue and unit chunks against the content files, only the needed units fetched, no supplementary fetch from core pages, loading state, failed download with retry, failed page code with retry, a page bug kept inside its boundary.
- Existing tests: assertions unchanged. Interaction tests preload first (D-031), the async wait is 5 s, and two schema-number expectations moved from 1 to 2 (D-034).

`npm run check` passes: validate, typecheck, tests, overlap (0 matches at 9 words), build and privacy check. `npm audit`: 0 vulnerabilities.

**Checked in the real browser (production build):**
- **Dashboard:** it requests 3 files (shell script, runtime, CSS), no content and no KaTeX. The worker stores 36 files at install.
- **§4.1:** it requests its page code, the renderer and ch04 only (28 formulas, 0 KaTeX errors). ch04 is then stored.
- **Server stopped:**
  - §4.1 reloads fully;
  - unopened §2.4 shows the error panel with the navigation still working;
  - Settings reports 37 of 81 files stored.
- **Save everything:** 81 of 81 stored. With the server stopped and a full reload, search (33 results), §2.4 (50 formulas), the supplementary module and the notation all work.
- **Update:** after rebuilding, the new cache carried over all 5 stored content chunks.
- **IndexedDB:** a status set on a concept page survived a reload, saved with schema 2. It was then reset to "not started".
- **No CSP errors.** The only console errors were the deliberate offline failure.
- **375 px:** 23 pages fit with no horizontal scroll, after two fixes:
  - the equation-library chapter menu was 581 px wide;
  - the move buttons of the §4.1 ordering question were pushed off-screen by a long formula.

  The Milestone 2b check compared page width with viewport width, which grow together when a page overflows, so it missed both. The check now also requires the viewport to stay 375 px.
- **Desktop:** the sidebar layout is unchanged.

### Outstanding issues
- **Still no visual review by eye** (screenshots time out in the hidden pane). Layout was checked by measurement.
- **Maths pages still download the 358 kB maths renderer** on first use.
- **Search downloads every unit on its first query** (it covers supplementary material too). Results can still be filtered to the 2015 draft.
- **Supplementary section mapping** checks that a section exists in Zhao's book, not that it is in that unit's attached Zhao chapters.
- **Rubric marking UI** (ticking marking points) arrives with the practice environment in 3B. Short answers use the existing single self-mark until then.
- **Not automated:** offline and IndexedDB behaviour in a real browser were checked by hand, not by an end-to-end test.
- **Test-browser activity log:** the activity log of the browser pane's test profile keeps the entries from the status check above (statuses and attempts are empty).

### Next: Milestone 3B
Done, see below.

## Milestone 3B: Question engine and Practice (done, 2026-11-05)

**Features:**
- **Practice** is in the main navigation (`/practice`).
- **Choosing questions:**
  - filter by chapter or module, section, topic, difficulty, question type, and where questions come from;
  - draw from all questions, not attempted, wrong last time, repeated mistakes, bookmarked, or flagged; the counts shown are real;
  - order them at random (seeded, with the seed shown), by mixed topics, or in book order;
  - choose how many.
- **Quick starts** from your history: re-attempt mistakes, repeated mistakes, bookmarked, flagged. Each is disabled when empty.
- **Two feedback modes:**
  - after each question: check answers as you go;
  - at the end: no answers or solutions are shown until you finish.
- **Answering:**
  - numerical answers accept decimals, fractions and a typographic minus sign, and are graded with each part's stated tolerance;
  - derivations and short answers are written in your own words and marked by you against a rubric of points, never by the app.
- **During a session:**
  - solutions can be revealed one step at a time;
  - Bookmark and Flag for revision are separate;
  - a question palette shows each question's state;
  - you can move to the previous and next questions;
  - finishing with unanswered questions asks for confirmation, and those questions are not counted as attempts.
- **Results:** score, accuracy, correct, partly correct and not correct, unanswered, time, and a question-by-question review with solutions. You can re-attempt the ones not fully correct, re-run the same questions in a new order, or start a new practice.
- **Saved progress:** attempts carry mode, time and session id. An open session survives a reload.
- **New questions:** 23, bringing the bank to **34** (32 core, 2 supplementary):
  - every question type (mcq, multi, numeric, multi-numeric, ordering, true/false, derivation, short answer), with categories including algorithm tracing, code interpretation, scenario and compare/contrast;
  - all four difficulties and all four provenance kinds;
  - **5 reworded textbook exercises:** 3.9, 3.10, 3.12, 4.1, 4.2. Each cites the exercise's printed and PDF page; they are reworded, with no book text.
- **Verification of the new questions:**
  - every numeric answer is recomputed by a named check. New checks cover Exercise 4.2 solved on the extended gridworld, the exact v₃ values, Exercise 3.9's right-hand side 0.675, and ε-greedy's 0.91;
  - derivations are backed by numerical checks (the constant-shift result of Exercise 3.10 on a small continuing task, and v = Σπq on the gridworld);
  - conceptual questions were checked against the draft's text: every claim and every wrong-option note cites the page it rests on;
  - the overlap check found 3 phrases close to the book's wording, which were reworded (0 matches now).
- **New code:**
  - `lib/rl/returns.ts` (discounted returns, returns of an episode, constant-reward return), tested through the checks;
  - `domain/answer.ts`, `domain/practice.ts`, `domain/session.ts`, additions to `domain/progress.ts` and `domain/grade.ts`;
  - `components/question.tsx`, `pages/Practice.tsx`, and a saved slot in `ProgressContext`.

**Tests:** `npx vitest run` runs **15 files, 810 tests, all passed** (659 before).
- New `tests/practice-engine.test.ts` (25):
  - the bank's coverage, and every numeric key against its check;
  - drafts, tolerance at and beyond the edge, fractions, rubric marks;
  - every filter and pool against real content, seeded determinism, interleaving, book order;
  - per-question history;
  - the session state machine (timing, check, self-mark, step reveal, deferred finish, summary, stored-session check).
- New `tests/practice-ui.test.tsx` (7): navigation and real counts, filters, a full immediate-feedback session (with step reveal, bookmark, flag, palette, confirmation, results), re-attempting a mistake from results and from setup, deferred feedback, rubric self-marking, and resuming after a reload.
- The KaTeX and route tests now also cover the 23 new questions.
- Changed: two exact-list expectations in `tests/domain-ui.test.ts` (D-036).

`npm run check` passes: validate (34 questions, 32 checks), typecheck, tests, overlap 0, build, privacy. `npm audit`: 0 vulnerabilities.

**Bundle (raw / gzip):**

| Page | Size |
|---|---|
| Dashboard | 316.8 / 94.7 kB (was 308.6 / 93.5: the catalogue now lists 34 questions) |
| Practice setup | 729.5 / 227.3 kB |
| A practice session over chapters 2–4 | 814.0 / 250.5 kB |
| §4.1 | 763.0 / 237.7 kB |

**Checked in the real browser (production build):**
- **A Chapter 3 session:** 7 questions matched, an answer was graded "Correct: 2 / 2", the palette updated, and the step-by-step hints appeared, with 0 KaTeX errors.
- **Reload:** the session resumed at the same question with its result.
- **375 px:** all 7 questions of the session, the results page and the setup page (all filters open) fit, as do 16 other pages, which now show the new questions with 0 KaTeX errors. The 7 bottom-navigation items are 54 px wide each.
- **Offline (server stopped):** after a reload, a 10-question practice session over chapters opened earlier started and ran.
- **Clean-up:** the browser profile's test data (progress and the saved session) was then cleared.

### Outstanding issues
- **No visual review by eye yet** (screenshots still time out). Layout was checked by measurement.
- **The Practice setup screen downloads the maths renderer** although it shows no maths, because the session view is in the same file. The renderer is needed seconds later when the session starts. Splitting it would delay the first question instead.
- **Time per question** counts while the question is on screen, including time the tab is in the background.
- **Navigation will run out of room:** the bottom bar has room for 7 items. Mock Tests (3C) and the Lab (3D) need a "More" menu or a different phone layout.
- **The bank is still small** (34 questions, chapters 2–4 and one supplementary module). The engine works for any size, but mock exams in 3C will draw from this bank until more content is written.

### Next: Milestone 3C
Done, see below.

## Milestone 3C: Mock exams (done, 2026-11-05)

**Features:**
- **Mock exams** (`/exam`):
  - setup: chapters (supplementary modules only when ticked), difficulty, number of questions, duration (1–180 minutes), and whether to include written answers. Counts are real;
  - questions are drawn at random from the bank with a seed.
- **During the exam:**
  - a countdown, pinned to the top of the page, with screen-reader warnings at 5 minutes and 1 minute left;
  - a question palette showing answered, seen but unanswered, not visited, and marked for review;
  - Mark for review, previous and next;
  - no answers or solutions are shown.
- **Submitting:** a confirmation panel shows the answered, unanswered and marked counts, with "Submit now" or "Keep working". The exam is submitted automatically when time runs out.
- **The clock is wall-clock based (D-037):**
  - it keeps running when you leave the page, and other pages show a banner with the time left;
  - a reload resumes the exam with its answers;
  - a reload after the deadline submits it as timed out, at the deadline;
  - closing or reloading the tab asks first.
- **Results, computed from the stored record:**
  - total score and percentage, accuracy on answered questions, fully correct, unattempted, and time taken out of the limit;
  - tables by chapter, by difficulty and by topic;
  - lists of the questions answered incorrectly or partly and the unattempted ones, and every question with your answer and its solution;
  - written answers are marked by you on the results page, and then count.
- **Records:** attempts are logged with mode "exam", the exam id and time. Exam records are stored with your progress and are included in export, import and merge.
- **History:** exam history (`/exam/history`).
- **Phone navigation:** the bottom bar has 5 destinations plus More (Search, Progress, Settings). The desktop sidebar shows all 8.

**Tests:** `npx vitest run` runs **17 files, 834 tests, all passed** (810 before).
- New `tests/exam-engine.test.ts` (15):
  - question choice: written answers and supplementary modules, filters, seed;
  - the deadline, wall-clock time left, navigation timing, time away after a reload, duration limits, clock formatting;
  - question states and counts, answers locked at time-out;
  - submission: grading, written answers kept for marking, only answered questions logged;
  - time-out at the deadline even when submitted late;
  - results and breakdowns computed from the record, marking written answers afterwards, record storage, export and replacement, checking a stored exam before resuming.
- New `tests/exam-ui.test.tsx` (9), with a test clock:
  - setup counts, and the More menu;
  - the countdown, palette and mark for review;
  - leaving the exam (banner) and returning with answers kept;
  - reload resume, and timed out on a late reload;
  - automatic submission on the page;
  - the confirmation panel, results, tables, lists and history;
  - written answers marked after submission;
  - the close or reload warning.
- No existing test was changed. The test helper `renderApp` now accepts a clock.

`npm run check` passes: validate, typecheck, tests, overlap 0, build, privacy. `npm audit`: 0 vulnerabilities.

**Bundle (raw / gzip, the full set of files each page loads):**

| Page | Size |
|---|---|
| Dashboard | 321.1 / 95.8 kB (3 files; was 316.8 / 94.7: More menu and exam banner) |
| A mock exam over Chapter 2 | 782.8 / 241.8 kB |

The exam banner's clock formatter was moved into its own small module, so the app shell does not pull in the exam engine.

**Checked in the real browser (production build):**
- **Countdown:** a 2-minute Chapter 2 exam counted down (01:59, then 01:57 two seconds later).
- **Leaving and returning:** an answer marked for review, then leaving for Learn, showed the banner ("01:44 left"). Returning with an ordinary click kept the answer and the review mark.
- **Reload:** a reload resumed at 01:31 with the answer kept.
- **Time-out:** left to run out on the page, the exam was submitted automatically ("02:00 of 02:00", timed out). The results page shows all three tables with 0 KaTeX errors.
- **375 px:** all 4 questions, the confirmation panel, the results page with every review section open, and exam history fit. The timer stays pinned when scrolling. The bottom bar has 6 items of 63 px; the More menu fits on screen and closes on navigation.
- **1280 px:** the sidebar shows all 8 destinations, with no More button.
- **Offline (server stopped):** a 10-question Chapter 2 exam started and was submitted after a reload.
- **Clean-up:** submitting cleared the saved exam slot. The test profile's progress was then cleared.

### Outstanding issues
- **No visual review by eye yet** (screenshots still time out).
- **The bank is small:** 28 auto-marked core questions (32 with written answers), so long exams repeat the same pool. More questions arrive with content work.
- **Leaving the app with an exam open:** the clock keeps running (by design). If the deadline passes while the app is closed, the exam is submitted on the next visit to the exam page, and the banner on other pages says time is up until then.
- **Questions with several topics** count once under each topic in the topic table (stated on the page), so topic rows do not add up to the total.
- **Test-harness workaround** for navigation clicks in the exam UI tests (D-037).

### Next: Milestone 3D
The bandit, MDP and Bellman laboratories:
- every intermediate value shown;
- update-by-update stepping with seeded runs;
- computations from `lib/rl`, verified against the draft's examples.
