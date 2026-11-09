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

## Milestone 3D: Bandit, MDP and Bellman laboratories (done, 2026-11-05)

- **Labs** (`/lab`): a multi-armed bandit laboratory, an MDP explorer and a Bellman equation laboratory.
- **Bandit lab:** greedy and ε-greedy (sample-average or constant α), optimistic initial values, UCB, and the gradient bandit.
  - A step inspector shows every number of each update.
  - Experiments average many runs and show reward and %-optimal curves.
  - Presets reproduce the behaviour of Figures 2.1–2.4. Checked in the code: greedy ≈ 1.03 average reward and 35% optimal; best possible 1.539; the UCB spike at step 11; the baseline effect.
- **MDP explorer:** an editor that checks every distribution, a layered transition diagram, (3.7) and (3.8), and v_π computed exactly and iteratively. Presets: the recycling robot (Table 3.1, with parameters the app chose) and the gridworld (matches Figure 4.2 exactly).
- **Bellman lab:** one state's backup split into its terms (Exercise 3.9 preset gives 0.675), and iteration sweep by sweep towards v_π.
- **Content:**
  - a new `Lab` content type, validated;
  - 3 concepts: optimistic initial values, the gradient bandit, the finite MDP;
  - equations (2.9) and (2.10), checked against the page image;
  - a `suspected-typo` flag on (2.9): its numerator is printed with an unmatched parenthesis.
- **Search:** finds labs. Direct matches now always rank above cross-references.
- **Tests:** 890 pass. The new tests are `lab-algorithms` (23) and `lab-ui` (10), plus 10 lab fixture checks. Two existing expectations were updated for the new content: the dashboard count, now 18 core concepts, and the UCB search ranking, which needed the ranking fix.
- **Checked in the browser, including by eye** (screenshots now work):
  - the chart ticks and labels were fixed, and the transition diagram was redesigned and has no label overlaps;
  - 375 px fixes: fieldsets and long dropdowns;
  - 2000 × 1000 runs of three methods take 2.1 s in the browser.

### Next: Milestone 3E
Done, see below.

## Milestone 3E: Dynamic programming, Monte Carlo and TD laboratories (done, 2026-11-05)

**Labs:**
- **Dynamic programming:**
  - policy iteration, stepped evaluation by improvement, showing the values, the greedy arrows (ties drawn together) and the states that changed;
  - value iteration, sweep by sweep, with Δ;
  - problems: the 4×4 gridworld, the gambler's problem (value and stake charts like Figure 4.6), the recycling robot and the windy gridworld.
- **Monte Carlo:**
  - episodes with their returns computed backwards;
  - first-visit or every-visit, with sample averages or constant α, and each update written out;
  - estimates against the true values, with an RMS curve;
  - Monte Carlo ES on the gridworld, with its departure from the draft stated.
- **Temporal difference:**
  - TD(0) stepped, showing the target, TD error and new value;
  - Figure 6.6 (estimates over states) and Figure 6.7 (RMS curves, 100 sequences);
  - a Sarsa / Q-learning inspector on cliff walking and the windy gridworld, showing every quantity of each update, the agent, the greedy arrows, max Q and the greedy path;
  - a comparison of the two on Figures 6.13 and 6.11.

**Code:**
- `lib/rl`: `dp.ts` (`greedyPolicy`, `policyIteration`, `valueIteration`), `sampling.ts`, `mc.ts`, `td.ts`, `envs/examples.ts`;
- components: `GridView`, and `LineChart` gained `xFrom`.

**Content:** 8 concepts (Chapters 4–6); equations (4.9), (4.10), (6.1), (6.2), (6.5) and (6.6), checked against the page images; 7 pseudocode boxes (Figures 4.3, 4.5, 5.1, 5.4, 6.1, 6.9, 6.12), with Figure 4.3's acknowledged bug flagged; 3 labs; 9 new draft fixtures (51 checks in all).

**Fixtures, reproduced:**
- gridworld: v* and policy iteration in 2 evaluations;
- gambler, p_h = 0.4: v(25), v(50), v(75) = 0.16, 0.4, 0.64;
- random walk: Monte Carlo converges; TD beats MC (Figure 6.7) from the start value 0.236;
- windy gridworld: minimum 15 steps, 130–200 episodes by 8000 steps;
- cliff: Sarsa > Q-learning online, Q-learning's path 13 steps;
- Monte Carlo ES finds an optimal gridworld policy.

**Measured differently from the draft:** windy-gridworld episodes average about 20 steps after 8000 steps, against the draft's "about 17" (D-039).

**Tests:** **21 files, 1017 tests, all passed**.
- New: `lab3e-algorithms` (18) and `lab3e-ui` (8).
- Three existing expectations changed: the dashboard concept count (now 26), the dependents of the Bellman equation (TD(0) added), and the focus test's Learn link, now scoped to the main navigation because the dashboard lists "Temporal-Difference Learning".

