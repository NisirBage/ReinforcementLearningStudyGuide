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

## D-028: IndexedDB is the browser store; the envelope logic is shared (Accepted, 2026-11-04)
- Progress is kept in IndexedDB (`app/src/store/idb.ts`), as in the NLP Study Lab.
- The versioned envelope, the migration and the corrupt-data backup are the same code as the localStorage path: `decodeSaved` and `encodeSaved` were extracted from `persistence.ts`. The saved format is unchanged.
- A profile saved earlier in localStorage is moved in once.
- The store sits behind a small key-value interface, so its logic is unit-tested with an in-memory store. The real IndexedDB path was verified in the browser: a status was set, the page reloaded, and the status was read back.

## D-029: Figures are redrawn from structured data (Accepted, 2026-11-04)
- New content type `Figure` (`content/figures/`), in two kinds:
  - `value-grids`: printed grids such as Figure 4.2;
  - `backup-diagram`: diagrams such as Figure 3.4(a).
- No image is copied from either PDF. Figures cite printed and PDF pages, and need a page-image or computed verification like every other textbook item.
- The Figure 4.2 transcription now lives only in `content/figures/ch04.json`; `checks.ts` reads it from there, so the UI and the checks share one copy.
- "Show exact values" computes the iterates with the tested `dp.iterativePolicyEvaluation`.

## D-030: Interface rules (Accepted, 2026-11-04)
- React components only render content and call pure functions:
  - grading: `domain/grade.ts`;
  - lookups: `content/indexes.ts`;
  - progress: `domain/progress.ts`;
  - search: `domain/search.ts`.
- Search results link to real routes, not `#anchors`, because routing uses the URL hash.
- Any `console.error` during a UI test fails it (`tests/setup.ts`).
- Supplementary material is linked from core pages ("Go further"), never rendered inside them.

## D-031: Code and content are split; pages load what they show (Accepted, 2026-11-05)
- **Problem:** Milestone 2b shipped one 746 kB script: KaTeX, markdown-it and every chapter loaded on every page, including the dashboard.
- **Pages:** every route except the dashboard and not-found is its own chunk (`App.tsx`, `lazyPage` in `components/Boundary.tsx`).
- **Maths renderer:** KaTeX, markdown-it, their CSS and fonts form one `render` chunk. Only pages that show maths fetch it (`components/math.tsx`, split from `ui.tsx`).
- **Content:** `app/plugins/vite_content.ts` derives from `content/`, with the pure functions in `content/catalog.ts`:
  - a **catalogue** loaded with the shell (38 KiB of JSON today): the page tables, the curriculum, and stubs for every concept, item and question;
  - **one chunk per unit**, plus one for the notation.
- **Loading rules:**
  - pages call `useContent(units)` for exactly the units they show;
  - supplementary units are never fetched by core pages;
  - libraries fetch supplementary units only when the learner selects them;
  - the search index is built on the first query.
- **No second copy:** `content/` stays the only source (D-001). A test checks that the catalogue and every unit chunk equal what the content files give. Another checks that app code never imports the old all-content `bundle.ts`, which is now used by tests only.
- **Failures:**
  - each route has an error boundary and a loading state;
  - a failed download stays cached until **Try again**, which fetches it again (React.lazy would keep the failure for good);
  - the navigation and search box keep working around a failed page.
- **Instant cached renders:** a page whose content is already in memory renders at once, without a loading frame.
- **Tests:** interaction tests preload pages and content first. A click that must fetch a page suspends inside the testing library's synchronous `act()`, which React reports as an error. Route tests do not preload, so they exercise on-demand loading. `tests/loading.test.tsx` covers loading states, failures and retry. Async queries wait up to 5 s (default 1 s), because the first maths page in a busy parallel run can take longer.

