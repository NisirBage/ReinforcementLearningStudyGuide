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
1. Your visual review of the interface.
2. Code-splitting per chapter.
3. Textbook coverage, chapter by chapter, under the same verification rules.
