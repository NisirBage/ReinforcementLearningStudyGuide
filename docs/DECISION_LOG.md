# Decision log

Numbering continues the conventions of the NLP Study Lab. D-001 and D-002 are adopted unchanged; this project's own decisions start at D-021.

## D-001: Keep content separate from the app (Adopted)
`content/` is the source of truth for everything the learner reads: lessons, concepts, equations, algorithms, examples, questions, notation and source references. `app/` only reads it. Nothing in `content/` is hard-coded into React components (learner requirement 6).

## D-002: Never store or publish the PDFs or raw extracted text (Adopted)
`*.pdf`, `sources/` and `content/_extracted/` are git-ignored. Only metadata (titles, page numbers, page maps) and original writing are committed. `tools/check_overlap.py` checks that authored text has no 9-word run in common with either book. Current result: 0 matches at 9 and at 12 words.

## D-021: The April 2015 draft is the authoritative core; everything else is supplementary (Accepted, 2026-11-04)
- **Decision:** the core syllabus is *Reinforcement Learning: An Introduction*, 2nd ed., **draft of April 2015**, chapter for chapter (`content/curriculum/curriculum.json` → `core`, ch01–ch15). Chapters 10, 12 and 13 are listed with status `empty-in-draft`. Zhao's book, Zhao's lectures L1–L10 and papers (regret, Double Q-learning, PPO) are **supplementary units** (`sup-*`). Each supplementary unit attaches to a draft chapter or section.
- **Enforced by the validator** (`validateBundle`):
  - core items may cite only the textbook;
  - supplementary items may not cite the textbook as their source;
  - a core concept may not list a supplementary prerequisite;
  - questions, equations, algorithms, examples and lessons may not mix core and supplementary concepts.
- **Supersedes** the hierarchy proposed in TEXTBOOK_AUDIT §12 and approved on 2026-11-04 (Zhao as the course spine). The learner's later requirements reversed it. Consequence for the learner: course chapters that only Zhao covers (stochastic approximation as a chapter, the policy-gradient theorem, A2C, DQN) appear as labelled supplementary units, not as core.

## D-022: Source traceability on every item (Accepted)
- Every textbook reference records chapter, optional section, **printed pages and PDF pages**. The validator checks PDF = printed + 14 for the draft. It also checks that the printed pages lie inside the cited section's page span, taken from the table of contents.
- Front matter uses roman page labels (PDF page = numeral value).
- Zhao is published as one PDF per chapter. `tools/build_sources.py` derives each file's offset from the page numbers printed on every page and stops if any page disagrees. Zhao references carry printed pages and that chapter file's PDF pages. Lecture references carry slide numbers.

## D-023: Flag questionable source material; never silently correct it (Accepted)
Transcriptions keep what is printed. Problems are recorded as `flags`:
- `suspected-typo`
- `source-acknowledged-issue`
- `figure-rounding`
- `extraction-uncertain`
- `empty-in-draft`
- `notation-unverified`

A flag can carry a `suggestion`, which is shown separately from the source text. First real use: D-027.

## D-024: Verification (Accepted)
- Textbook equations must be transcribed from the **page image**. The text layer garbles display maths; the validator enforces this.
- Every numeric answer key must name a **computed check** in `app/src/content/checks.ts`. The validator recomputes it and compares within the stated tolerance.
- Example claims ("facts") each name a check, and every check must pass.
- Algorithm boxes name an implementation key in `app/src/lib/rl/registry.ts`, so pseudocode can only point at code that exists and is tested.

## D-025: Stack: React shell, NLP Lab content discipline (Accepted)
- React 19.1.10, React Router 7.18.4 (hash routing), Vite 8.3.4, TypeScript 6.0.3, Vitest 4.1.12, KaTeX 0.18.11, markdown-it 15.0.3.
- Version policy (from the NLP Lab): exact versions, each released at least 2 weeks before adoption. The Cloud Lab's older pins (Vite 6.0.5, Vitest 2.1.8, React Router 6.30.6) had moderate advisories. The newer pins report `npm audit`: 0 vulnerabilities.
- Persistence: versioned localStorage envelope (Cloud Lab pattern). Unreadable or newer-schema data is copied to a backup key, never discarded. JSON export, import and merge follow the NLP Lab convention.
- Search: a hand-written inverted index with no service and no dependency.

## D-026: Notation (Accepted)
- The original 2015 notation is always shown.
- Optional cross-references to the published 2018 edition (`notation2018` on equations, `tex2018` in `content/notation/notation.json`) are hidden by default (setting `show2018Notation`).
- **No copy of the 2018 edition was available**, so every 2018 cross-reference must carry a `notation-unverified` flag; the validator enforces this. Examples: n-armed → k-armed, μ (behaviour policy) → b (where μ then means the on-policy distribution), E_t / e_t → z_t, G^(n)_t → G_{t:t+n}.

## D-027: Figure 4.2 prints values with an unusual rounding rule (Recorded, 2026-11-04)
- Every cell of Figure 4.2 (printed p. 93, PDF p. 107) was transcribed and compared with the two-array iterates of (4.5).
- All cells match "nearest to one decimal, exact halves toward zero":
  - −2.875 prints as −2.9 and −8.352 as −8.4, so the rule is not truncation;
  - the exact −1.75 at k = 2 prints as −1.7, so it is not ordinary rounding either.
- The values are correct. Recorded as a `figure-rounding` flag on Example 4.1 and backed by the checks `ch04.fig4-2-two-array-iterates` and `ch04.fig4-2-rounding-quirk`.
