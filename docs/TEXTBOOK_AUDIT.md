# RL Study Lab — Milestone 1: Textbook Audit & Plan

**Source:** `SuttonBartoIPRLBook2ndEd.pdf` — *Reinforcement Learning: An Introduction*, Sutton & Barto, **"Second edition, in progress", © 2014–2015** (PDF built 12 April 2015, 352 pages).

**Page convention used throughout:** "p. N" means the **printed** page number. PDF page = printed page + 14. Every search result and lesson in the app will cite the printed page (and can deep-link to the PDF page).

> **Superseded in part (2026-11-04, DECISION_LOG D-021):** the source hierarchy proposed in §12 (Zhao as the course spine) was reversed. **The April 2015 Sutton & Barto draft is the authoritative core curriculum.** Zhao's book, Zhao's lectures and papers are supplementary, attached to draft sections, and never merged into the core syllabus. The analysis of the draft in §0–§7 stands; §10–§12 now describe supplementary material.

> **Update (2026-11-04):** your course follows Shiyu Zhao's *Mathematical Foundations of Reinforcement Learning*. **§12 sets that book as the primary source**, with Sutton & Barto as the companion text, and supersedes the earlier sections where they conflict.

---

## 0. Critical finding: this is the 2015 draft, not the published 2018 edition

The audit shows this file is an **incomplete working draft**. That changes the syllabus significantly compared with the indicative map in the brief:

| Item | Status in this PDF |
|---|---|
| Chapters 1–9, 14, 15.1, 15.5 | Complete prose, equations, examples, exercises |
| Ch 11 *Policy Approximation* | Short (pp. 257–263): actor–critic, traces for actor–critic, R-learning only |
| §8.8 *Monte Carlo Tree Search* | Heading only, no content |
| Ch 10 *Off-policy Approximation of Action Values* | **Empty** (title page only) |
| Ch 12 *Psychology*, Ch 13 *Neuroscience* | **Empty** |
| §15.2–15.4 (State Estimation, Temporal Abstraction, Predictive Representations) | Headings only |
| Expected Sarsa, Double Q-learning | **Not present** (Exercise 6.10 asks the reader to derive the expected-value variant of Q-learning, without naming it) |
| n-step Sarsa, tree backup, Q(σ) | Not present (n-step is prediction only, §7.1) |
| Policy-gradient theorem, REINFORCE, baselines for PG | Not present (only the gradient-bandit derivation, §2.7) |
| DQN, experience replay, target networks, PPO, deep RL | **Not present** |
| "Regret" | Not defined in the text (only in references) |
| Notation | Draft notation, which differs from the 2018 edition: **n-armed** (not k-armed), behaviour policy **µ** (not b), traces **E_t(s)** / **e_t**, preferences **H_t(a)**, π_t(a), \(\bar R_t\), ρ_t^T |

**Consequence:** clusters G (partly) and H (Deep RL) of the indicative map **are not supported by this textbook**. Following the rule "do not invent chapters or textbook references", I propose:

- **Core curriculum** = what this PDF actually covers (Ch 1–9, 11, 14, 15), in its notation.
- **Optional "Supplementary" track**, visually distinct (different badge/colour, no textbook page refs, labelled "Not in source text"), for Expected Sarsa, Double Q-learning, regret, REINFORCE/policy-gradient theorem, DQN. **Only if you approve** — see Decision 1 at the end.

