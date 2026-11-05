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
The question-bank engine (selection, seeded randomisation, tolerance grading, rubric self-marking) and the Practice section (filters, feedback modes, step-by-step solutions, bookmarks, revision flags, re-attempting incorrect questions), with a reviewed, verified set of new questions for the chapters that have material.
