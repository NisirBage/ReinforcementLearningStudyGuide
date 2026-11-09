# RL Study Lab

A private, offline study environment for reinforcement learning. It is built on the **April 2015 draft of Sutton & Barto, *Reinforcement Learning: An Introduction* (2nd ed.)**, which is the authoritative core. Zhao's *Mathematical Foundations of RL*, his lecture slides L1–L10, and selected papers appear as clearly labelled supplementary material.

**Status:** Milestone 3 is complete, and Milestone 4 (full coverage of the April 2015 draft) is under way. 4A built the coverage tooling: a source inventory of every numbered equation, example and figure, a per-chapter coverage report ([docs/coverage/](docs/coverage/README.md)) checked on every build, stricter validation, a build-time search index, and reading progress. 4B resolved the outstanding verification issues (blackjack and Monte Carlo ES, the windy gridworld). 4C completed Chapter 2, reproducing Figure 2.5's parameter study. 4D completed Chapter 3, reproducing Figures 3.5 and 3.8 exactly. 4E completed Chapter 4, with Jack's car rental (Figure 4.4's policies reproduced) and its Exercise 4.5 variant in the DP laboratory. Coverage so far: 27 of 86 written sections, 42 of 80 equations, 19 of 36 examples and 38 of 85 exercises. 1586 tests pass. See [docs/COVERAGE_AUDIT.md](docs/COVERAGE_AUDIT.md), [docs/PROGRESS.md](docs/PROGRESS.md) and [docs/DECISION_LOG.md](docs/DECISION_LOG.md).

## Layout
- `content/`: all learning material as structured JSON. Every item records its source location (chapter, section, printed page and PDF page).
- `app/`: the React interface, the RL implementations in `app/src/lib/rl/`, the content build plugin in `app/plugins/` (catalogue + one chunk per unit), and the tests.
- `tools/`: the source registry and inventory builders, the content validator, the coverage report, the overlap check and the build privacy check.
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