Minor textual issues in the draft I noticed and will check visually against the PDF page images during content entry (the app will reproduce the book's equation and attach a visible "erratum note" where needed, never silently correct):
- Eq. (2.9) has a stray parenthesis in the exponent.
- Eq. (7.1) text extraction shows "γ²" with no reward term after it (likely a missing \(R_{t+3}\)); needs visual confirmation.
- Fig. 4.3 (policy iteration): the book itself notes the algorithm "has a subtle bug" (it may not terminate if policies tie), which is the subject of Exercise 4.4.
- Preface describes parts as I–IV, but the actual TOC has Part I *Tabular Solution Methods*, Part II *Approximate Solution Methods*, Part III *Frontiers*. The app will follow the TOC.

---

## 1. Complete table of contents (as in this PDF)

Front matter: Preface (p. viii) · Series Foreword (p. xii) · **Summary of Notation (p. xiii)**

**1 The Reinforcement Learning Problem** (p. 1)
1.1 Reinforcement Learning (2) · 1.2 Examples (5) · 1.3 Elements of Reinforcement Learning (7) · 1.4 Limitations and Scope (9) · 1.5 An Extended Example: Tic-Tac-Toe (10) · 1.6 Summary (15) · 1.7 History of Reinforcement Learning (16) · 1.8 Bibliographical Remarks (25)

**Part I — Tabular Solution Methods** (p. 27)

**2 Multi-arm Bandits** (31)
2.1 An n-Armed Bandit Problem (32) · 2.2 Action-Value Methods (33) · 2.3 Incremental Implementation (36) · 2.4 Tracking a Nonstationary Problem (38) · 2.5 Optimistic Initial Values (39) · 2.6 Upper-Confidence-Bound Action Selection (41) · 2.7 Gradient Bandits (42) · 2.8 Associative Search (Contextual Bandits) (46) · 2.9 Summary (47)

**3 Finite Markov Decision Processes** (53)
3.1 The Agent–Environment Interface (53) · 3.2 Goals and Rewards (57) · 3.3 Returns (59) · 3.4 Unified Notation for Episodic and Continuing Tasks (61) · \*3.5 The Markov Property (62) · 3.6 Markov Decision Processes (67) · 3.7 Value Functions (70) · 3.8 Optimal Value Functions (75) · 3.9 Optimality and Approximation (79) · 3.10 Summary (80)

**4 Dynamic Programming** (89)
4.1 Policy Evaluation (90) · 4.2 Policy Improvement (94) · 4.3 Policy Iteration (96) · 4.4 Value Iteration (98) · 4.5 Asynchronous Dynamic Programming (101) · 4.6 Generalized Policy Iteration (104) · 4.7 Efficiency of Dynamic Programming (106) · 4.8 Summary (107)

**5 Monte Carlo Methods** (113)
5.1 Monte Carlo Prediction (114) · 5.2 Monte Carlo Estimation of Action Values (119) · 5.3 Monte Carlo Control (120) · 5.4 Monte Carlo Control without Exploring Starts (124) · 5.5 Off-policy Prediction via Importance Sampling (127) · 5.6 Incremental Implementation (133) · 5.7 Off-Policy Monte Carlo Control (135) · \*5.8 Importance Sampling on Truncated Returns (136) · 5.9 Summary (138)

**6 Temporal-Difference Learning** (143)
6.1 TD Prediction (143) · 6.2 Advantages of TD Prediction Methods (148) · 6.3 Optimality of TD(0) (151) · 6.4 Sarsa: On-Policy TD Control (154) · 6.5 Q-Learning: Off-Policy TD Control (157) · 6.6 Games, Afterstates, and Other Special Cases (160) · 6.7 Summary (161)

**7 Eligibility Traces** (167)
7.1 n-Step TD Prediction (168) · 7.2 The Forward View of TD(λ) (172) · 7.3 The Backward View of TD(λ) (177) · 7.4 Equivalences of Forward and Backward Views (181) · 7.5 Sarsa(λ) (183) · 7.6 Watkins's Q(λ) (186) · 7.7 Off-policy Eligibility Traces using Importance Sampling (188) · 7.8 Implementation Issues (189) · \*7.9 Variable λ (190) · 7.10 Conclusions (190)

**8 Planning and Learning with Tabular Methods** (195)
8.1 Models and Planning (195) · 8.2 Integrating Planning, Acting, and Learning (198) · 8.3 When the Model Is Wrong (203) · 8.4 Prioritized Sweeping (206) · 8.5 Full vs. Sample Backups (210) · 8.6 Trajectory Sampling (213) · 8.7 Heuristic Search (217) · 8.8 Monte Carlo Tree Search (220, *heading only*) · 8.9 Summary (220)

**Part II — Approximate Solution Methods** (223)

**9 On-policy Approximation of Action Values** (225)
9.1 Value Prediction with Function Approximation (226) · 9.2 Gradient-Descent Methods (229) · 9.3 Linear Methods (232) — *Coarse Coding (234), Tile Coding (236), Radial Basis Functions (238), Kanerva Coding (240)* · 9.4 Control with Function Approximation (241) · 9.5 Should We Bootstrap? (247) · 9.6 Summary (249)

**10 Off-policy Approximation of Action Values** (255) — *empty in this draft*

**11 Policy Approximation** (257)
11.1 Actor–Critic Methods (257) · 11.2 Eligibility Traces for Actor–Critic Methods (259) · 11.3 R-Learning and the Average-Reward Setting (260)

**Part III — Frontiers** (265)

**12 Psychology** (269) — *empty* · **13 Neuroscience** (271) — *empty*

**14 Applications and Case Studies** (273)
14.1 TD-Gammon (273) · 14.2 Samuel's Checkers Player (279) · 14.3 The Acrobot (282) · 14.4 Elevator Dispatching (286) · 14.5 Dynamic Channel Allocation (291) · 14.6 Job-Shop Scheduling (295)

**15 Prospects** (303)
15.1 The Unified View (303) · 15.2 State Estimation · 15.3 Temporal Abstraction · 15.4 Predictive Representations (all p. 306, *headings only*) · 15.5 Other Frontier Dimensions (306)

References (311) · Index (338)

\* = marked by the authors as more difficult / skippable on first reading. The app will carry this "★ optional" badge.

### Inventory totals (extracted)
| Kind | Count | Notes |
|---|---|---|
| Numbered equations | ~112 | (2.1)–(2.11), (3.1)–(3.17), (4.1)–(4.10), (5.1)–(5.7), (6.1)–(6.6), (7.1)–(7.13), (8.1)–(8.2), (9.1)–(9.9), (11.1)–(11.2), (14.1); plus important unnumbered ones (UCB derivation, gradient-bandit derivation, λ-return, etc.) |
| Worked examples | 40 | Ex 3.1–3.12, 4.1–4.3, 5.1–5.5, 6.1–6.6, 7.1–7.2, 8.1–8.5, 9.1–9.2, 11.1 |
| End-of-chapter exercises | 90 | Ch 1 (5), 2 (6), 3 (20; "no exercise 3.7"), 4 (10), 5 (9), 6 (11), 7 (6), 8 (6), 9 (7) |
| Pseudocode boxes | 30 | Figs 4.1, 4.3, 4.5, 5.1, 5.4, 5.6, 5.9, 5.10, 6.1, 6.9, 6.12, 7.7, 7.10, 7.12, 7.15, 8.1, 8.4, 8.9, 9.1, 9.8, 9.9, 11.2, plus in-text bandit algorithm (Ex 2.2) |
| Figures | ~95 | Learning curves, backup diagrams, value-function plots, gridworlds |

---

## 2. Chapter-wise syllabus

Each chapter lists: **(a)** what it teaches, **(b)** prerequisites, **(c)** concepts to master, **(d)** equations to understand/derive, **(e)** visualisation candidates, **(f)** generatable numerical question types, **(g)** forward connections.

### Ch 1 — The Reinforcement Learning Problem (pp. 1–26)
- **(a)** What RL is; the three distinguishing features (closed-loop, no instructions, delayed consequences); RL vs supervised/unsupervised learning; exploration–exploitation dilemma; elements: policy, reward signal, value function, model; evolutionary methods vs value-function methods; tic-tac-toe value learning; history (trial-and-error, optimal control, TD).
- **(b)** None beyond basic probability.
- **(c)** Agent/environment, reward vs value, model-based vs model-free, exploratory vs greedy moves, the tic-tac-toe TD-style update \(V(s) \leftarrow V(s) + \alpha[V(s') - V(s)]\) (in-text, p. 13).
- **(d)** The tic-tac-toe update rule (first appearance of the TD idea).
- **(e)** Tic-tac-toe self-play learner showing state values updating after each game (Fig. 1.1).
- **(f)** Single-step value updates for given α; conceptual MCQs on the elements.
- **(g)** → Ch 2 (exploration), Ch 3 (formal problem), Ch 6 (TD update), §6.6 (afterstates).

### Ch 2 — Multi-arm Bandits (pp. 31–52)
- **(a)** Evaluative vs instructive feedback in the single-state setting.
- **(b)** Expectation, sample mean, argmax, exponentials; for §2.7: derivatives, quotient rule, gradient ascent.
- **(c)** True value q(a) vs estimate Q_t(a); sample-average method; greedy, ε-greedy; 10-armed testbed; incremental update "NewEstimate ← OldEstimate + StepSize[Target − OldEstimate]"; constant α and exponential recency-weighted average; stochastic-approximation step-size conditions; optimistic initial values; UCB; gradient bandit with softmax and baseline; associative search; parameter study (Fig. 2.5).
- **(d)** (2.1) sample average · (2.2) greedy · (2.3) incremental mean (**derive from 2.1**) · (2.5)/(2.6) recency weighting (**derive the unrolled weighted sum and show weights sum to 1**) · (2.7) Robbins–Monro conditions · (2.8) UCB · (2.9) softmax · (2.10) gradient-bandit update · (2.11) gradient ascent; **full derivation pp. 44–46 that (2.10) is stochastic gradient ascent**, including \(\partial\pi_t(b)/\partial H_t(a) = \pi_t(b)(\mathbb{I}_{a=b}-\pi_t(a))\).
- **(e)** ★ Bandit simulator (10-armed testbed: greedy / ε-greedy / optimistic / UCB / gradient ± baseline; average reward and % optimal action, Figs 2.1–2.4) · parameter-study sweep (Fig. 2.5) · recency-weighting visualiser (weights \(\alpha(1-\alpha)^{k-i}\)) · softmax/preference playground · nonstationary drifting-arm demo (Exercise 2.4).
- **(f)** Incremental-mean updates; constant-α estimates after a reward sequence; weight on reward i; UCB scores and selected arm; softmax probabilities; one gradient-bandit update; ε-greedy probability of selecting the greedy action; Exercise 2.6-style reasoning.
- **(g)** Incremental update form reused in every later chapter; ε-greedy in Ch 5–9; softmax/gradient → actor–critic (Ch 11); step-size conditions → convergence remarks in Ch 6, 9.

### Ch 3 — Finite Markov Decision Processes (pp. 53–87)
- **(a)** The full RL problem formalised.
- **(b)** Ch 2; conditional probability, expectation, conditional expectation, geometric series, linear systems.
- **(c)** Agent–environment interface S_t, A_t, R_{t+1}; reward hypothesis; episodic vs continuing; return; discounting; absorbing-state unified notation; Markov property (★); MDP dynamics p(s′,r|s,a) and derived quantities; policies π(a|s); v_π, q_π; Bellman expectation equation; backup diagrams; optimal v_*, q_*, π_*; Bellman optimality equations; optimality vs approximation.
- **(d)** (3.1)–(3.3) returns (**derive the recursive form G_t = R_{t+1} + γG_{t+1}**, geometric-series sum for constant reward) · (3.4)/(3.5) Markov property · (3.6)–(3.9) dynamics & expected rewards (**derive r(s,a), p(s′|s,a), r(s,a,s′) from p(s′,r|s,a)**) · (3.10)–(3.12) value functions & **Bellman equation derivation** · (3.13)–(3.17) optimal values & Bellman optimality (**derive (3.17) from (3.16)**). Exercises 3.8 (Bellman for q_π), 3.10–3.11 (adding a constant c to rewards: continuing vs episodic), 3.18–3.21 (v_* ↔ q_* ↔ π_*).
- **(e)** ★ MDP explorer (recycling robot, Ex 3.3/3.7/3.11, editable α, β, r_search, r_wait; transition graph Fig. 3.3) · ★ Bellman equation visualiser on the 5×5 gridworld (Ex 3.8: A→A′ +10, B→B′ +5; Fig. 3.5) with γ slider and solved v_π · backup-diagram stepper (Figs 3.4, 3.7) · return calculator (discount slider, episodic vs continuing) · optimal gridworld (Fig. 3.8).
- **(f)** Compute G_t from reward sequences (finite/infinite, γ); derived probabilities/expected rewards from a p(s′,r|s,a) table; one Bellman backup at a state; check Bellman consistency of a given value (Exercise 3.9 style: centre state 0.7); effect of adding constant c (Exercise 3.11: \(v_c = c/(1-γ)\)); q from v and v from q.
- **(g)** Bellman equations → DP updates (Ch 4), MC/TD targets (Ch 5–6), all control methods; Markov property → §15.5.

### Ch 4 — Dynamic Programming (pp. 89–111)
- **(a)** Computing v_π and v_* given a perfect model.
- **(b)** Ch 3; fixed-point iteration intuition; max over finite sets.
- **(c)** Iterative policy evaluation (expected/full backups, in-place sweeps, stopping threshold θ); policy improvement theorem; greedy improvement; policy iteration; value iteration; asynchronous DP; GPI; complexity of DP vs direct search.
- **(d)** (4.1)/(4.2) Bellman optimality restated · (4.3)–(4.5) evaluation update · (4.6) q_π(s,a) · (4.7)–(4.8) **policy improvement theorem and its proof (p. 95, chain of inequalities)** · (4.9) greedy policy · (4.10) value-iteration backup; argument that if π′ = π then v_π satisfies Bellman optimality.
- **(e)** ★ DP simulator on the 4×4 gridworld (Ex 4.1, Fig. 4.2): sweep-by-sweep v_k and greedy policy; in-place vs two-array toggle · policy iteration / value iteration step-through with convergence plot · Gambler's problem (Ex 4.3, p_h slider; Fig. 4.6) · Jack's car rental (Ex 4.2, Fig. 4.4; computed in a Web Worker) · GPI diagram (Fig. 4.7).
- **(f)** One sweep of evaluation on small grids; Exercise 4.1 (q_π(11, down), q_π(7, down)); Exercise 4.2 (new state 15); greedy action from given v; one value-iteration backup; number of sweeps to reach θ (computed).
- **(g)** Expected backups vs sample backups (Ch 6, §8.5); GPI frames MC control (Ch 5), Sarsa/Q-learning (Ch 6), Dyna (Ch 8).

### Ch 5 — Monte Carlo Methods (pp. 113–141)
- **(a)** Learning from complete sample episodes without a model.
- **(b)** Ch 3–4; law of large numbers, sample means, variance, importance sampling basics, bias vs variance.
- **(c)** First-visit vs every-visit MC prediction; blackjack; backup diagram for MC; soap-bubble example (MC on subsets of states); action-value estimation and the need for exploration; exploring starts; MC ES; ε-soft / ε-greedy on-policy control (and why policy improvement still holds, eq 5.2); target vs behaviour policy (π, µ), coverage assumption; importance-sampling ratio; ordinary vs weighted IS (bias/variance); infinite-variance example; incremental weighted IS with cumulative weights C; off-policy MC control; ★ truncated returns.
- **(d)** (5.1) greedy policy · (5.2) **ε-soft policy-improvement proof** · (5.3) **IS ratio, with derivation showing transition probabilities cancel** · (5.4) ordinary IS · (5.5) weighted IS · (5.6)/(5.7) **derive incremental weighted update** (Exercise 5.8).
- **(e)** ★ Blackjack MC (Ex 5.1/5.3, Figs 5.2, 5.5): value surfaces, usable-ace toggle, MC ES policy · ★ Importance-sampling lab (Ex 5.4 off-policy blackjack state, Fig. 5.7; Ex 5.5 one-state infinite-variance MDP, Fig. 5.8): ordinary vs weighted estimates over episodes · first-visit vs every-visit on a hand-entered episode · racetrack (Exercise 5.9) as optional programming lab.
- **(f)** First-visit / every-visit estimates from given episodes; returns per visit; ρ for a given trajectory and policies; ordinary vs weighted IS estimates; incremental W, C, V updates; ε-greedy action probabilities.
- **(g)** MC targets G_t → n-step returns and λ-return (Ch 7); IS ratios → off-policy traces (§7.7); MC vs TD comparisons in Ch 6.

### Ch 6 — Temporal-Difference Learning (pp. 143–165)
- **(a)** Bootstrapping from sample experience — "the most important chapter" per the Preface.
- **(b)** Ch 4–5.
- **(c)** TD(0) prediction, TD error; MC vs TD targets (6.3)/(6.4); driving-home example; random walk; advantages of TD; batch updating and certainty-equivalence estimate; "You are the predictor"; Sarsa; windy gridworld; Q-learning; cliff walking (on-policy vs off-policy behaviour); afterstates.
- **(d)** (6.1) constant-α MC · (6.2) TD(0) · (6.3)/(6.4) **why MC and TD targets are estimates** (the three expectations: sampled, bootstrapped, both) · (6.5) Sarsa · (6.6) Q-learning; batch TD = certainty-equivalence (Ex 6.4: batch TD gives V(A)=3/4, batch MC gives V(A)=0).
- **(e)** ★ MC vs TD on driving home (Figs 6.3/6.4) · ★ random walk (Fig. 6.5–6.7): estimates per episode, RMS error vs episodes for several α; batch mode (Fig. 6.8) · ★ windy gridworld Sarsa (Figs 6.10/6.11, including king's moves/stochastic wind Exercises 6.6/6.7) · ★ cliff walking Sarsa vs Q-learning (Fig. 6.13): online reward curves and learned paths · ★ configurable Q-learning gridworld sandbox (grid editor: start, terminals, walls, rewards, α, γ, ε, live Q-values/arrows).
- **(f)** One TD(0) update; TD errors along a trajectory; Sarsa and Q-learning updates from a transition; contrast Sarsa vs Q-learning target on the same transition; batch TD vs batch MC values (Ex 6.4 variants); random-walk true values 1/6…5/6 (Exercise 6.5).
- **(g)** TD error δ_t → traces (Ch 7), Dyna planning (Ch 8), gradient TD (Ch 9), actor–critic critic (Ch 11), TD-Gammon (§14.1).

### Ch 7 — Eligibility Traces (pp. 167–193)
- **(a)** Unifying TD and MC through n-step returns and λ.
- **(b)** Ch 5–6; geometric series, weighted averages.
- **(c)** n-step returns and n-step TD; error-reduction property; on-line vs off-line updating; λ-return and forward view; backward view with traces; accumulating, replacing, dutch traces; equivalence of forward/backward views (off-line), true online TD(λ); Sarsa(λ); Watkins's Q(λ) (cut traces on exploratory actions); off-policy traces with IS; implementation issues; ★ variable λ.
- **(d)** (7.1) n-step return · (7.2)–(7.4) n-step update, on-line/off-line · λ-return (7.6) **with derivation that weights (1−λ)λ^{n−1} sum to 1 and the episodic tail weight λ^{T−t−1}** · (7.7) λ-return algorithm · (7.8)–(7.11) traces and backward-view update · (7.12) replacing · (7.13) dutch.
- **(e)** ★ n-step TD on 19-state random walk (Ex 7.1, Fig. 7.2) with n and α sliders · λ-return weighting visualiser (Fig. 7.4) · trace-type visualiser (accumulating/replacing/dutch on a visit sequence, Fig. 7.9) · Sarsa(λ) traces in gridworld (Ex 7.2, Fig. 7.13) · Watkins's Q(λ) trace cutting.
- **(f)** Compute G_t^{(n)} for given n; λ-return from n-step returns; trace values after a visit sequence for each trace type; one backward-view TD(λ) update vector; weight on the k-th n-step return; half-life of λ (Exercise 7.4: \(\tau\) with \(\lambda^{\tau}=1/2\)).
- **(g)** Traces → gradient TD(λ) (Ch 9), actor–critic traces (§11.2), TD-Gammon; λ bound (9.9).

### Ch 8 — Planning and Learning with Tabular Methods (pp. 195–222)
- **(a)** Unifying model-based planning and model-free learning.
- **(b)** Ch 4, 6.
- **(c)** Distribution vs sample models; planning = value updates on simulated experience; random-sample one-step Q-planning; direct vs indirect RL; Dyna architecture and Dyna-Q; model errors, blocking/shortcut mazes, Dyna-Q+ exploration bonus κ√τ; prioritized sweeping; full vs sample backups and branching factor b; trajectory sampling vs uniform; heuristic search as deep backups.
- **(d)** (8.1) full backup for q_* · (8.2) sample (Q-learning) backup; computational trade-off analysis of §8.5 (error reduction vs b·t).
- **(e)** ★ Dyna-Q maze (Ex 8.1, Fig. 8.5): planning-steps n slider, steps-per-episode curves, policy after episode 2 · blocking/shortcut mazes, Dyna-Q vs Dyna-Q+ (Figs 8.7/8.8) · prioritized sweeping queue animation (Fig. 8.9/8.10) · full vs sample backups (Fig. 8.13).
- **(f)** Dyna-Q model table and planning updates for given transitions; Dyna-Q+ bonus values; priority computation |P| for prioritized sweeping; number of sample backups vs one full backup for given b.
- **(g)** Unified view (§15.1, Fig. 15.1); MCTS/heuristic search (frontier).

### Ch 9 — On-policy Approximation of Action Values (pp. 225–254)
- **(a)** Generalisation via parameterised value functions.
- **(b)** Ch 6–7; vectors, dot products, gradients, partial derivatives, chain rule, MSE, SGD; basic supervised learning helps.
- **(c)** Value prediction as supervised learning; MSVE with on-policy distribution d; gradient-descent and **semi-gradient** (bootstrapped targets) methods; gradient TD(λ) forward/backward; linear methods and features; convergence bound (9.9); coarse coding; tile coding (hashing); RBFs; Kanerva coding; control with FA (gradient Sarsa(λ), Watkins's Q(λ)); mountain car; should we bootstrap (Fig. 9.12).
- **(d)** (9.1) MSVE · (9.2)/(9.3) **gradient update derivation from (9.1)** · (9.4)–(9.7) gradient TD(λ) · (9.8) linear form, \(\nabla \hat v = x(s)\) · (9.9) RMSE bound.
- **(e)** ★ Coarse-coding/tile-coding visualiser (Figs 9.2–9.6): drag a point, see active tiles; width effect on generalisation (Ex 9.1, Fig. 9.4) · RBF visualiser (Fig. 9.7) · ★ mountain-car with tile-coded Sarsa(λ) (Ex 9.2, Figs 9.10/9.11): cost-to-go surface · state-aggregation random walk (Exercise 9.2).
- **(f)** Linear \(\hat v\) value; one gradient/semi-gradient update of w; trace vector update; active tiles for a point; RMSE bound for given γ, λ; tabular as special case (Exercise 9.5).
- **(g)** Actor–critic with FA (Ch 11); TD-Gammon network (§14.1); acrobot tile coding (§14.3); off-policy divergence (Ch 10, empty in this draft).

### Ch 11 — Policy Approximation (pp. 257–264)
- **(a)** Methods with an explicit policy representation; average-reward setting.
- **(b)** Ch 2 (§2.7 gradient bandit), Ch 6, Ch 7.
- **(c)** Actor–critic architecture; TD error as critic signal; preference update with softmax; traces for actor and critic (eq 11.2, the \(1-\pi_t\) form); average reward ρ^π, relative values, R-learning; access-control queuing.
- **(d)** Critic δ_t (Fig. 11.1) · actor update \(H(S_t,A_t) \leftarrow H + \beta\delta_t\) · (11.1)/(11.2) traces · R-learning updates (Fig. 11.2).
- **(e)** Actor–critic on a small gridworld (preferences + critic V, live) · R-learning on access-control queue (Ex 11.1, Fig. 11.3).
- **(f)** One actor–critic step (δ, V, H, new softmax probabilities); one R-learning update incl. \(\bar R\) update condition.
- **(g)** Gradient bandit (Ch 2) generalised; TD-Gammon; supplementary policy-gradient track (if approved).

### Ch 14 — Applications and Case Studies (pp. 273–301)
- **(a)** How the methods were applied: TD-Gammon (TD(λ) + neural net, eq 14.1), Samuel's checkers (backup diagram Fig. 14.3), Acrobot (Sarsa(λ) + tile coding), elevator dispatching (multi-agent Q-learning, continuous-time), dynamic channel allocation, job-shop scheduling.
- **(b)** Ch 6, 7, 9.
- **(c)/(d)** Design choices per case: state representation, reward design, algorithm, function approximator, results.
- **(e)** Case-study cards with "which chapter concepts are used" overlays; acrobot dynamics demo optional (Fig. 14.5 equations).
- **(f)** Mainly conceptual/scenario questions ("which algorithm and why"); a TD-Gammon weight-update question using (14.1).
- **(g)** Integrates everything.

### Ch 15 — Prospects (pp. 303–310)
- **(a)** §15.1 the unified view: dimensions of width (sample vs full backups) and depth (bootstrapping), Fig. 15.1; the list of further dimensions (function approximation, on/off-policy, return definition, action values vs state values, action selection, synchronous vs asynchronous, traces type, real vs simulated, location/timing/memory of backups); §15.5 non-Markov states, hierarchy, etc.
- **(e)** ★ Interactive "space of methods" map (Fig. 15.1): click a point (e.g. one-step sample backup) → links to TD(0), MC, DP, exhaustive search lessons.
- **(f)** Classification questions: place algorithm X on the width/depth plane.

*(Ch 10, 12, 13 and §8.8, §15.2–15.4 appear in the app's navigation as "Not written in this draft" so the TOC is faithful, with no fabricated content.)*

---

## 3. Concept dependency map

```mermaid
graph TD
  C1[Ch1 RL problem, elements] --> C2a[Bandits: action values, ε-greedy]
  C2a --> C2b[Incremental update & step sizes]
  C2a --> C2c[Optimistic init, UCB]
  C2a --> C2d[Gradient bandit, softmax]
  C2b --> C3a[Agent–env interface, returns, γ]
  C3a --> C3b[MDP dynamics p(s',r|s,a)]
  C3b --> C3c[v_π, q_π, Bellman expectation]
  C3c --> C3d[v_*, q_*, Bellman optimality]
  C3c --> D1[Policy evaluation]
  C3d --> D2[Policy improvement theorem]
  D1 --> D3[Policy iteration]
  D2 --> D3
  C3d --> D4[Value iteration]
  D3 --> GPI[GPI]
  D4 --> GPI
  C3c --> MC1[MC prediction]
  GPI --> MC2[MC control: ES, ε-soft]
  MC1 --> MC3[Importance sampling, off-policy MC]
  MC1 --> TD1[TD(0) prediction]
  D1 --> TD1
  TD1 --> TD2[Batch TD, certainty equivalence]
  TD1 --> SARSA[Sarsa]
  GPI --> SARSA
  TD1 --> QL[Q-learning]
  C3d --> QL
  TD1 --> NS[n-step TD]
  MC1 --> NS
  NS --> LR[λ-return / forward view]
  LR --> ET[Eligibility traces / backward view]
  ET --> SL[Sarsa(λ), Q(λ)]
  MC3 --> OPT[Off-policy traces]
  ET --> OPT
  QL --> DYNA[Dyna-Q, planning]
  D1 --> DYNA
  DYNA --> PS[Prioritized sweeping, full vs sample, trajectory sampling]
  TD1 --> FA1[Gradient & semi-gradient prediction]
  ET --> FA1
  FA1 --> FA2[Linear features: coarse/tile/RBF]
  FA2 --> FA3[Control with FA: mountain car]
  SL --> FA3
  C2d --> AC[Actor–critic]
  TD1 --> AC
  ET --> AC2[Actor–critic traces]
  QL --> RL[R-learning, average reward]
  FA3 --> APP[Ch14 case studies]
  AC --> APP
  PS --> UV[Ch15 unified view]
  ET --> UV
```

The app will store this as data (`prerequisites: string[]` on every concept) so the Concept Explorer graph, "you should first review…" prompts and weak-topic recommendations all derive from one source.

---

## 4. Mathematical prerequisite map (contextual, introduced where first needed)

| Prerequisite | First needed at | Used again in | Delivered as |
|---|---|---|---|
| Random variables, expectation E[X] | §2.1 (q(a) = E[R_t \| A_t=a]) | everywhere | inline "Math aside" card |
| Sample mean, law of large numbers | §2.2 (2.1) | Ch 5 | aside + simulation |
| Argmax, ties | §2.2 (2.2) | Ch 4–6 | aside |
| Recurrences / unrolling sums | §2.3–2.4 (2.3)–(2.6) | Ch 5 (5.7), Ch 7 | step-by-step derivation |
| Series convergence (Σα=∞, Σα²<∞) | §2.4 (2.7) | Ch 6, 9 | aside |
| Logarithm & √ growth | §2.6 UCB | — | interactive plot |
| Exponentials, softmax | §2.7 (2.9) | Ch 11 | playground |
| Partial derivatives, quotient rule, gradient ascent | §2.7 derivation | Ch 9, 11 | derivation with hover-explained steps |
| Conditional probability, joint distributions | §3.5–3.6 (3.4)–(3.9) | Ch 4–5 | aside with p(s′,r\|s,a) table |
| Conditional expectation, linearity, law of total expectation | §3.7 Bellman derivation | Ch 4, 6 | derivation |
| Geometric series | §3.3 (3.2), Exercise 3.11 | Ch 7 λ-weights | aside |
| Linear systems (|S| equations) | §3.7 (solve v_π directly) | Ch 4 | solver shown in visualiser |
| Fixed points, contraction (intuition only — book does not prove it) | §4.1 | §4.4 | **supplementary** aside, labelled |
| Variance, bias, unbiased estimators | §5.5 | Ch 6–7 | aside + IS lab |
| Importance sampling | §5.5 (5.3) | §7.7 | derivation |
| Weighted averages, normalisation | §7.2 λ-return | — | visualiser |
| Vectors, dot product, w^⊤x | §9.3 (9.8) | Ch 11, 14 | aside |
| Gradient ∇, MSE, SGD | §9.1–9.2 (9.1)–(9.3) | Ch 14 | derivation |
| Chain rule / backprop (only mentioned) | §9.2, §14.1 | — | brief supplementary aside |
| Average (long-run) reward | §11.3 | — | aside |

---

## 5. Interactive visualisations (prioritised)

**Tier 1 — build first (directly from textbook figures/examples):**
1. **Bandit simulator** — 10-armed testbed (q*(a) ~ N(0,1), R ~ N(q*,1)); greedy, ε-greedy, optimistic (Q₁=5), UCB (c), gradient bandit ± baseline; configurable arms, stationary/nonstationary; plots average reward, % optimal action, cumulative reward. "Regret" plot only in the supplementary track (not defined in this text). Figs 2.1–2.5.
2. **MDP explorer** — recycling robot graph (Fig. 3.3), editable parameters, step through transitions, sample trajectories, policy overlay; build-your-own small MDP.
3. **Bellman visualiser** — 5×5 gridworld (Ex 3.8): click a state to see its backup (Fig. 3.4) with numbers; γ slider re-solves v_π instantly; toggle to v_* (Fig. 3.8).
4. **DP simulator** — 4×4 gridworld policy evaluation sweep-by-sweep (Fig. 4.2), policy iteration, value iteration, in-place toggle, Δ convergence chart; Gambler's problem with p_h slider (Fig. 4.6); Jack's car rental (Fig. 4.4, Web Worker).
5. **MC vs TD lab** — random walk A–E (Figs 6.5–6.8): per-episode estimates, RMS curves, batch mode; driving-home MC vs TD changes (Figs 6.3/6.4).
6. **Sarsa vs Q-learning** — cliff walking (Fig. 6.13) and windy gridworld (Fig. 6.11), side-by-side learned paths and reward-per-episode.
7. **Q-learning gridworld sandbox** — grid editor (start, terminals, walls, per-cell rewards, wind), α/γ/ε, algorithm selector (Sarsa / Q-learning / Sarsa(λ) / Dyna-Q), live Q-value heatmap, greedy arrows, step/play/fast-forward, seeded RNG for reproducibility.

**Tier 2:**
8. Blackjack MC (prediction + MC ES; value surfaces Figs 5.2/5.5).
9. Importance-sampling lab (Ex 5.4, Ex 5.5 infinite variance).
10. n-step TD & λ-return visualisers (19-state walk, Figs 7.2/7.4/7.6).
11. Eligibility-trace visualiser (accumulating / replacing / dutch, Fig. 7.9) + Sarsa(λ) path traces (Fig. 7.13).
12. Dyna-Q maze with planning-step slider; blocking/shortcut mazes, Dyna-Q+ (Figs 8.5, 8.7, 8.8); prioritized-sweeping queue.
13. Coarse/tile-coding & RBF feature visualiser (Figs 9.2–9.7).
14. Mountain car with tile-coded Sarsa(λ) (Fig. 9.10).

**Tier 3:**
15. Recency-weighting & softmax/gradient-bandit playgrounds (small, embedded in lessons).
16. Actor–critic gridworld; R-learning access-control queue (Fig. 11.3).
17. Full vs sample backups efficiency chart (Fig. 8.13).
18. Unified-view method map (Fig. 15.1).
19. Tic-tac-toe self-play value learner (Ch 1).

All simulations share one pure-TypeScript RL core (`src/lib/rl/*`) that is unit-tested; visualisations only render state from it.

---

## 6. Question-bank design

### Schema (TypeScript)
```ts
type Difficulty = 1 | 2 | 3 | 4;        // Beginner, Intermediate, Advanced, Challenging
type QType =
  | 'mcq-single' | 'mcq-multi' | 'true-false-justify'
  | 'numeric'                       // tolerance-checked
  | 'multi-step-numeric'            // several graded numeric fields (intermediate steps)
  | 'ordering'                      // order pseudocode lines / algorithm steps
  | 'match'                         // e.g. equation ↔ name
  | 'derivation-selfcheck';         // reveal-step derivation, self-graded with rubric
type Category = 'conceptual' | 'definition' | 'derivation' | 'numerical' | 'algorithm-trace'
  | 'pseudocode' | 'scenario' | 'compare-contrast' | 'analytical';

interface Question {
  id: string;                 // 'ch6-td0-update-003' or 'gen:td0-update:seed'
  chapter: number; sections: string[]; conceptIds: string[];
  type: QType; category: Category; difficulty: Difficulty; marks: number;
  stem: string;               // Markdown + KaTeX
  options?: Option[]; answer: Answer; tolerance?: number;
  solution: Step[];           // step-by-step, each step with LaTeX
  explanation: string; misconceptions?: { wrong: string; why: string }[];
  source: { kind: 'textbook-exercise' | 'textbook-derived' | 'supplementary'; ref?: string; page?: number };
}
```

### Two sources of questions
1. **Authored questions** (static data, reviewed): conceptual, definitional, compare-contrast, scenario, derivation self-checks, plus adapted versions of the book's exercises (with page refs). Target ≈ 25–45 per chapter, ≈ 350–450 total for core chapters.
2. **Parametric generators** (seeded, unlimited): each generator produces stem + answer + worked solution **by calling the same tested functions in `src/lib/rl`** that power the simulations, so answer keys cannot drift from the maths. Planned generators:
   - Ch 2: incremental mean; constant-α estimate; recency weights; UCB scores/choice; softmax probs; gradient-bandit update; ε-greedy selection probabilities.
   - Ch 3: discounted return (finite/infinite/constant reward); derived dynamics quantities from a p(s′,r|s,a) table; one Bellman expectation backup; q↔v conversions; reward-shift constant.
   - Ch 4: one evaluation sweep on a small grid; greedy policy from v; one value-iteration backup.
   - Ch 5: first-/every-visit MC estimates from episodes; IS ratio; ordinary vs weighted IS; incremental weighted IS.
   - Ch 6: TD(0), Sarsa, Q-learning updates; TD errors along a trajectory; batch TD vs MC.
   - Ch 7: n-step returns; λ-return; trace values (3 types); TD(λ) backward update.
   - Ch 8: Dyna-Q model/planning updates; Dyna-Q+ bonus; prioritized-sweeping priority.
   - Ch 9: linear v̂; semi-gradient TD(0) weight update; trace vector; active tiles; RMSE bound.
   - Ch 11: actor–critic step; R-learning step.

### Validation rules
- Every generator has unit tests: hand-computed fixtures + property tests (e.g. softmax sums to 1, recency weights sum to 1 with initial weight, Bellman fixed point satisfied by the solved v_π).
- Textbook numeric facts used as fixtures: random-walk true values 1/6…5/6; gridworld (Ex 3.8) values, e.g. v_π(A) ≈ 8.8; Exercise 3.9 centre-state check (0.7); Ex 6.4 batch values; 4×4 gridworld k=∞ values (−14, −20, −22…).
- Numeric answers checked with relative/absolute tolerance stated in the question; generators reject parameter draws that produce ambiguous ties (e.g. argmax ties in UCB unless tie-breaking is specified).
- Authored items get a review checklist: single correct answer, notation matches book, page ref verified.

### Assessment modes (all built on the same engine)
Topic practice · Chapter tests · Mixed-topic · Full mock (configurable count/duration/difficulty mix) · Numerical practice (generators only) · Revision tests (incorrect + marked + SR-due items) · Custom test builder (chapter, topic, difficulty, type, count).

### Exam interface
Timer with auto-submit (timer driven by stored start timestamp so refresh doesn't reset it), question palette (answered / unanswered / marked / current), mark for review, prev/next, submit confirmation listing unanswered, scoring with per-topic breakdown, answer review with correct/incorrect highlighting and full solutions, test history.

---

## 7. Proposed application architecture

**Stack (zero-cost, static deploy):** React 18 + TypeScript + Vite · Tailwind CSS · React Router · **KaTeX** (fast, static rendering) · **Recharts** for learning curves · Canvas/SVG for gridworlds (no game engine) · **MiniSearch** (≈7 kB) for offline full-text search with fuzzy/prefix matching, or a hand-rolled inverted index if you prefer zero search deps · localStorage (versioned schema, migration function) — IndexedDB only if storage exceeds ~2 MB · Web Workers for heavy DP (Jack's car rental) · Vitest + React Testing Library (unit/component) · Playwright (navigation, timer, persistence-after-refresh, mobile viewport) · deploy to GitHub Pages / Netlify / Cloudflare Pages.

**Reuse:** before Milestone 2 I'll inspect `Documents\nlp-study-lab` and `Documents\cloud-mastery-lab` and copy their layout shell, theme tokens, routing, progress store and exam components rather than rebuilding (I haven't opened them yet — this milestone was textbook-only).

**Proposed structure** (new folder, e.g. `Documents\rl-study-lab`):
```
src/
  app/            routes, layout (sidebar desktop / bottom-nav mobile), theme
  content/        curriculum as typed data
    chapters/ch01.ts … ch15.ts     sections → concepts → layers (intuition, formal,
                                   math, derivation, example, computation, connections)
    equations.ts  equation library (latex, symbols, assumptions, derivation steps,
                  numeric example, pitfalls, chapter/section/page)
    definitions.ts algorithms.ts examples.ts flashcards.ts
    questions/    authored question banks per chapter
    supplementary/ (only if approved; tagged source:'supplementary')
  lib/
    rl/           bandits, mdp, bellman, dp, mc, td, traces, dyna, tilecoding,
                  actorCritic, rng (seeded) — pure functions, fully tested
    generators/   parametric question generators using lib/rl
    assessment/   test assembly, scoring, timer logic
    srs/          spaced repetition (SM-2 style)
    search/       index build, synonyms/cross-reference expansion
    progress/     store, schema versioning, analytics selectors
  features/
    dashboard/ learn/ explorer/ lab/ practice/ mock/ revision/ search/ progress/
  components/     Math, EquationCard, DerivationStepper, BackupDiagram, GridCanvas,
                  Chart, QuestionRenderer, Palette, Timer, StatusPill …
tests/            unit (lib), component, e2e (Playwright)
```

**Routes:** `/` Dashboard · `/learn/:chapter/:section?` · `/explorer` (concept graph) · `/lab/:sim` · `/practice` · `/mock` and `/mock/:testId` · `/revision` (flashcards, equations, definitions, algorithms, quick sheets) · `/search?q=` · `/progress`.

**Content model principle:** every content item carries `{chapter, section, page, source: 'textbook'|'textbook-derived'|'supplementary'}`; the UI badges supplementary content and search results show "Ch 3 · §3.7 · p. 71".

**Search:** index concepts, equations (name + symbols + plain-text gloss), definitions, algorithms, examples, exercises; a cross-reference graph (from concept prerequisites + explicit `related`) expands results — e.g. "Bellman equation" → (3.12) expectation, (3.17) optimality, v_π, q_π, backup diagrams, §4.1 policy evaluation, Ex 3.8 gridworld, Ex 3.11 recycling robot.

**Progress store** (no fake data; empty state on first run): per-concept status (not started / learning / understood / needs revision / mastered), question attempts, test results, SRS cards, recent activity, last-visited lesson. Dashboard metrics are pure selectors over this store.

---

## 8. Milestone plan

| # | Milestone | Deliverables | Done when |
|---|---|---|---|
| 1 | **Textbook audit** | This document | ✅ You approve the syllabus & decisions below |
| 2 | Architecture | Inspect NLP/Cloud labs; scaffold Vite project reusing their shell; content schema types; routing; progress store with versioning; KaTeX component; search skeleton | Build passes, schema tests pass, empty-state app navigable on desktop + mobile |
| 3 | Core learning interface | Dashboard (real data only), Learn hierarchy/TOC, lesson viewer with layered sections, derivation stepper, equation cards, light/dark theme | Ch 1–2 lessons render correctly, equations verified, e2e navigation tests pass |
| 4 | Content integration | Ch 1–9, 11, 14, 15 lessons; equation library (~112 + key unnumbered); definitions; algorithms (30 boxes); examples; page refs | Every item has chapter/section/page; spot-checked against PDF; no placeholders |
| 5 | Interactive lab | `lib/rl` core + Tier 1 sims, then Tier 2/3 | Unit tests for every update rule; textbook fixture values reproduced (e.g. Fig. 4.2, random walk) |
| 6 | Assessment engine | Authored banks, generators, practice modes, mock exam UI, custom tests | Generator & scoring tests; timer/auto-submit/palette e2e tests |
| 7 | Revision & analytics | Flashcards + SRS, equation/definition/algorithm revision, quick sheets, incorrect-question revision, progress dashboard, weak-topic analysis | Persistence-across-refresh e2e; analytics selectors tested |
| 8 | Testing & deployment | Full test pass, link checker, responsive checks, Lighthouse, deploy config (GitHub Pages/Netlify) | All tests green; deployed static build works offline-capable |

Each milestone ends with: completed work, files changed, test results, known gaps, next milestone.

Given the volume (13 chapters of content), Milestone 4 will be delivered chapter by chapter (Ch 1–3, then 4–6, then 7–9, then 11/14/15) so you can review content accuracy incrementally.

---

## 9. Decisions needed from you before Milestone 2

1. ✅ **Decided (2026-11-04): Supplementary track.** See §10.
2. **Notation:** keep this draft's notation (n-armed, µ, E_t) — recommended, per "preserve the textbook's notation" — and add a small "2018-edition notation" toggle/footnote (k-armed, b, z_t)?
3. **Project location:** create the app at `C:\Users\BIT\Documents\rl-study-lab`, reusing the NLP Study Lab's architecture?
4. **Ch 14 case studies:** full lessons with scenario questions (recommended), or brief summaries only?

---

## 10. Supplementary track — scope and rules

**Rules**
- Every item has `source: 'supplementary'`, a distinct badge ("Supplementary — not in source text") and its own colour, and cites the original paper instead of a textbook page.
- It never changes core content. Core lessons may show a "Go further →" link to a supplementary module, but core assessments draw only on core content unless you include supplementary questions in a custom test.
- Supplementary modules use the core notation (µ for the behaviour policy, n-armed, and so on), so nothing has to be re-learned.
- Progress for supplementary modules is tracked separately and shown as its own bar, so "syllabus completion" reflects the textbook.

**Modules** (each sits after the core chapter it extends; the papers are the primary references)

| Module | Attaches after | Key content | Primary reference |
|---|---|---|---|
| S2 Regret | §2.6 | Regret definition, why ε-greedy has linear regret, UCB1 logarithmic bound (statement only) | Lai & Robbins (1985); Auer, Cesa-Bianchi & Fischer (2002) |
| S6a Expected Sarsa | §6.5 (Exercise 6.10) | Update rule, variance reduction vs Sarsa, cliff-walking comparison | van Seijen et al. (2009) |
| S6b Double Q-learning | §6.5 | Maximisation bias, the two-estimator update | van Hasselt (2010) |
| S7 n-step Sarsa | §7.1 | n-step control targets (extends core n-step prediction). **Now course content: Lecture 7, slides 33–35** | Sutton & Barto (2018), Ch 7 |
| S11a Policy-gradient theorem & REINFORCE | Ch 11 | Performance objective, theorem statement and derivation, REINFORCE, baseline (links back to §2.7) | Williams (1992); Sutton et al. (2000) |
| S11b Advantage actor–critic | S11a | Advantage, one-step actor–critic as a PG method | Sutton et al. (2000); Mnih et al. (2016) |
| S12 Deep Q-Networks | Ch 9 | Neural Q-function, experience replay, target network, deadly-triad intuition | Mnih et al. (2015) |
| S13 PPO | S11b | Clipped surrogate objective (conceptual, plus a small numeric example) | Schulman et al. (2017) |

**Visualisations added by the track:** a regret curve in the bandit simulator; Expected Sarsa as a third algorithm in cliff walking; a maximisation-bias demo (the small MDP from the 2018 edition, Ex 6.7); REINFORCE on a short-corridor gridworld; a replay-buffer and target-network step-through on a small gridworld. DQN is illustrative only: a tiny MLP in TypeScript, no ML library.

---

## 11. Course alignment: lecture slides (added 2026-11-04)

**Sources received:**
- `L6-Stochastic approximation.pdf` (62 slides) — Lecture 6: *Stochastic Approximation and Stochastic Gradient Descent*, Shiyu Zhao, Westlake University
- `L7-Temporal-Difference Learning.pdf` (56 slides) — Lecture 7: *Temporal-Difference Learning*, same course

**Key finding: the course follows Zhao's *Mathematical Foundations of Reinforcement Learning*, not Sutton & Barto's chapter order.** Every lecture's roadmap slide shows a 10-chapter syllabus:

| Course ch. | Topic | Where it sits in this S&B draft |
|---|---|---|
| 1 | Basic Concepts | Ch 1, §3.1–3.4 |
| 2 | Bellman Equation | §3.5–3.7 |
| 3 | Bellman Optimality Equation | §3.8–3.9 |
| 4 | Value Iteration & Policy Iteration | Ch 4 |
| 5 | Monte Carlo Methods | Ch 5 |
| 6 | **Stochastic Approximation** (L6) | Only eqs. (2.3) and (2.7), plus SGD in §9.2. **The Robbins–Monro theorem, Dvoretzky's theorem, BGD/MBGD and the SGD convergence pattern are not in S&B.** |
| 7 | **Temporal-Difference Methods** (L7) | Ch 6, plus n-step Sarsa (not in this draft) |
| 8 | Value Function Methods | Ch 9 (Ch 10 is empty in this draft) |
| 9 | **Policy Gradient Methods** | **Not in this draft** (supplementary S11a) |
| 10 | **Actor-Critic Methods** | §11.1–11.2 only (supplementary S11b) |

S&B Ch 2 (bandits), Ch 7 (eligibility traces), Ch 8 (planning), §11.3 (R-learning) and Ch 14 have no course chapter. They stay in the app as textbook content but are not on the course's core path.

### Lecture-to-textbook map (L6, L7)

| Lecture content | Slides | S&B anchor | Source tag |
|---|---|---|---|
| Incremental mean \(w_{k+1}=w_k-\frac1k(w_k-x_k)\), derivation and verification | L6 7–11 | §2.3, eq. (2.3) | textbook + lecture |
| General \(\alpha_k\) | L6 12 | §2.4, eq. (2.5) | textbook + lecture |
| Root-finding statement, Robbins–Monro algorithm \(w_{k+1}=w_k-a_k\tilde g(w_k,\eta_k)\) | L6 15–19 | — | lecture |
| Toy examples: \(g(w)=w-10\) with \(a_k=0.5\); \(g(w)=\tanh(w-1)\), \(w_1=3\), \(a_k=1/k\) | L6 20–24 | — | lecture |
| RM theorem (three conditions); why \(\sum a_k=\infty\) and \(\sum a_k^2<\infty\) | L6 25–29 | eq. (2.7) (conditions stated, no theorem) | lecture |
| Mean estimation as a special case of RM | L6 31–32 | — | lecture |
| Dvoretzky's theorem (optional in the lecture) | L6 33 | — | lecture (★ optional) |
| GD → BGD → SGD; \(J(w)=E[\tfrac12\|w-X\|^2]\) exercises | L6 36–43 | §9.2 (SGD for value prediction) | lecture |
| SGD as a special case of RM; convergence theorem | L6 45–48 | — | lecture |
| Convergence pattern: relative-error bound \(\delta_k \le \frac{|\nabla f(w_k,x_k)-E[\nabla f]|}{c|w_k-w^*|}\) | L6 50–54 | — | lecture (★ optional proof) |
| BGD vs MBGD vs SGD; the "m = n is not BGD" remark | L6 56–59 | — | lecture |
| RM progression: \(E[X]\) → \(E[v(X)]\) → \(E[R+\gamma v(X)]\) | L7 5–8 | — | lecture |
| TD(0) for state values; TD target and TD error | L7 10–15 | §6.1, eq. (6.2) | textbook + lecture |
| TD as RM solving the Bellman expectation equation \(v_\pi(s)=E[R+\gamma v_\pi(S')\mid s]\) | L7 16–19 | §6.1, eqs. (6.3)/(6.4) | textbook + lecture |
| TD convergence theorem (w.p.1 under step-size conditions) | L7 20 | §6.2 (remarks only) | lecture |
| TD vs MC (online/offline, continuing/episodic, bootstrapping, variance) | L7 21–22 | §6.2 | textbook + lecture |
| Sarsa (evaluation, then policy search with ε-greedy) | L7 24–29 | §6.4, eq. (6.5), Fig. 6.9 | textbook + lecture |
| Sarsa gridworld example (\(r_{target}=0\), \(r_{forbidden}=r_{boundary}=-10\), \(r_{other}=-1\), α = 0.1, ε = 0.1) | L7 30–31 | — | lecture |
| n-step Sarsa; bias/variance trade-off | L7 33–35 | §7.1 (prediction only) | lecture |
| Q-learning as SA for the Bellman optimality equation | L7 37–39 | §6.5, eq. (6.6) | textbook + lecture |
| On-policy vs off-policy; behaviour vs target policy; how to classify an algorithm | L7 40–44 | §5.5, §6.5 | textbook + lecture |
| Q-learning, on-policy and off-policy pseudocode | L7 45–46 | Fig. 6.12 | textbook + lecture |
| Off-policy Q-learning examples (γ = 0.9, \(r_{target}=1\), \(r_{boundary}=r_{forbidden}=-1\); \(10^5\)-step episodes; ε = 0.5 vs 0.1 behaviour) | L7 47–50 | — | lecture |
| Unified view: \(\bar q_t\) table for Sarsa, n-step Sarsa, Q-learning and MC, and the equation each solves | L7 52–53 | §7.1, §15.1 | lecture |

### Notation conflicts the app must handle

These are real exam traps. Each one becomes a "Notation note" in the lessons and a misconception in the question bank.

| Item | Lectures (Zhao) | S&B draft |
|---|---|---|
| **TD error sign** | \(\delta_t = v_t(s_t) - [r_{t+1}+\gamma v_t(s_{t+1})]\), update \(v \leftarrow v - \alpha\delta_t\) | \(\delta_t = R_{t+1}+\gamma V(S_{t+1}) - V(S_t)\), update \(V \leftarrow V + \alpha\delta_t\) |
| Update form | \(w \leftarrow w - \alpha(w - \text{target})\) | \(V \leftarrow V + \alpha(\text{target} - V)\) (algebraically identical) |
| Samples / estimates | lowercase \(s_t, a_t, r_{t+1}\); estimates \(v_t(s), q_t(s,a)\) | capital \(S_t, A_t, R_{t+1}\); estimates \(V_t, Q_t\) |
| Step size | \(\alpha_t(s_t)\), \(a_k\) (indexed by state and time) | \(\alpha\) (mostly constant) |
| Behaviour / target policy | \(\pi_b\) / \(\pi_T\) | \(\mu\) / \(\pi\) |
| ε-greedy, greedy action | \(1-\frac{\epsilon}{|A(s)|}(|A(s)|-1)\) | \(1-\varepsilon+\frac{\varepsilon}{|A(s)|}\) (equivalent) |
| Gridworld | Zhao's 5×5 grid: forbidden cells, boundary penalty, target cell | S&B gridworlds (Ex 3.8, 4.1, 6.5, 6.6) |

**Proposed handling:** a global notation switch, **Course (Zhao)** or **Textbook (S&B)**. Each equation is stored in both conventions. Every question states which convention it uses. Course notation is the default for course-mapped content.

### What the lectures add to the app
- **Lab:**
  - A Robbins–Monro root-finding visualiser using the L6 toy examples, with step-size presets \(1/k\), constant, \(1/k^2\) and \(1/\sqrt k\) to show which converge.
  - 2-D BGD/MBGD/SGD mean estimation (uniform square of side 20, 100 samples, m = 1/5/50, as on L6 slide 51).
  - A Zhao grid-world mode in the sandbox: forbidden cells, boundary reward, target state.
  - Off-policy Q-learning from one long behaviour-policy episode, with a state-value-error curve and an ε comparison.
  - n-step Sarsa with an n slider.
- **Generators:** RM iterations; checking whether a step-size sequence meets the RM conditions; one SGD or MBGD step for \(f=\tfrac12\|w-x\|^2\); TD, Sarsa, n-step Sarsa and Q-learning updates in both conventions; on-/off-policy classification.
- **Fixture caution:** the optimal state values on L7 slide 47 (5.8 … 10.0) depend on Zhao's grid layout (forbidden cells and target position), which appears only in the slide image. I'll read the layout from the slide image before using those values as test fixtures.

### Consequences for the plan
1. **Learn gets two orders:** "Course path" (Zhao Ch 1 → 10) and "Textbook path" (S&B Ch 1 → 15), over one shared set of lessons.
2. **Policy gradient and actor–critic are core course content** (course Ch 9–10). Supplementary modules S11a/S11b move onto the course path and need a proper source.
3. **Source tags become** `textbook` (S&B, page), `lecture` (lecture and slide number) and `supplementary` (paper citation).

---

## 12. Revised source model: Zhao's book as the course spine (added 2026-11-04)

**Source:** `github.com/MathFoundationRL/Book-Mathematical-Foundation-of-Reinforcement-Learning`, which contains:
- *Mathematical Foundations of Reinforcement Learning*, Shiyu Zhao. The GitHub PDF already includes the July 2025 errata for the Springer edition. The book is published as one PDF per chapter, with printed page numbers 1–273.
- Lecture slides L1–L10 (the "continuously updated" set; your L6/L7 come from this course). **Lecture k = book Chapter k.**
- Author's grid-world code (Python/MATLAB).

This section **supersedes §8–§11 wherever they conflict.** §1–§7 (the S&B audit) remain valid, but S&B now plays the companion role described below.

### 12.1 Recommended source hierarchy
1. **Zhao's book** is the primary source and course spine. It sets the default notation, the chapter order and what counts as core.
2. **Lectures L1–L10** are cited at slide level and attached to the matching book sections.
3. **Sutton & Barto (2015 draft)** is the companion textbook. It provides alternative explanations, examples and exercises on overlapping topics, plus **extension modules** for topics Zhao does not cover.
4. **Supplementary** (papers only): now just regret, Double Q-learning, and a conceptual PPO/TRPO module. Zhao names TRPO, PPO, SAC and TD3 only as further reading (p. 235).

### 12.2 Zhao's table of contents, with core items and S&B companions

| Ch | Sections (printed page) | Theorems / algorithms / boxes | S&B companion | Lecture |
|---|---|---|---|---|
| **1 Basic Concepts** (1) | 1.1 Grid world (1) · 1.2 State & action (2) · 1.3 State transition (3) · 1.4 Policy (4) · 1.5 Reward (6) · 1.6 Trajectories, returns, episodes (8) · 1.7 MDPs (11) · 1.8 Summary · 1.9 Q&A | — | Ch 1, §3.1–3.4, §3.6 | L1 (28 slides) |
| **2 State Values & Bellman Equation** (15) | 2.1–2.2 Motivating examples · 2.3 State values (19) · 2.4 Bellman equation (20) · 2.5 Examples (22) · 2.6 Matrix-vector form (25) · 2.7 Solving: closed form (27), iterative (28) · 2.8 Action values; BE in terms of q (30–32) | Box 2.1 convergence of the iterative solution (2.12) | §3.7, Ex 3.8 | L2 (54) |
| **3 Optimal State Values & BOE** (35) | 3.1 Improving policies · 3.2 Optimal values & policies · 3.3 BOE: max of RHS, matrix form, **contraction mapping theorem** (40), contraction of the BOE RHS (44) · 3.4 Solving for an optimal policy (46) · 3.5 Factors that influence optimal policies (49) | Thm 3.1 contraction mapping (+ Box 3.1 proof) · Thm 3.2 contraction of f(v) · Thm 3.3 existence, uniqueness, algorithm · Thm 3.4 optimality of v*, π* · Thm 3.5 greedy optimal policy · **Thm 3.6 optimal-policy invariance under affine reward change** | §3.8–3.9, Ex 3.10–3.12, Exercises 3.10–3.11, 3.18–3.21 | L3 (46) |
| **4 Value & Policy Iteration** (57) | 4.1 Value iteration (58) · 4.2 Policy iteration (62) · 4.3 **Truncated policy iteration** (70) | Alg 4.1 VI · Lemma 4.1 policy improvement · Thm 4.1 convergence of PI · Alg 4.2 PI · Alg 4.3 truncated PI · Prop 4.1 value improvement | Ch 4 (Ex 4.1–4.3, Jack's car rental, gambler) | L4 (38) |
| **5 Monte Carlo** (77) | 5.1 Mean estimation · 5.2 **MC Basic** (80) · 5.3 MC Exploring Starts (86) · 5.4 MC ε-Greedy (89) · 5.5 Exploration vs exploitation of ε-greedy (92) | Alg 5.1 MC Basic · Alg 5.2 MC ES · Alg 5.3 MC ε-Greedy | Ch 5 §5.1–5.4 (blackjack); §5.5–5.8 off-policy MC is **S&B-only** | L5 (48) |
| **6 Stochastic Approximation** (101) | 6.1 Mean estimation · 6.2 Robbins–Monro (103) · 6.3 Dvoretzky (109) · 6.4 SGD: mean estimation, convergence pattern, deterministic formulation, BGD/SGD/MBGD, convergence (114–121) | Thm 6.1 RM · Thm 6.2 Dvoretzky · Thm 6.3 extension · Thm 6.4 SGD convergence (+ Box 6.1) | eqs. (2.3), (2.7); §9.2 | L6 (62) |
| **7 TD Methods** (125) | 7.1 TD of state values: algorithm, properties, convergence (126–130) · 7.2 Sarsa (133) · 7.3 n-step Sarsa (138) · 7.4 Q-learning, off- vs on-policy (140) · 7.5 Unified viewpoint (145) | Thm 7.1 TD convergence · Thm 7.2 Sarsa convergence · Alg 7.1 Sarsa · **Box 7.4 Expected Sarsa** · Alg 7.2/7.3 Q-learning on/off-policy | Ch 6 (random walk, windy grid, cliff walking, batch TD); Ch 7 n-step TD | L7 (56) |
| **8 Value Function Methods** (151) | 8.1 Table → function · 8.2 TD with FA: objective, optimisation, choosing approximators, examples, **theory** (156–167) · 8.3 Sarsa / Q-learning with FA · 8.4 **Deep Q-learning** (181) | Box 8.1 stationary distribution · Alg 8.1 TD-Linear · Box 8.2 tabular as a special case · Lemma 8.1 · Box 8.4 A positive definite · Box 8.5 w* minimises J_PBE · Box 8.6 error bound · Alg 8.2/8.3 Sarsa/Q-learning with FA | Ch 9 (coarse/tile/RBF coding, mountain car, bound (9.9)) | L8 (227) |
| **9 Policy Gradient** (191) | 9.1 Policy as a function · 9.2 Metrics (v̄, r̄) · 9.3 Gradients, discounted and undiscounted (198–205) · 9.4 REINFORCE (210) | Thm 9.1 policy gradient theorem · Lemmas 9.1–9.3 · Thms 9.2–9.5 (Poisson equation) · Alg 9.1 REINFORCE | §2.7 gradient bandit derivation | L9 (43) |
| **10 Actor-Critic** (215) | 10.1 QAC · 10.2 A2C: baseline invariance, optimal baseline · 10.3 Off-policy AC: importance sampling, off-policy PG theorem · 10.4 Deterministic AC: DPG theorem | Alg 10.1 QAC · Box 10.1 optimal baseline · Alg 10.2 A2C · Thm 10.1 off-policy PG · Alg 10.3 · Thms 10.2–10.4 DPG · Alg 10.4 | Ch 11 §11.1–11.2 | L10 (56) |
| **Appendix** (237) | A Probability preliminaries · B Measure-theoretic probability · C Convergence of sequences (martingales) · D Gradient descent | Lemmas B.1–B.2 · Thms C.1–C.4 · Lemma D.1 | — | — |

**Inventory:** 10 chapters, about 35 theorems/lemmas/propositions, 22 algorithms, about 35 proof boxes, and about 80 Q&A items at chapter ends (a ready source of conceptual questions). The book has almost no numbered exercises. Practice items are therefore drawn from its Q&A, the lecture examples and S&B's exercises.

### 12.3 Extension modules (S&B-only material, off the core course path)
Bandits (S&B Ch 2) · off-policy MC with importance sampling (§5.5–5.8, also a prerequisite for Zhao §10.3) · eligibility traces and TD(λ) (Ch 7; Zhao mentions them only as further reading) · planning and learning, Dyna, prioritised sweeping (Ch 8) · feature construction (§9.3) · R-learning and average reward (§11.3; links to Zhao's r̄ metric in §9.2) · case studies (Ch 14) · unified view (Ch 15).

### 12.4 What changes from the earlier plan
- **The supplementary track shrinks a lot.** Zhao covers Expected Sarsa, n-step Sarsa, DQN, the PG theorem, REINFORCE, A2C and off-policy AC, and adds DPG. Only regret, Double Q-learning and PPO/TRPO remain supplementary.
- **Mathematics moves up a level.** Matrix-vector Bellman equations \(v_\pi = r_\pi + \gamma P_\pi v_\pi\), the closed form \((I-\gamma P_\pi)^{-1}r_\pi\), ∞-norm contraction, stationary distributions \(d_\pi^T P_\pi = d_\pi^T\), positive-definite matrices, the projected Bellman error, the Poisson equation, and martingale convergence results. The maths support system gains a **linear-algebra track** (matrices, inverses, norms, eigenvalues, positive definiteness) next to the probability track. Appendices A–D become a "Math foundations" section.
- **Default notation is Zhao's:** lowercase samples \(s_t, a_t, r_{t+1}\); vectors \(v_\pi, r_\pi\); matrix \(P_\pi\); behaviour/target policies \(\pi_b, \pi_T\) (Ch 7) and \(\beta\) (Ch 10); TD error \(\delta_t = v_t(s_t) - \bar v_t\). The S&B convention is available through the notation switch and appears in companion content (see §11).
- **The standard environment is Zhao's 5×5 grid world.** This is now a **verified fixture**: forbidden cells (row, col) = (2,2), (2,3), (3,3), (4,2), (4,4), (5,2); target (4,3); actions up/down/left/right/stay; \(r_{boundary}=r_{forbidden}=-1\), \(r_{target}=+1\), otherwise 0; γ = 0.9. Value iteration on this layout reproduces all 25 optimal state values on L7 slide 47 (5.8 … 10.0), so this test will guard the DP code. The repo's Python code uses different defaults (target +10, forbidden −5, step −1). The app will offer both as presets and label which is which.
- **New lab items:**
  - Matrix-vector Bellman solver (closed form vs iterative, with the Box 2.1 convergence shown live).
  - Contraction-mapping demo (‖v_{k+1} − v*‖∞ shrinking by γ).
  - "Factors influencing optimal policies" explorer: vary γ, shift or scale rewards (Thm 3.6), punish detours.
  - VI vs PI vs truncated PI convergence race.
  - MC Basic / MC ES / MC ε-greedy with an episode-length slider.
  - ε-greedy optimality vs exploration (§5.5).
  - Linear FA on the grid world with polynomial/Fourier features (§8.2.4).
  - Stationary-distribution visualiser.
  - Tiny DQN with replay buffer and target network.
  - REINFORCE, QAC and A2C on the grid world.
  - Baseline-variance demo (Box 10.1).
- **New generators:** matrix-form Bellman solutions for 2–4-state MDPs; contraction checks; truncated-PI iterations; MC Basic estimates; RM/SGD steps; TD-Linear weight updates; stationary distributions; softmax policy gradients \(\nabla_\theta \ln\pi\); REINFORCE, QAC and A2C single steps; importance-weighted off-policy AC steps.
- **Learn paths:** "Course path" (Zhao 1 → 10, the default) and "Textbook path" (S&B), plus extension modules.
- **Milestone 4 order:** Zhao Ch 1–3 → 4–6 → 7–8 → 9–10, each with its S&B companions. Extension modules come after.
