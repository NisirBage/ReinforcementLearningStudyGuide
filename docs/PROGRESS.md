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
| React shell: routes, layout, theme, KaTeX rendering, pages | **not started** | the earlier Zhao-based loader was removed after D-021 |
| Service worker, CSP, dist privacy check | **not started** | |

### Test results (2026-11-04)
- `npx vitest run`: **6 files, 102 tests, all passed**.
- `npx tsc --noEmit`: clean.
- `npm run validate`: content valid, all 21 checks pass.
- `npm run overlap`: 0 matches.

### Found and fixed during this milestone
- My first worked example for (3.12) used v_π(5) = −20; it is −18. Fixed, and the arithmetic is now a check (`ch03.bellman-example-state-1`).
- My first hypothesis for Figure 4.2's rounding (truncation) was wrong; the check showed it. See D-027.
- The validator was wrongly strict on front-matter page labels (p. xiv); fixed in the rule, not the data.

### Next
Finish Milestone 2:
1. A React shell that renders this content (Learn, Search, Revision for equations, algorithms and notation, Progress/backup, settings with the 2018 toggle).
2. KaTeX rendering tests.
3. Service worker and CSP.
4. A browser check at desktop and phone widths.

Then Milestone 3/4 content, chapter by chapter, following the same verification rules.
