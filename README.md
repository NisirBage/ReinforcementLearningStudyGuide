# RL Study Lab

A private, offline study environment for reinforcement learning. It is built on the **April 2015 draft of Sutton & Barto, *Reinforcement Learning: An Introduction* (2nd ed.)**, which is the authoritative core. Zhao's *Mathematical Foundations of RL*, his lecture slides L1–L10, and selected papers appear as clearly labelled supplementary material.

**Status:** Milestone 3 is complete (3A–3F). Every implemented algorithm has an explainer page: problem, prerequisites, equations, derivation, pseudocode, the exact source code that runs it, a checked worked example, a live step-by-step demonstration, strengths and limitations, comparisons and practice questions. The Interactive Lab has six laboratories, each checked against the draft's own examples. Practice, mock exams and a 50-question verified bank are available, and the Progress page shows question statistics, topic mastery, mistakes, bookmarks, the revision backlog, exam history and lab use. 1129 tests pass. Textbook coverage beyond Chapters 2–6 is next. See [docs/PROGRESS.md](docs/PROGRESS.md) and [docs/DECISION_LOG.md](docs/DECISION_LOG.md).

## Layout
- `content/`: all learning material as structured JSON. Every item records its source location (chapter, section, printed page and PDF page).
- `app/`: the React interface, the RL implementations in `app/src/lib/rl/`, the content build plugin in `app/plugins/` (catalogue + one chunk per unit), and the tests.
- `tools/`: the source registry builder, the content validator, the overlap check and the build privacy check.
- `sources/` and `content/_extracted/`: local copies of the PDFs and their text layer. These are git-ignored and never published.

## Commands
Run these from `app/` (needs Node 24+):

```bash
npm install
```

```bash
npm run dev
```

Opens the app at http://localhost:5174.

```bash
npm run check
```

Runs content validation, typecheck, tests, the overlap check, the production build and the build privacy check.

```bash
npm run preview
```

Serves the production build at http://localhost:4174. Run `npm run build` (or `npm run check`) first so the build exists. It works offline after the first visit.

To rebuild the source registry after re-extracting the PDFs, run this from the repository root:

```bash
python -I tools/build_sources.py
```