`npm run check` passes (overlap 0, privacy check).

**Checked in the browser:**
- 375 px: all lab pages and the new section, concept, equation and algorithm pages fit after running the experiments, with 0 KaTeX errors;
- seen by eye: the TD inspector and cliff grid (legible at phone width), and the gambler's stake chart (Figure 4.6's shape);
- fixed after looking: the value chart is now drawn for capital 1–99 only, and chart table rows fall on round x values.

### Next: Milestone 3F
Algorithm explainers for every implemented algorithm, progress integration of the labs and questions, and final QA.

## Milestone 3F: Algorithm explainers, progress integration and final QA (done, 2026-11-05)

**Explainers.** Every implemented algorithm has one page at `/algorithm/<id>`, in eleven parts:
1. the problem it solves;
2. prerequisites, from the concept graph;
3. the mathematics (the draft's equations as equation cards);
4. a derivation, where one fits: the incremental average, the gradient-bandit update, the policy-evaluation, value-iteration and TD(0) updates;
5. the pseudocode box;
6. the exact source of the function that runs it, loaded from `lib/rl` as text;
7. a worked example, with a button that re-runs its computed check in the browser;
8. a live demonstration: the lab panel itself, preset for that algorithm and stepped one update at a time with every intermediate value;
9. strengths and limitations;
10. a comparison table linking related algorithms;
11. practice questions on the concept, with a link that opens Practice preset to them.

The eleven algorithms: ε-greedy, UCB and the gradient bandit (new boxes, because the draft gives these as equations, not pseudocode, and the page says so); iterative policy evaluation, policy iteration and value iteration; first-visit MC and Monte Carlo ES; TD(0), Sarsa and Q-learning. Sarsa's demonstration starts on Sarsa and Q-learning's on Q-learning; their worked examples use the same transition to show the two targets (−4 against −2).

**Content:**
- `Explainer` type in `schema.ts`. The validator requires one on every algorithm, with equations on the same side of the core/supplementary line, a known demonstration key and lab, non-empty strengths, limitations and comparisons, and comparisons that name real algorithms or concepts.
- 16 new questions, all `textbook-derived` with sources, so that every algorithm's concept has at least two: Chapter 2 (2), Chapter 4 (4), Chapter 5 (4, new file) and Chapter 6 (6, new file). Numeric answers are computed by the app's own code (9 new checks); statements were checked against the text layer of the cited pages.
- 4 worked-example checks: the gradient-bandit update, first- versus every-visit returns, two TD(0) steps, and Sarsa against Q-learning on one transition.
- 50 questions and 64 checks in all; overlap check 0 matches.

**Progress** (all computed from the stored attempts, exams, cards and activity; nothing new is stored, so the v2 format, export and import are unchanged):
- Progress page:
  - questions attempted, correct and incorrect (by latest attempt), marks scored and time measured;
  - a revision backlog: cards due, questions to re-attempt, questions marked, concepts set to "Needs revision", each linked to where it is worked through;
  - repeated mistakes and bookmarks, each with a Practice link (`/practice?pool=repeated`, `?pool=bookmarked`);
  - mock-exam history: count, latest, best and average;
  - topic mastery: each concept's self-set status beside the evidence (questions attempted of those available, marks on the latest attempt of each);
  - laboratories used, from the activity log (opening a lab now logs it, once per visit).
- Dashboard: the backlog and mock-exam tiles, a link to the full page, and activity lines in words for every kind (exam and lab entries were mislabelled "Set status of" before).

**Practice deep links:** `?concept=<id>` presets the chapters and topic; `?pool=<pool>` presets the pool.

**Found in final QA and fixed:**
- After an update, a page left open can ask for code files of the old version, which the new service worker has deleted. "Try again" could never succeed there. The page now notices the change of worker and offers "Reload the app" instead (D-041).
- The explainer route was missing from the preload list, which Settings → Save for offline and the tests use.
- An earlier content script turned `\t` in `\tfrac` into a tab character; a test now fails if any content string holds a control character, and none remain.

**Tests:** **22 files, 1129 tests, all passed**.
- New: `explainer3f` (20), plus 2 in `loading` for the update case.
- Changed expectations, both from the 16 new questions: the Practice match count (32 → 48) and the mock-exam counts (28 → 44 auto-marked, 32 → 48 with written answers).

`npm run check` passes: validate, typecheck, tests, overlap (0 matches), build and the privacy check.

**Final QA, on the production build:**
- All 41 routes at 375 px (every page, lab and explainer, plus not-found): no error panels, no KaTeX errors, no horizontal page scroll. Every element wider than the screen sits in its own scroll box (tables, code, wide equations).
- Desktop at 1280 px: explainers (two-column strengths and limitations, comparison table) and the Progress page checked by eye.
- Offline: after Save for offline (105 of 105 files), the preview server was stopped and an explainer with its source code, Chapter 6, the TD lab, Progress and a Practice deep link all loaded from the service worker.
- Console: no CSP or runtime errors, apart from the update case above, which led to the fix.

**Bundle (raw / gzip):** app shell `index.js` 313.5 / 93.7 kB; maths renderer 357.9 / 119.6 kB, loaded with the first page that shows maths; explainer page 10.9 / 3.9 kB plus the lab panels it shares with the Lab page; Progress 12.7 / 4.3 kB. Build total 2.5 MB in 106 files, mostly KaTeX fonts.

### Milestone 3 checklist
- 3A performance and schemas: done (route and unit chunks, offline storage, progress v2).
- 3B question bank and practice: done.
- 3C mock exams: done.
- 3D bandit, MDP and Bellman labs: done.
- 3E DP, Monte Carlo and TD labs: done.
- 3F explainers, progress integration and final QA: done.

### Outstanding issues
- Windy-gridworld episode length after 8000 steps is about 20 here, against the draft's "about 17" (D-039); not explained.
- Monte Carlo ES cuts looping gridworld episodes at 50 steps, a stated departure from the draft (D-039).
- The 2018 cross-references are still unverified (no copy of the 2018 edition was checked).
- Not checked here: real phones, Safari and Firefox (the checks used the app's Chromium pane), and screen readers beyond the accessibility tree.
- Explainer prerequisites show the full prerequisite chain, which is long for the Chapter 6 methods.

### Next
Textbook coverage beyond Chapters 2–6, starting with the chapters the draft builds on next (Chapter 7, eligibility traces), using the same content types, checks and explainers.

## Milestone 4: Comprehensive textbook coverage (in progress)

The plan and its baseline are in [COVERAGE_AUDIT.md](COVERAGE_AUDIT.md), approved on 2026-11-07 with its six recommended decisions:
1. Chapter 1 is covered after Chapter 6.
2. Summary, history and bibliographic sections get reading guides.
3. Programming exercises become guided lab tasks.
4. Chapter 14 gets lessons and questions only.
5. Monte Carlo ES moves to blackjack.
6. Placeholder exercises 3.7 and 8.1 are listed as placeholders.

The live, per-section status is [docs/coverage/](coverage/README.md), generated from the content and checked by `npm run check`.

### Milestone 4A: Coverage tooling, validation, search index, reading progress (done, 2026-11-07)

No new learning content: this step builds the means to measure and check it.

**Source inventory.** `tools/build_inventory.py` (`npm run inventory`) reads the draft's text layer and writes `content/source/inventory.json`. For each chapter introduction and section it records the numbered equations, the named examples, the figure captions and the approximate length. It records numbers only, never text.
- Totals: **80 equations, 36 examples, 104 figure captions**.
- Each is assigned to exactly one place, and the numbering runs without gaps through every chapter (tested).
- Ligatures in the text layer (ﬁ, ﬀ, ﬃ) had hidden five section headings (§3.4, 4.7, 5.5, 5.7, 7.7); the text is now normalised.
- Equation numbers cited again later in the text are not counted twice.
- Chapter 4's (4.1)–(4.2) sit in the chapter introduction, before §4.1, so introductions are tracked too.
- **Examples 4.1 and 6.3, which the audit could not locate, are confirmed:** both are headed without a colon.

**Coverage.** `content/coverage.ts` computes each section's status from the content and the inventory:
- **covered** needs all four: a lesson, every numbered equation the draft has there, every named example (as a worked-example item or a lab check), and at least one question;
- **partial** lists what is missing;
- the other statuses are **not started** and **unwritten in the draft**.

`content/coverage/coverage.json` declares only what cannot be computed:
- reading-guide sections (the summaries, the Chapter 1 history and the bibliographical remarks);
- examples reproduced by lab checks (4.3, 6.2, 6.5, 6.6);
- the two placeholder exercises;
- sections that are thin in the draft (§7.8, 7.9, 11.2, and the partly written Chapter 15).

A declaration can never make a section covered on its own (tested). The validator checks every declaration, for example that only exercises the registry marks as placeholders may be declared placeholders.

**Coverage report:** `npm run coverage` writes `docs/coverage/README.md` and one page per chapter, listing what each section still needs. `npm run check` now fails if the committed report is out of date.

**Baseline** (honest, before any 4C–4N content):

| | Covered |
|---|---|
| Written sections | 2 of 86 (§2.3 and §2.4) |
| Numbered equations | 18 of 80 |
| Named examples | 5 of 36 |
| Exercises | 7 of 85 (5 in the bank, 2 declared placeholders) |

**Validator** (`npm run validate`, new module `content/quality.ts`). New errors:
- links written inside Markdown that do not resolve. Content links use in-app routes such as `#/concept/<id>` or `#/learn/ch04/4.2`; external links are refused;
- control characters in any string;
- TeX that KaTeX cannot parse, in every field (moved from the tests into validation; the renderer's functions now live in `lib/renderCore.ts` so Node can use them without the stylesheet);
- identical question stems;
- equation and example labels that the draft does not have, or that sit in a different section from the one the item cites.

New warnings (`npm run validate -- --warnings`):
- near-duplicate questions;
- equations no lesson, question or explainer uses;
- lesson references to items outside the section's concepts and their prerequisites.

The page-range check against the cited section already existed; the audit had listed it as missing, and the audit is corrected. Current state: 0 errors, 1 warning: (2.1) is not yet used by any lesson or question.

**Search** is built at build time into its own chunk (`virtual:rl-search`, 68.2 / 15.3 kB). The first search fetches that chunk and the search engine and **no chapter content** (tested). Before, it loaded every chapter, which would not have scaled.

**Reading progress and bookmarks:**
- Each section page has "Mark as read" and "☆ Bookmark". Reading is the learner's own statement and is never inferred from a visit.
- The chapter list shows how many sections are read; a chapter's section list shows ✓ read and ★.
- Progress has a Reading card with sections read per chapter and the bookmarked sections.
- Stored as two optional fields, `sectionsRead` and `sectionBookmarks`. The saved format stays version 2, so older saves and backups load unchanged (tested); import, export and merge carry the new fields.

**Coverage badges:** chapter and section listings and section pages show Covered, Partial, Not started or Unwritten in draft, with an explanation on hover. This replaces the old "Material" and "Outline only" badges, which said nothing about completeness.

**Tests:** **23 files, 1151 tests, all passed.**
- New: `coverage4a` (22): the inventory, coverage, declarations, quality checks (each error and warning provoked deliberately), the search index, reading progress and the badges.
- One changed expectation: the catalogue test now passes the coverage summary, because the catalogue gained that field.
- **Test timing:** on 2026-11-07 the machine ran the suite slowly: 54–67 s, against 43 s before, at the previous commit too. Two of five full runs each failed a *different* UI test that was waiting for its first render (5.7–6.2 s, over the 5 s wait ceiling). The ceiling (`asyncUtilTimeout` in `tests/setup.ts`) is now 10 s. It limits waiting and relaxes no assertion: an element that never appears still fails. The new quality checks also cache KaTeX results, to lighten the parallel load. Three full runs afterwards all passed.

`npm run check` passes (overlap 0 matches, privacy check).

**Checked in the browser** (375 px):
- the Learn list with its badges;
- the Chapter 4 section list;
- a section page's read and bookmark toggles, which persist and show on the chapter page;
- search from the prebuilt index;
- no console errors.

The test mark made during the review was removed afterwards.

**Bundle:** app shell 317.1 / 94.6 kB (was 313.5 / 93.7: the coverage summary and the reading interface).

**Outstanding:**
- Rebuilding the inventory needs the local, git-ignored text layer. The committed `inventory.json` is what the app and the checks use.
- Section word counts are approximate.

#### Next: Milestone 4B
Verification: the windy-gridworld investigation, blackjack (Examples 5.1, 5.3 and 5.4) with Monte Carlo ES moved to it, the gridworld ES variant discarding cut-off episodes, and tests of the random-number generator.

### Milestone 4B: Verification of the outstanding issues (done, 2026-11-07)

**A. Windy gridworld (Example 6.5): investigated and resolved as far as the source allows.**
- **The draft's "about 17 steps" is exact.** The ε-greedy (ε = 0.1) policy around the optimal one takes **17.05** steps on average, by exact policy evaluation (`lab.td.windy-17-steps`). The best ε-greedy policy of all takes 17.048.
- **Our implementation is not the cause.** An independent Sarsa written from (6.5) and Figure 6.9, using a different random-number generator (xorshift) and either tie rule (random or first), gives the same results as the library over 100 seeds:

  | Implementation | Episodes in 8000 steps | Steps per episode near 8000 |
  |---|---|---|
  | Library | 158 | 26.3 |
  | Independent, random ties | 162 | 25.6 |
  | Independent, first-index ties | 159 | 26.1 |

- **What does not reproduce** is the draft's description of its α = 0.5 run. By 8000 steps the greedy policy "was long since optimal", it says, yet only 17–22% of seeded runs here have an optimal greedy path then. Episodes stay near 19 steps even after 200,000 steps, because the large step size keeps the greedy policy moving.
- **With α = 0.1, Sarsa settles at 17.06 steps** (29 of 30 seeds optimal), and with α = 0.05 at 17.07 (30 of 30): the exact value. A three-seed version is a check (`lab.td.windy-sarsa-settles`).
- The TD lab now carries a new flag type, `replication-discrepancy` ("Measured differently from the draft"), with this explanation. Nothing was tuned to match.

**B. Monte Carlo ES moved to blackjack; the cut-off is now honest.**
- **Blackjack** (`lib/rl/envs/blackjack.ts`) is Example 5.1 as a finite MDP with exact dynamics. The draft's infinite deck makes every probability computable:
  - hitting draws one card;
  - sticking resolves against the dealer's exact final-sum distribution;
  - a "deal" state holds the naturals and the automatic hits below 12.
- **Three independent checks of the model:**
  1. **Example 5.4:** exact policy evaluation gives **−0.27720** for dealer 2, sum 13, usable ace under "stick only on 20 or 21". The draft's estimate from 10⁸ episodes is −0.27726, within its sampling error.
  2. **Figure 5.5:** value iteration gives exactly the draft's optimal policy, read from the page image, **including the "notch"** (stick from 19 against an ace with a usable ace) that the draft says Thorp's strategy lacks.
  3. **The card game played directly:** 200,000 simulated games with random cards agree with the exact values, from the deal and from Example 5.4's state, within 4 standard errors.
- **Monte Carlo ES on blackjack** (Example 5.3) starts from "stick only on 20 or 21", as the draft does. It reaches 195–197 of 200 optimal states after 500,000 episodes (199 after 2,000,000), and every state whose two action values differ by more than 0.1 is right. Closer decisions can still be wrong at that point, because each Q(s, a) averages returns earned under earlier, worse policies, and with about 2000 returns per pair the noise in a difference is about 0.03–0.04. No episode is ever cut off. In the browser, 500,000 episodes give 199 of 200.
- **Cut-off episodes are now discarded.** Milestone 3E averaged the partial returns of gridworld episodes cut at 50 steps, which biased Q downwards; that departure is removed. A cut-off episode is not a sample of the return, so it updates neither Q nor π.
- **On the gridworld, ES now stalls honestly:** about 93% of episodes loop and are discarded, and the policy stops improving (`lab.mc.es-needs-termination`). This is the draft's own point (pp. 122, 157) that Monte Carlo methods need episodes that end. The lab offers it as a labelled demonstration beside blackjack.
- **`runEs`** runs ES in place for large experiments. It makes exactly the same updates and random draws as repeated `esEpisode` calls (tested on blackjack and the gridworld).
- The Monte Carlo lab's ES panel now shows blackjack's learned policy as two tables, with every state that differs from the exact optimum marked, and the last episode's updates written out.

**C. 2018 cross-references:** unchanged; still flagged as unverified.

**Random-number generator (mulberry32), tested:**
- reproducible per seed;
- values in [0, 1);
- mean and variance of a uniform distribution;
- a chi-squared test over 20 bins (200,000 draws);
- no lag-1 correlation;
- the first values of seeds 1, 2, 3, … are uncorrelated and uniform, which matters because the labs seed their runs that way.

**Content:**
- the Monte Carlo and TD lab guides and checks updated;
- the MC ES explainer now uses blackjack;
- the coverage declarations count Example 5.3 as reproduced (Chapter 5: 1 of 5 examples);
- 6 new checks (70 in all) and a new flag type.

**Tests:** **24 files, 1173 tests, all passed.** (The existing `checks` test runs each of the 6 new checks as a test of its own.)
- New: `verify4b` (16): the generator, the blackjack model against simulated games, ES with discarding, a looping environment (an episode that never ends makes no update) and a 400-step episode that does end (used in full), the windy findings, and the lab.
- One changed expectation: the Monte Carlo ES interface test now selects the gridworld before checking the cut-off count (blackjack is the default), and expects "cut off at 50 steps and discarded".

`npm run check` passes.

### Milestone 4C: Chapter 2 complete (done, 2026-11-07)

**Chapter 2 meets the coverage criteria: 9 of 9 sections covered, all 11 numbered equations, and all 6 exercises incorporated** (2.1, 2.2, 2.3, 2.5 and 2.6 in the question bank; 2.4, a programming exercise, as a guided lab task). The validator reports no problems and no warnings.

**Audit.** The whole chapter was read from the text layer, and the figures and the gradient-bandit derivation from the page images (PDF pp. 54, 56–60, 62). Findings:
- **(2.11)** and the derivation that follows it (pp. 43–46) were not yet in the app. The derivation justifies one step with "$\mathbb{E}[R_t] = q(A_t)$", which is only true conditionally ($\mathbb{E}[R_t \mid A_t] = q(A_t)$). It is **flagged** on the equation, not corrected.
- **Figure 2.5** labels the initial estimate $Q_0$, where the text and Figure 2.2 write $Q_1$. Flagged on the optimistic-values concept. (The PDF's text layer also reads $Q_0$ in Figure 2.2's legend, but the printed figure shows $Q_1$; the page image decided it.)
- The gradient-bandit section promises actor–critic and policy-gradient methods "later in this book". In this draft, actor–critic is §11.1 (Chapter 11, Policy Approximation); the lesson says so.
- One wording slip that affects meaning ("neither too large nor too big", presumably "too small") is noted in the reading guide; spelling slips are left alone.

**Lessons** for every section: 2.1 (with the chapter opening on evaluative and instructive feedback), 2.2, 2.5, 2.6, 2.7, 2.8 and a reading guide for 2.9, alongside the existing 2.3 and 2.4. They use intuition, formal, mathematical, derivation, example, computation and connection layers as each section needs. Every number in a worked example was computed.

**New content:**
- **9 concepts:** evaluative feedback, the n-armed bandit problem, exploration and exploitation, the 10-armed testbed, gradient bandits as stochastic gradient ascent, the reward baseline, associative search, parameter study, and Gittins indices / Bayes-optimal exploration.
- **3 equations:** (2.11), and the two unnumbered identities its derivation rests on: the soft-max derivative and the all-actions form of (2.10). All three checked on the page images and numerically.
- **27 questions** (now 46 in Chapter 2), covering every section:
  - 5 textbook exercises, reworded and labelled as such (Exercises 2.1, 2.2, 2.3, 2.5, 2.6);
  - 22 derived from the text, its equations or its figures (including Figure 2.3's caption question about the step-11 spike, labelled as derived, since it is not a numbered exercise);
  - 8 numeric questions, each with an answer check;
  - 6 self-marked written answers with rubrics.

**Laboratory:**
- **Exercise 2.4, as a lab task:** the testbed can take a random walk (`walkSd`): every true value moves by an independent normal step after each play, the same walk for every method in a run. The draft does not give the walk's size; the "Exercise 2.4" preset uses 0.01 and says it is our choice. Measured (500 runs, 10,000 steps, second half): α = 0.1 earns 1.17 per step and picks the currently best arm 74% of the time; sample averages earn 0.94 and pick it 45% of the time. The step inspector shows the moving values.
- **Figure 2.5, the parameter study:** a new panel runs all four families at the parameter ranges read from the figure (ε 1/128–1/4, α 1/32–4, c 1/16–4, Q₁ 1/4–4). With 2000 runs every curve peaks at the same parameter as the draft's:

  | Method | Peak here (2000 runs) | Draft, read from the figure |
  |---|---|---|
  | ε-greedy | ε = 1/16, 1.336 | ε = 1/16, about 1.31 |
  | gradient bandit | α = 1/4, 1.409 | α = 1/4, about 1.38 |
  | UCB | c = 1/2 and 1, 1.488 | c = 1/2 and 1, about 1.47 |
  | optimistic greedy | Q₁ = 1, 1.463 | Q₁ = 1, about 1.44 |

  The gradient bandit at α = 4 gives 0.948, below the figure's axis, where the draft's line is cut off. Our values run about 0.02–0.03 higher throughout; the shapes agree. UCB's lead is small (0.025 at 2000 runs), and the check says so.
- **Exercise 2.5's spike:** optimistic greedy picks the optimal arm about 10% of the time on each of steps 1–10 and about 45% on step 11 (2000 runs), as in Figure 2.2.
- The line chart now draws gaps for missing values, labels categorical x positions (1/128 … 4), and puts the label of a line that stops early beside its last point.

**Checks (85 in all, 15 new):**
- the soft-max derivative against finite differences;
- the all-actions update against both cases of (2.10);
- the expected update against the gradient, for baselines 0, 1000 and the expected reward;
- Figure 2.5, Exercise 2.4, the step-11 spike, and the inspector agreeing with the fast runner on the moving testbed;
- the answer of every new numeric question.

**Tests:** **25 files, 1308 tests, all passed.**
- New: `ch02-4c` (12): the random walk, the parameter study, the chart's gaps and labels, the lab panels, the Chapter 2 lessons, coverage, exercise labels and flags.
- Updated, because they pinned Chapter 2's previous content (same precision, new values): the question counts in practice and mock-exam setup (48 → 75, 44 → 65 without written answers), the dashboard concept count (26 → 35), the questions of §2.3 and §2.6, the written and textbook-exercise lists, Chapter 2's status in the chapter list (now Covered; Chapter 3 checked as Partial instead), and the unused-equation warning (the real content has none now, so the test removes (2.1)'s only use to show the warning still works). The short-answer practice test now also picks §2.4, to keep testing the one question it marks.

**Browser review:** Chapter 2's chapter page shows all nine sections Covered; §2.7 renders with no KaTeX errors and both flags; the parameter study runs 200 runs in a few seconds, with every peak at the draft's parameter value.

`npm run check` passes. One run made while the dev server and the parameter study were also running timed out while setting up six test files (the 10-second limit for loading content); the same suite passed before and after with the dev server stopped. The new checks add a few seconds of computation (Figure 2.5 at 300 runs, Exercise 2.4 at 100 runs of 10,000 steps), which adds to that load.

### Milestone 4D: Chapter 3 complete (done, 2026-11-09)

**Chapter 3 meets the coverage criteria: 10 of 10 sections covered, all 17 numbered equations, all 12 examples, and all 21 exercises accounted for** (20 in the question bank; Exercise 3.7 does not exist in the draft, which says so). The validator reports no problems and no warnings.

**Audit.** The whole chapter was read in the text layer; every equation, Table 3.1 and Figures 3.3, 3.5, 3.6 and 3.8 were checked on the page images (PDF pp. 73–93, 100). Findings:
- **Footnote 6 (p. 62)** sends readers to Section 11.2 for continuing undiscounted tasks. In this draft §11.2 is "Eligibility Traces for Actor–Critic Methods"; the average-reward setting is §11.3. **Flagged** on (3.3).
- **Golf (Example 3.9)** says that off the green "the value is greater", but the values there (−2, −3, …) are lower. **Flagged** on the example.
- Nothing else needed flagging. The printed figures are consistent with the text: every value of Figures 3.5b and 3.8b, and every arrow of Figure 3.8c, is reproduced (below).

**The 5 × 5 gridworld (Examples 3.8 and 3.12), new in the library** (`gridworld5x5`). Layout read from Figure 3.5a: A at row 1, column 2 jumps to A′ in the bottom row (+10); B at row 1, column 4 jumps to B′ two rows below (+5); the edge costs −1. With γ = 0.9:
- **Figure 3.5b:** solving (3.12) exactly reproduces all 25 printed values to one decimal. One cell lies on a rounding boundary: 2.2501, printed 2.3, which is correct.
- **Figure 3.8b:** solving (3.17) reproduces all 25 printed values of v*.
- **Figure 3.8c:** the set of optimal actions in every cell equals the printed arrows, ties included (read at 300 dpi).
- **Exercise 3.17:** v*(A) = 10/(1 − 0.9⁵) = 24.419.
- The dynamic programming laboratory offers the grid as a new problem. Policy iteration's first evaluation is Figure 3.5b; value iteration ends at Figure 3.8, with A, B, A′ and B′ marked in the cells.

**Other checks (17 new, 102 in all).** Among them:
- Example 3.11's two Bellman optimality equations for the recycling robot hold for 25 random parameter settings.
- Our answer to Exercise 3.16, the five q* equations of the recycling robot, matches q* computed from v*.
- The relations behind Exercises 3.8, 3.12, 3.13 and 3.18–3.21 hold numerically on the gridworld and on the recycling robot.
- With an absorbing state, (3.1), (3.2) and (3.3) give the same return.
- Pole-balancing returns (Example 3.4).
- The answer of every new numeric question.

**Content:**
- **15 concepts:** the agent–environment interface, policy, the reward hypothesis, episodic and continuing tasks, the unified return notation, the Markov property, the quantities derived from the dynamics, transition graphs, q_π, backup diagrams, v* and q*, the Bellman optimality equation, greedy optimal policies, optimality and approximation, and the 5 × 5 gridworld.
- **17 equations:** (3.1)–(3.11) and (3.13)–(3.17), plus the unnumbered Bellman optimality equation for q* (p. 76).
- **12 examples**, as items. Seven are descriptive (the bioreactor, pick-and-place, the recycling robot, the pole-balancing state, draw poker, and both golf examples). Their cards now say they make no numerical claim and offer no check to run. The validator refuses a computed verification for an example without facts (D-045).
- **2 figures:** Figures 3.5b and 3.8b as value grids. The checks read the transcription from these items, so it exists in one place only.
- **10 lessons:** §3.1–3.9, and a reading guide for §3.10.
- **36 questions** (now 43 in Chapter 3):
  - 17 exercises, reworded and labelled as the draft's: 3.1–3.6, 3.8, 3.11 and 3.13–3.21;
  - 19 derived from the text, its examples, equations or figures;
  - 7 numeric questions with answer checks;
  - 15 self-marked written answers with rubrics.

**Tests:** **26 files, 1490 tests, all passed.**
- New: `ch03-4d` (8): the environment, the DP laboratory on the 5 × 5 grid, descriptive example cards and the new validation rule, the Chapter 3 lessons, coverage, figures and flags.
- Updated, because they pinned the previous content (same precision, new values): the question and concept counts (75 → 111 questions, 65 → 86 without written answers, 35 → 50 concepts); Chapter 3's question lists in the practice filters; the textbook-exercise list; the dependents of the Bellman equation; Chapter 3's status in the chapter list (now Covered; Chapter 4 checked as Partial instead).
- The mock-exam selection test asked for at most 100 questions, which now cut off the comparison (111 with written answers). It now asks for 1000, so it still compares the full 86 and 111.

**Browser review:**
- Every Chapter 3 section renders with no KaTeX errors and shows Covered.
- §3.4 and §3.7 show their flags.
- The golf card shows its flag and the descriptive note.
- The DP laboratory draws Figure 3.8 at phone width.

`npm run check` passes.

### Milestone 4E: Chapter 4 complete (done, 2026-11-09)

**Chapter 4 meets the coverage criteria:**
- all 8 sections are covered;
- the chapter opening's two equations and all 8 numbered equations are present;
- all 3 examples are covered;
- all 10 exercises are accounted for: 8 in the question bank, and the two programming exercises, 4.5 and 4.9, as laboratory tasks.

The validator reports no problems and no warnings.

**Audit.** The whole chapter was read in the text layer, and equations (4.1)–(4.8), the stochastic form on p. 96 and Figure 4.4 were checked on the page images (PDF pp. 104, 108–110, 113).

**Jack's car rental (Example 4.2), new in the library** (`lib/rl/envs/jacksCarRental.ts`).
- **A dedicated solver.** A generic MDP with 441 states, 11 actions and 441 next states would need millions of transition objects. The dynamics factor into the two locations, so values are computed from per-location tables instead.
- **Exact probabilities.** The Poisson tails are folded into "every car rented" and "lot full", not truncated.
- **Order of events.** Within a day, cars are moved overnight, then rented, then the returns arrive. The draft implies this order but does not state it, and the lab says so.
- **Figure 4.4, reproduced.** Policy iteration from "never move a car" gives π₀ … π₄, and π₄ is stable. Each policy is a strict improvement on the one before. π₄ moves between −4 and 5 cars, and its top and bottom rows match the figure cell for cell (read at 500 dpi). The improvements change 318, 272, 79 and 8 states.
- **Flagged as a replication discrepancy.** The smallest value, 421.4, matches the 420 on the figure's value axis. The largest is 637.0, while the axis shows 612. Possible reasons are an unstated modelling detail, or 612 marking an axis tick rather than the maximum. Nothing was tuned to match.
- **Exercise 4.5 (lab task).** The DP laboratory's new Jack's car rental panel steps through π₀ … π₄ and solves the variant with one free shuttle and a $4 parking charge above 10 cars.

**Exercise 4.9 (lab task):** the gambler's problem with p_h = 0.25 keeps the bold shape: v*(50) = 0.25, v*(25) = 0.0625, and staking everything at 50 is among the best choices. With p_h = 0.55, a stake of 1 is optimal in every state, and value iteration needs about 2,250 sweeps instead of about 20.

**Checks (12 new, 114 in all):**
- Figure 4.4 and its value range;
- the policy improvement theorem, (4.7)–(4.8), from 30 random policies on the 5 × 5 gridworld and the recycling robot;
- our answers to Exercises 4.3 and 4.10, iterated until they converge to q_π and q*;
- the two laboratory tasks;
- 5 numeric answers.

**Content:**
- **10 concepts:**
  - dynamic programming, full backup and the policy improvement theorem;
  - Jack's car rental and the gambler's problem;
  - truncated policy iteration, asynchronous DP and GPI;
  - DP's efficiency, and bootstrapping.
- **8 equations:** (4.1)–(4.4), (4.6)–(4.8), and the stochastic-policy form of the improvement condition.
- **Example 4.2** as an item.
- **8 lessons:** §4.1 also teaches the chapter opening; §4.8 is a reading guide.
- **22 questions** (now 34 in Chapter 4):
  - 6 exercises, reworded and labelled as the draft's: 4.3, 4.4, 4.6, 4.7, 4.8 and 4.10;
  - 16 derived from the text;
  - 5 numeric questions with answer checks;
  - 6 written answers marked against rubrics.

**Tests:** **27 files, 1586 tests, all passed.** New: `ch04-4e` (6), covering the Jack model, the laboratory panel, the Chapter 4 lessons, coverage and the flag. Updated tests:
- **The mock-exam tests used to start their paper from the filter "Chapter 4, Beginner",** which until now gave exactly ch04-q003 and ch04-q007. It now gives 7 questions. The tests now put that same two-question paper in place with the exam engine's own `startExam` and resume it, as the page does after a reload, so they no longer depend on the size of the bank. The setup test now starts a real paper from the form (Chapter 4, Beginner: 7 questions).
- **A search test** expected "belman equation" to rank (3.12) in the top five. Chapters 3 and 4 added several genuine Bellman equations that now rank alongside it. The test now requires the Bellman-equation concept in the top two, and (3.12) to be found.
- **The coverage test's example of a partial section was §4.2;** it is now §5.3. Chapter 4's opening equations are covered, so the test removes (4.1) from a fresh copy of the content to show that a missing opening equation is still reported.
- **Pinned counts and lists, updated to the new values:** questions 111 → 133 (86 → 102 without written answers), concepts 50 → 60, and the Chapter 4 question lists.
- **One selector renamed.** The Jack panel's selector is labelled "Variant", so the DP laboratory's "Problem" selector stays unique.
- **Setup hooks now get 30 s, the same limit as tests** (`hookTimeout` in `vitest.config.ts`). Twice, in 4C and in this milestone, two or three files failed while loading every route, the content and the search index with 27 files running in parallel; the same files pass in seconds on their own. No assertion depends on this, and the reason is written next to the setting.

**Browser review:**
- all Chapter 4 sections render with no KaTeX errors and show Covered;
- the Jack panel draws π₄ like Figure 4.4 and fits a phone screen without horizontal scrolling.

`npm run check` passes.

#### Next: Milestone 4F
Chapter 5 to the coverage criteria.
