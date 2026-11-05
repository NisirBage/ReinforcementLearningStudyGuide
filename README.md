# RL Study Lab

A private, offline study environment for reinforcement learning. It is built on the **April 2015 draft of Sutton & Barto, *Reinforcement Learning: An Introduction* (2nd ed.)**, which is the authoritative core. Zhao's *Mathematical Foundations of RL*, his lecture slides L1–L10, and selected papers appear as clearly labelled supplementary material.

**Status:** Milestone 3A is done. Pages and chapters load on demand. Chapters are saved for offline use when first opened, or all at once from Settings. The question and progress formats are ready for practice and mock exams. 659 tests pass. Practice, mock exams and the interactive labs are next (Milestones 3B–3F), and textbook coverage has not started yet. See [docs/PROGRESS.md](docs/PROGRESS.md) and [docs/DECISION_LOG.md](docs/DECISION_LOG.md).

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
