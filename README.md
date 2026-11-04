# RL Study Lab

A private, offline study environment for reinforcement learning. It is built on the **April 2015 draft of Sutton & Barto, *Reinforcement Learning: An Introduction* (2nd ed.)**, which is the authoritative core. Zhao's *Mathematical Foundations of RL*, his lecture slides L1–L10, and selected papers appear as clearly labelled supplementary material.

**Status:** Milestone 2 (architecture), in progress. The content schema, validator, RL core functions, progress domain, persistence and search engine are implemented and tested. The user interface is not built yet. See [docs/PROGRESS.md](docs/PROGRESS.md) and [docs/DECISION_LOG.md](docs/DECISION_LOG.md).

## Layout
- `content/`: all learning material as structured JSON. Every item records its source location (chapter, section, printed page, PDF page).
- `app/`: the TypeScript code (React UI to come), the RL implementations in `app/src/lib/rl/`, and the tests.
- `tools/`: source registry builder, content validator, overlap check.
- `sources/` and `content/_extracted/`: local copies of the PDFs and their text layer. Git-ignored, never published.

## Commands
Run these from `app/` (needs Node 24+):

```bash
npm install
```

```bash
npm run check
```

`npm run check` runs content validation, typecheck, tests and the overlap check. To rebuild the source registry after re-extracting the PDFs, run this from the repository root:

```bash
python -I tools/build_sources.py
```