## D-032: Offline: the shell is stored at install, chapters on first use or on request (Accepted, 2026-11-05)
- **At install**, the service worker stores 36 files (996 KiB): the shell, every page's code, the maths renderer and its woff2 fonts.
- **On first fetch**, it stores chapter chunks, the notation and the other font formats.
- **On request**, Settings → **Save everything for offline** stores all 81 files and reports the count from the worker's own cache.
- **Updates:** a new build carries over every stored file whose content-hashed name is unchanged, so an update does not lose saved chapters.
- **Trade-off (the learner's choice):** a chapter that has never been opened or saved is not available offline. Its page says so and offers a retry.

## D-033: Question provenance and the exercise registry (Accepted, 2026-11-05)
- **`provenance` is required on every question**, with one of four kinds:
  - `textbook-exercise`: the draft's exercise, reworded;
  - `textbook-derived`: names its basis (an exercise, §section or content item id);
  - `generated`: a new application question;
  - `supplementary`: required in supplementary units and forbidden in core ones.
- **Exercise registry:** `tools/build_sources.py` now writes `sources.sb.exercises`, the 85 exercise headings of the draft with printed and PDF pages and the ∗ and (programming) markers. No exercise text is stored.
- **Checks against the registry:**
  - a cited exercise must exist and not be a placeholder;
  - it must belong to the question's chapter;
  - its page must be cited.
- **Placeholders flagged, not fixed:** the draft prints two placeholders, "There is no exercise 3.7" and "There is no Exercise 8.1". They are recorded as `placeholder: true` (D-023), so no question can claim them.
- **Other new fields:**
  - `section` (required, may be null), checked against the unit's chapter;
  - `related`, checked to exist on the same side of the core/supplementary line;
  - `rubric` for `derivation` and the new `short-answer` type, whose marks must sum to the question's marks; these are self-marked, never auto-graded;
  - `optionNotes` for reviewed mcq/multi questions, saying why each option is right or wrong;
  - a new category, `code-interpretation`.
- **`adaptedFrom` retired:** the field is now rejected. ch04-q001 is `textbook-exercise` 4.1, because it asks what Exercise 4.1 asks. It is reworded, and adds the value of v_π(11) from Figure 4.2.

## D-034: Progress format version 2 (Accepted, 2026-11-05)
- **Additive:**
  - `bookmarks`, separate from the revision flag `marked`;
  - `exams`, submitted mock-exam records, from which results are recomputed and never stored as summaries;
  - optional `mode` (lesson, practice, exam, review), `ms` and `selfMarked` on attempts.
- **Older saves:** version 1 saves and exports load unchanged, with empty new fields.
- **Malformed records:** a malformed exam record is dropped whole, never kept in part.
- **Merging** unites bookmarks and exams by id.
- **Tests updated:** two existing tests named the schema number. The export now says `schema: 2`, and the "newer version" refusal test now uses 3.

## D-035: The practice engine is pure; the screen only wires it (Accepted, 2026-11-05)
- **`domain/answer.ts`:** what the learner has entered (a `Draft`), whether a question counts as answered, and how a draft becomes a gradeable response. Lesson cards, Practice and (3C) mock exams all use it.
- **`domain/grade.ts`:** gains rubric self-marking. The score is the sum of the points the learner ticks. The app never grades free text.
- **`domain/practice.ts`: selection.**
  - Filters: chapter, section, topic (concept), difficulty, type and provenance.
  - Pools from the learner's real history: all, not attempted, wrong last time, repeated mistakes (wrong at least twice), bookmarked, flagged.
  - Three orders: seeded random, mixed topics (a seeded round-robin over chapter and section) and book order.
  - The same seed and choices always give the same session, and the seed is shown.
  - With no chapter chosen, only core questions are drawn. Supplementary modules are included only when ticked.
- **`domain/session.ts`: a practice session as data plus pure transitions.**
  - Transitions: start, go to a question, edit, check, reveal a solution step, self-mark, finish.
  - Time is credited to the question on screen.
  - Immediate feedback records an attempt when you check. Deferred feedback records at the end.
  - Unanswered questions are never recorded, so they do not count as wrong.
  - Self-marked questions are recorded only once the learner marks them.
- **`domain/progress.ts`:** per-question history (`questionStats`, `incorrectQids` based on the latest attempt, `repeatedMistakes`, `timeSpentMs`), all derived from the attempt log, so nothing is stored twice.
- **Saved slot:** an open session is kept in IndexedDB under `rlsl:slot:practice`, outside the progress record (so it is not exported), and is resumed after a refresh. A stored session is checked before use, and anything malformed is dropped.
- **Shared parts:** `components/question.tsx` holds the answer inputs, rubric marker, verdict and step-by-step solution, and the lesson `QuestionCard` now uses them. Lesson items are called "Question n", lesson cards gain a Bookmark button, and the flag button keeps its "Mark for revision" wording.

## D-036: Questions are placed by their declared section (Accepted, 2026-11-05)
- **Placement:** section pages and chapter pages place questions by `question.section` (D-033), not by which pages their sources cite.
- **Why:** a reworded exercise must cite its exercise page, which is usually at the end of the chapter, and may also cite the section it tests. Exercise 4.1 (ch04-q001) now appears on §4.1 instead of under "End-of-chapter exercises".
- **Tests updated:** two exact-list tests in `tests/domain-ui.test.ts` were updated to the new content and this rule, and they still compare exact lists. Concepts and items are still placed by their source citations.

## D-037: Mock exams: a wall-clock deadline, results computed only from the stored record (Accepted, 2026-11-05)
- **Pure engine:** `domain/exam.ts` is pure: start, go to a question, answer, mark for review, submit, time out, mark written answers afterwards, results.
- **Timing:**
  - an exam stores its `deadline` (epoch ms), so the time left is `deadline − now` whether the learner is on the page, elsewhere in the app, or reloading;
  - an exam found past its deadline is submitted as `timeout` **at the deadline**, so a late reload never adds time;
  - time per question is credited only while it is on screen, and never past the deadline.
- **Persistence:**
  - the exam in progress is saved after every change to the slot `rlsl:slot:exam`, outside the progress record;
  - closing or reloading the tab asks first (`beforeunload`), and a reload resumes the exam either way;
  - other pages show a banner with the time left and a link back.
- **What counts:**
  - unanswered questions score 0 in the record but are not logged as attempts;
  - written answers (derivations and short answers) are optional in an exam. They are self-marked after submission and count once marked;
  - "mark for review" is local to the exam, separate from the revision flag.
- **Results:** total score, accuracy on answered questions, time, and breakdowns by chapter, topic and difficulty. They are recomputed from the stored `ExamRecord` every time, and nothing derived is stored. Each record also keeps the answers given (`draft`), so the review shows them. This is an optional, additive field of format version 2 (D-034), as is `awaitingMark`.
- **Navigation:** phones keep five destinations on the bottom bar (Home, Learn, Practice, Mock exams, Revise), with Search, Progress and Settings under **More**. The desktop sidebar shows all of them. The Lab (3D) joins More.
- **Test harness:** in `tests/exam-ui.test.tsx`, clicks that navigate run inside an awaited `act()`. With the instrumented loader, no content or code was pending during those clicks. The router renders the new page in a transition, which React reports as an un-awaited suspension under the testing library's synchronous `act()`. The same flows were checked by hand in the browser.

## D-038: Laboratories are content plus tested code (Accepted, 2026-11-05)
- **Content type:** a lab is a `Lab` item in `content/labs/<unit>.json`, holding its summary, guide, sections, concepts, sources, flags and verification. The validator requires:
  - every `implementations` key to exist in `lib/rl/registry.ts`;
  - a `computed` verification whose check reproduces one of the draft's own examples.
- **Draft fixtures are checks** in `checks.ts`, using seeded simulations of 300 runs with tolerances that leave room for noise:
  - Figures 2.1–2.4;
  - the best possible average reward on the testbed, ≈ 1.539, computed exactly;
  - the gridworld's exact v_π, the recycling robot's consistency, and detection of a missing solution;
  - Exercise 3.9.
- **Behaviour versus mathematics:** behavioural claims, such as "greedy finds the optimal action in about a third of tasks", are tested statistically. Update rules are tested exactly by hand computation. The step inspector and the fast runner are tested to agree step for step on the same seed.
- **Following the draft as written:**
  - the gradient bandit's baseline R̄_t includes R_t, as the draft defines it (p. 43);
  - (2.9) is printed with an unmatched parenthesis. It is flagged `suspected-typo` and computed as a normal soft-max.
- **Example 3.7:** the draft leaves α, β, r_search and r_wait symbolic. The app's sample numbers are labelled as the app's.
- **Charts** use the dataviz reference palette (slots 1–4), validated against both theme surfaces. Light-mode slots 3–4 are below 3:1 contrast, so every chart has direct labels and a table view.
- **Transitions** are drawn as a layered diagram (state → action → next state), with labels placed so they never overlap.
- **Search:** direct matches always rank above cross-references.

## D-039: Dynamic programming, Monte Carlo and TD laboratories (Accepted, 2026-11-05)
- **One environment definition.** The environments are FiniteMDPs in `lib/rl/envs/examples.ts`: the gambler's problem (Example 4.3), the random walk (6.2), the windy gridworld (6.5) and cliff walking (6.6). DP reads their dynamics; Monte Carlo and TD only sample them (`lib/rl/sampling.ts`). The grid layouts were read from the page images of Figures 6.10 and 6.13.
- **Policy iteration (Figure 4.3):** the draft's caption admits it may never stop when equally good policies alternate. It is flagged `source-acknowledged-issue`, and the app keeps the current action while it is still among the maximizers. π₀ is the equiprobable random policy, as in the draft's Figure 4.2 example.
- **Exercise 4.4:** an evaluation that does not converge (γ = 1 and a policy that loops) is reported as diverged, not run for ever.
- **Gambler's problem:**
  - stake 0 is in the draft's action set and ties for the maximum under γ = 1, so the lab shows the smallest positive maximizing stake;
  - policy iteration is not offered for it: the draft uses value iteration there, and a policy that stakes 0 never ends an episode, so its evaluation cannot be trusted.
- **Monte Carlo ES (Figure 5.4):** the draft assumes every episode ends. On the gridworld a deterministic policy can loop, so episodes are cut at 50 steps and their partial returns are still averaged. This is a stated departure, and the lab says so.
- **Sarsa and Q-learning** are separate functions with separate targets. Every update exposes S_t, A_t, R_{t+1}, S_{t+1}, A_{t+1} (Sarsa), Q(S_t, A_t), the bootstrap term, the TD target, the TD error and the new value. Sarsa carries the A_{t+1} it chose, with its exploration flag, into the next step.
- **Replication results, reported as measured:**
  - the windy gridworld matches the draft's minimum of 15 steps and its roughly 170 episodes in 8000 steps (155–164 here);
  - after 8000 steps, Sarsa's episodes average about 20 steps here against the draft's "about 17"; the cause is unknown, and the lab says so rather than tuning;
  - cliff walking matches Figure 6.13 (Sarsa −28 vs Q-learning −51 per episode, Q-learning's path 13 steps). The draft gives no α for it, so the app's α = 0.5 is labelled as the app's choice.

## D-040: Algorithm explainers are content; their demonstrations are the lab panels (Accepted, 2026-11-05)
- **Text in content, code in the app.** Each algorithm's explainer (problem, equations, derivation, example, strengths, limitations, comparisons) is the `explainer` field of its entry in `content/algorithms/*.json`, validated like everything else. The page adds the parts that come from elsewhere: prerequisites from the concept graph, the pseudocode box, the source code and the questions.
- **The source shown is the source that runs.** `lib/source.ts` loads the `lib/rl` file named by the algorithm's implementation key as raw text and cuts out the exported function with its comment. A test does this for every algorithm, so the page cannot show code that is not there.
- **Demonstrations reuse the lab panels**, exported with presets (for example `ControlInspector initialMethod="sarsa"`), so there is one implementation of each stepper and the explainer shows the same intermediate values as the lab.
- **Bandit methods have no pseudocode box in the draft.** Their boxes are written for the app from §2.2–2.7, carry no book label, and say so on the page.
- **Questions for every algorithm.** Eight algorithms had no questions on their concept, so 16 `textbook-derived` questions were added rather than showing an empty practice section. Numeric answers come from the app's code; statements cite pages checked against the text layer.
- **Progress views are computed, not stored.** Topic mastery shows the learner's own status beside the evidence and does not invent a combined score. The backlog, mistakes, exam summary and lab use are all derived from data already stored, so the saved format and export/import stay as they were; lab visits use the existing `lab` activity kind.

## D-041: A page open across an app update asks for a reload (Accepted, 2026-11-05)
The service worker activates a new version at once and deletes the old version's files (D-032). A page that was open from before can then ask for a code file that no longer exists anywhere, and retrying cannot help. The page watches for a new worker taking control (`store/update.ts`). If a code file then fails to load while online, the error panel says the app was updated and offers "Reload the app" instead of "Try again". The first worker to control a fresh page is not counted as an update. Waiting for the learner to accept updates was rejected: it would keep old versions alive offline and complicate the cache.

## D-042: Coverage is computed from a source inventory, never declared (Accepted, 2026-11-07)
- **The inventory** (`content/source/inventory.json`) is generated from the draft's text layer by `tools/build_inventory.py`. It holds only labels and counts: equation, example and figure numbers per section, and word counts. Nothing of the book's wording is stored.
- **Status is derived.** A section is covered only when it has a lesson, every numbered equation and named example the draft has there, and a question. `content/coverage/coverage.json` can say *how* a section is treated (reading guide), *how* an example is reproduced (a lab check), what an exercise is (a placeholder, a lab task), or that a section is thin in the draft. It cannot say a section is covered. The report is generated, and `npm run check` fails when it is stale, so the documentation cannot overstate coverage.
- **Labels are checked against the draft.** An equation item labelled (N.M), or an example item labelled Example N.M, must match a number the draft has, in the section the item cites. A chapter introduction counts as part of its chapter.
- **Content links** inside Markdown use in-app routes (`#/concept/…`, `#/equation/…`, `#/learn/<unit>/<section>`, `#/lab/…`). The validator resolves each one. External links are refused, because the app is offline and cites sources instead.
- **Search documents are built at build time**, so search never loads chapter bodies; the index stays small as content grows.
- **Reading marks are explicit.** A section is "read" only when the learner says so. Opening a page is not reading it, and the app does not pretend otherwise.
