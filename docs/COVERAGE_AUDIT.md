# Milestone 4 coverage audit

Audit of the RL Study Lab against the April 2015 draft of Sutton & Barto, made on 2026-11-05 at commit `d616ae6`, before any Milestone 4 content work. Nothing in the app was changed to produce it.

**How it was measured.** A script walked the source registry (`content/source/sources.json`: every chapter, section, page and exercise) and the draft's text layer page by page. For each section it records:
- the printed and PDF pages;
- the approximate size in words;
- the named examples and figures mentioned in it (a figure is listed wherever the text refers to it, so the same figure can appear under several sections);
- every content item that cites that section: concepts, equations, algorithms, worked examples, figures, labs, questions and lesson layers.

Caveats:
- Word counts are approximate, from the text layer. Every chapter's Summary row also contains the end-of-chapter material (bibliographical remarks and exercises), so those counts overstate the summaries.
- My caption pattern did not find **Example 4.1** (the 4×4 gridworld) or **Example 6.3** (batch updating). *Confirmed in 4A:* both are headed without a colon, and both are in the generated inventory (`content/source/inventory.json`), which records all 36 named examples.

## 1. Summary

**The draft:**
- 15 chapters and 90 sections.
- 3 chapters are title pages only: 10, 12 and 13.
- 4 sections are headings only: 8.8, 15.2, 15.3 and 15.4.
- That leaves **86 written sections** across 12 chapters.
- About **80 numbered equations**, **36 named examples**, about **104 figures** and **85 exercises**. Of the exercises, 9 are programming, 2 are placeholders and 3 are optional.

**The app today:**

| | In the draft | In the app | |
|---|---|---|---|
| Written sections with any content | 86 | 20 | all in Chapters 2–6 |
| Sections with a lesson (explanatory text) | 86 | **2** | §2.3 and §2.4 only |
| Numbered equations | ~80 | 18 | Ch. 2: 10 of 11; Ch. 3: 1 of 17; Ch. 4: 3 of 10; Ch. 5: 0 of 9; Ch. 6: 4 of 6 |
| Named examples as worked-example items | 36 | 1 | Example 4.1; Examples 3.7, 3.8, 4.3, 6.2, 6.5 and 6.6 are reproduced inside labs |
| Exercises incorporated | 85 | **5** | 3.9, 3.10, 3.12, 4.1, 4.2 |
| Core questions | | 48 | Ch. 2: 19, Ch. 3: 7, Ch. 4: 12, Ch. 5: 4, Ch. 6: 6 |
| Algorithms implemented and verified | | 11 | all in Chapters 2–6 |

**Verdict.** What exists is verified: every number is checked by code, every page reference is validated, and there are no overlaps with the source text. But the content is **representative, not complete**, even for Chapters 2–6. No section outside §2.3–2.4 can be studied from the app alone, because the items have no explanatory lessons around them. Chapters 1, 7, 8, 9, 11, 14 and 15 have nothing at all. No chapter can honestly be called covered yet.

## 2. Points in the brief that differ from the source

1. **Chapter titles.** The draft's titles are not the ones in the brief. The app keeps the draft's titles, and the validator enforces them.
   - **Chapter 9** is *On-policy Approximation of Action Values*. It covers prediction (§9.1–9.3) *and* control (§9.4–9.5), not prediction alone.
   - **Chapter 11** is *Policy Approximation*: actor–critic (§11.1–11.2) and R-learning with the average-reward setting (§11.3).
   - **Chapter 14** is *Applications and Case Studies*: six case studies, with no exercises.
   - **Chapter 15** is *Prospects*. Only §15.1 (The Unified View) and §15.5 (Other Frontier Dimensions) have text; §15.2–15.4 are headings only.
2. **Chapter 1 is missing from the brief's order.** It is substantive: about 10,900 words, the tic-tac-toe example and 5 exercises. I propose covering it (see §8).
3. **Unwritten material.** Chapters 10, 12 and 13 and sections 8.8, 15.2, 15.3 and 15.4 are already recorded in `curriculum.emptyInSource` and shown as unwritten. They stay that way, with nothing invented.
4. **Topics and terms from the published 2018 edition stay out of the core.** The brief's stress on "stability and convergence" matters here. The draft's material is the convergence discussion in §9.2–9.3, including the bound (9.9) for linear TD(λ), and the bootstrapping comparison in §9.5. The brief's wording also uses later terms: the draft writes "gradient-descent TD(λ)", not "semi-gradient", and its objective is RMSE, not VE or MSVE. The off-policy instability material of the 2018 edition (deadly triad, gradient-TD, emphatic TD) belongs to the unwritten Chapter 10. It will not be imported into the core.

## 3. Coverage by chapter

Status key:
- **not started**: nothing cites the section.
- **items only, no lesson**: equations, algorithms, questions or labs exist, but no explanatory text.
- **lesson + items (representative)**: a lesson exists, but has not been checked against every learning objective.
- **heading only in draft**: nothing in the source to cover.

A ∗ marks a section the draft itself marks optional.

### Chapter 1: The Reinforcement Learning Problem (pp. 1–26)

| § | Title | Printed pp. (PDF) | Source size | Draft examples · figures | In the app now | Status |
|---|---|---|---|---|---|---|
| 1.1 | Reinforcement Learning | 2–4 (16–18) | ~1520 words | – | nothing | not started |
| 1.2 | Examples | 5–6 (19–20) | ~800 words | – | nothing | not started |
| 1.3 | Elements of Reinforcement Learning | 7–8 (21–22) | ~940 words | – | nothing | not started |
| 1.4 | Limitations and Scope | 9 (23) | ~620 words | – | nothing | not started |
| 1.5 | An Extended Example: Tic-Tac-Toe | 10–14 (24–28) | ~2260 words | Fig. 1.1 | nothing | not started |
| 1.6 | Summary | 15 (29) | ~210 words | – | nothing | not started |
| 1.7 | History of Reinforcement Learning | 16–24 (30–38) | ~4150 words | – | nothing | not started |
| 1.8 | Bibliographical Remarks | 25–26 (39–40) | ~390 words | – | nothing | not started |

**Missing:** everything.
- The chapter is mostly conceptual: the elements of RL, and the scope and limitations.
- The one mathematical development is the tic-tac-toe value update in §1.5, a temporal-difference rule that Chapter 6 picks up again. It could get a small self-play demonstration.
- Exercises 1.1–1.5 are all discussion questions (self-play, symmetries, greedy play, learning from exploration, other improvements). They suit self-marked short answers with rubrics.
- §1.7 (History, about 4,100 words) and §1.8 (Bibliographical Remarks) warrant a reading guide, not a full lesson.

### Chapter 2: Multi-arm Bandits (pp. 31–52)

| § | Title | Printed pp. (PDF) | Source size | Draft examples · figures | In the app now | Status |
|---|---|---|---|---|---|---|
| 2.1 | An n-Armed Bandit Problem | 32 (46) | ~710 words | – | nothing | not started |
| 2.2 | Action-Value Methods | 33–35 (47–49) | ~1090 words | Fig. 2.1 | 3 concepts, 2 equations, 1 algorithm, 5 questions, lab | items only, no lesson |
| 2.3 | Incremental Implementation | 36–37 (50–51) | ~380 words | – | 2 concepts, 2 equations, 1 algorithm, 3 questions, lesson (6 layers) | lesson + items (representative) |
| 2.4 | Tracking a Nonstationary Problem | 38 (52) | ~510 words | – | 3 concepts, 3 equations, 1 algorithm, 8 questions, lesson (4 layers) | lesson + items (representative) |
| 2.5 | Optimistic Initial Values | 39–40 (53–54) | ~800 words | Fig. 2.2 | 1 concept, lab | items only, no lesson |
| 2.6 | Upper-Confidence-Bound Action Selection | 41 (55) | ~630 words | Fig. 2.3 | 1 concept, 1 equation, 1 algorithm, 2 questions, lab | items only, no lesson |
| 2.7 | Gradient Bandits | 42–45 (56–59) | ~1000 words | Fig. 2.4 | 1 concept, 2 equations, 1 algorithm, 2 questions, lab | items only, no lesson |
| 2.8 | Associative Search (Contextual Bandits) | 46 (60) | ~440 words | – | nothing | not started |
| 2.9 | Summary | 47–52 (61–66) | ~1860 words | Fig. 2.1, 2.2, 2.5 | nothing | not started |

**Missing:**
- Lessons for 7 of the 9 sections.
- §2.1 (the problem itself) and §2.8 (associative search) have no content at all. §2.5 has a lab and a concept but no questions.
- Equation (2.11), in the gradient-bandit derivation.
- Figure 2.5 (the parameter study comparing all the methods).
- All six exercises. Exercise 2.4 is a programming exercise (the nonstationary experiment) and maps onto the bandit lab.

**Needs correction:** nothing found wrong. Keep the existing flags: the (2.9) suspected typo, and the baseline that includes R_t.

### Chapter 3: Finite Markov Decision Processes (pp. 53–88)

| § | Title | Printed pp. (PDF) | Source size | Draft examples · figures | In the app now | Status |
|---|---|---|---|---|---|---|
| 3.1 | The Agent–Environment Interface | 53–56 (67–70) | ~1710 words | Ex. 3.1, 3.2, 3.3 · Fig. 3.1 | nothing | not started |
| 3.2 | Goals and Rewards | 57–58 (71–72) | ~810 words | – | nothing | not started |
| 3.3 | Returns | 59–60 (73–74) | ~1080 words | Ex. 3.4 · Fig. 3.2 | 1 concept, 4 questions | items only, no lesson |
| 3.4 | Unified Notation for Episodic and Continuing Tasks | 61 (75) | ~570 words | – | nothing | not started |
| 3.5∗ | The Markov Property | 62–66 (76–80) | ~2170 words | Ex. 3.5, 3.6 | nothing | not started |
| 3.6 | Markov Decision Processes | 67–69 (81–83) | ~960 words | Ex. 3.7 · Fig. 3.3 | 1 concept, lab | items only, no lesson |
| 3.7 | Value Functions | 70–74 (84–88) | ~1480 words | Ex. 3.8, 3.9 · Fig. 3.4, 3.5, 3.6 | 2 concepts, 1 equation, 1 figure, 3 questions, lab | items only, no lesson |
| 3.8 | Optimal Value Functions | 75–78 (89–92) | ~1550 words | Ex. 3.8, 3.10, 3.11, 3.12 · Fig. 3.6, 3.7, 3.8 | nothing | not started |
| 3.9 | Optimality and Approximation | 79 (93) | ~450 words | – | nothing | not started |
| 3.10 | Summary | 80–88 (94–102) | ~2740 words | Fig. 3.4, 3.5, 3.8 | nothing | not started |

**Missing:**
- Lessons for every section.
- 16 of the 17 numbered equations. Only (3.12), the Bellman equation for v_π, is present. Absent are the returns (3.1)–(3.2) and the unified return (3.3) of §3.4, the Markov property (3.4)–(3.5), the MDP quantities (3.6)–(3.9), the remaining value-function equations of §3.7, the definitions of v_* and q_* (3.13)–(3.14), q_* in terms of v_* (3.15), and the Bellman optimality equation for v_* (3.16)–(3.17).
- §3.8 (Optimal Value Functions) is the most important gap in the existing chapters. It has no concept, equation or question, although the DP lab relies on it.
- 12 named examples, none as worked-example items: bioreactor, pick-and-place, recycling robot, pole balancing, draw poker, gridworld, golf, and the Bellman optimality equations for the recycling robot and the gridworld.
- 18 of the 21 exercises. Exercise 3.7 is a placeholder in the draft and will not become a question.

**Needs correction:** none found.

### Chapter 4: Dynamic Programming (pp. 89–112)

| § | Title | Printed pp. (PDF) | Source size | Draft examples · figures | In the app now | Status |
|---|---|---|---|---|---|---|
| 4.1 | Policy Evaluation | 90–93 (104–107) | ~970 words | Ex. 4.1 · Fig. 4.1, 4.2 | 3 concepts, 1 equation, 1 algorithm, 1 worked example, 1 figure, 8 questions | items only, no lesson |
| 4.2 | Policy Improvement | 94–95 (108–109) | ~850 words | Fig. 4.2 | 1 concept, 1 equation, lab | items only, no lesson |
| 4.3 | Policy Iteration | 96–97 (110–111) | ~610 words | Ex. 4.2 · Fig. 4.2, 4.3, 4.4 | 1 concept, 1 algorithm, 2 questions, lab | items only, no lesson |
| 4.4 | Value Iteration | 98–100 (112–114) | ~830 words | Ex. 4.3 · Fig. 4.2, 4.4, 4.5, 4.6 | 1 concept, 1 equation, 1 algorithm, 2 questions, lab | items only, no lesson |
| 4.5 | Asynchronous Dynamic Programming | 101–103 (115–117) | ~640 words | Fig. 4.6 | nothing | not started |
| 4.6 | Generalized Policy Iteration | 104–105 (118–119) | ~1030 words | Fig. 4.7 | nothing | not started |
| 4.7 | Efficiency of Dynamic Programming | 106 (120) | ~430 words | – | nothing | not started |
| 4.8 | Summary | 107–112 (121–126) | ~1750 words | Fig. 4.1, 4.3, 4.6 | nothing | not started |

**Missing:**
- Lessons for every section.
- 7 of the 10 equations, including the policy improvement theorem (4.7)–(4.8) and its derivation: the central proof of the chapter.
- §4.5 (asynchronous DP), §4.6 (generalized policy iteration) and §4.7 (efficiency) have nothing.
- Example 4.2 (Jack's car rental), together with programming Exercise 4.5 and the Figure 4.4 policies: a natural lab with a verifiable fixture.
- 8 of the 10 exercises. Exercise 4.9 is a programming exercise (the gambler's problem with other p_h) and maps onto the DP lab.

**Needs correction:** keep the Figure 4.3 flag (the draft acknowledges the bug) and the Figure 4.2 rounding flag.

### Chapter 5: Monte Carlo Methods (pp. 113–142)

| § | Title | Printed pp. (PDF) | Source size | Draft examples · figures | In the app now | Status |
|---|---|---|---|---|---|---|
| 5.1 | Monte Carlo Prediction | 114–118 (128–132) | ~1760 words | Ex. 5.1, 5.2 · Fig. 5.1, 5.2, 5.3 | 1 concept, 1 algorithm, 2 questions, lab | items only, no lesson |
| 5.2 | Monte Carlo Estimation of Action Values | 119 (133) | ~580 words | – | 1 question | items only, no lesson |
| 5.3 | Monte Carlo Control | 120–123 (134–137) | ~1260 words | Ex. 5.3 · Fig. 5.4, 5.5 | 1 concept, 1 algorithm, 2 questions, lab | items only, no lesson |
| 5.4 | Monte Carlo Control without Exploring Starts | 124–126 (138–140) | ~1120 words | Fig. 5.6 | nothing | not started |
| 5.5 | Off-policy Prediction via Importance Sampling | 127–132 (141–146) | ~1770 words | Ex. 5.1, 5.4, 5.5 · Fig. 5.6, 5.7, 5.8, 5.9 | nothing | not started |
| 5.6 | Incremental Implementation | 133–134 (147–148) | ~760 words | Fig. 5.9, 5.10 | nothing | not started |
| 5.7 | Off-Policy Monte Carlo Control | 135 (149) | ~470 words | Fig. 5.10 | nothing | not started |
| 5.8∗ | Importance Sampling on Truncated Returns | 136–137 (150–151) | ~440 words | – | nothing | not started |
| 5.9 | Summary | 138–142 (152–156) | ~1690 words | Ex. 5.5 · Fig. 5.2, 5.7, 5.8, 5.11 | nothing | not started |

**Missing:**
- Lessons for every section.
- All 9 equations: the greedy policy (5.1), the ε-soft improvement argument (5.2), the importance-sampling ratio (5.3), ordinary and weighted importance sampling (5.4)–(5.5), the incremental weighted average (5.6)–(5.7), and the truncated-return estimators of §5.8∗ (5.8)–(5.9).
- §5.4 (on-policy control without exploring starts), §5.5 (off-policy prediction by importance sampling), §5.6 (incremental implementation), §5.7 (off-policy MC control) and §5.8∗ (truncated returns) have nothing.
- All five examples: blackjack (5.1, 5.3, 5.4), the soap bubble (5.2) and infinite variance (5.5).
- All ten exercises.

**Needs correction:** the Monte Carlo ES lab uses the gridworld, with a 50-step cutoff. The draft's own MC ES example is **blackjack** (Example 5.3, Figure 5.5), where every episode ends (see §5.B).

### Chapter 6: Temporal-Difference Learning (pp. 143–166)

| § | Title | Printed pp. (PDF) | Source size | Draft examples · figures | In the app now | Status |
|---|---|---|---|---|---|---|
| 6.1 | TD Prediction | 143–147 (157–161) | ~1380 words | Ex. 6.1 · Fig. 6.1, 6.2, 6.3, 6.4 | 1 concept, 2 equations, 1 algorithm, 2 questions, lab | items only, no lesson |
| 6.2 | Advantages of TD Prediction Methods | 148–150 (162–164) | ~870 words | Ex. 6.2 · Fig. 6.5, 6.6, 6.7 | lab | items only, no lesson |
| 6.3 | Optimality of TD(0) | 151–153 (165–167) | ~1270 words | Ex. 6.2, 6.3, 6.4 · Fig. 6.7, 6.8 | nothing | not started |
| 6.4 | Sarsa: On-Policy TD Control | 154–156 (168–170) | ~780 words | Ex. 6.5 · Fig. 6.9, 6.10, 6.11 | 1 concept, 1 equation, 1 algorithm, 1 question, lab | items only, no lesson |
| 6.5 | Q-Learning: Off-Policy TD Control | 157–159 (171–173) | ~560 words | Ex. 6.6 · Fig. 6.12, 6.13, 6.14 | 1 concept, 1 equation, 1 algorithm, 3 questions, lab | items only, no lesson |
| 6.6 | Games, Afterstates, and Other Special Cases | 160 (174) | ~580 words | – | nothing | not started |
| 6.7 | Summary | 161–166 (175–180) | ~1780 words | Ex. 6.4 · Fig. 6.6, 6.7 | nothing | not started |

**Missing:**
- Lessons for every section.
- §6.3 (optimality of TD(0): batch updating, Example 6.3, and Example 6.4 "You are the predictor", with the certainty-equivalence argument) and §6.6 (afterstates) have nothing.
- Example 6.1 (driving home).
- All eleven exercises.
- Two equations of the six (the remaining forms in §6.1).

**Needs correction:** the windy-gridworld discrepancy (see §5.A).

### Chapter 7: Eligibility Traces (pp. 167–194)

| § | Title | Printed pp. (PDF) | Source size | Draft examples · figures | In the app now | Status |
|---|---|---|---|---|---|---|
| 7.1 | n-Step TD Prediction | 168–171 (182–185) | ~1540 words | Ex. 7.1 · Fig. 7.1, 7.2 | nothing | not started |
| 7.2 | The Forward View of TD(λ) | 172–176 (186–190) | ~1030 words | Ex. 7.1 · Fig. 7.2, 7.3, 7.4, 7.5, 7.6 | nothing | not started |
| 7.3 | The Backward View of TD(λ) | 177–180 (191–194) | ~1590 words | Ex. 7.1 · Fig. 7.2, 7.6, 7.7, 7.8, 7.9 | nothing | not started |
| 7.4 | Equivalences of Forward and Backward Views | 181–182 (195–196) | ~630 words | Fig. 7.6, 7.10 | nothing | not started |
| 7.5 | Sarsa(λ) | 183–185 (197–199) | ~910 words | Ex. 7.2 · Fig. 7.3, 7.11, 7.12, 7.13 | nothing | not started |
| 7.6 | Watkins's Q(λ) | 186–187 (200–201) | ~850 words | Fig. 7.13, 7.14, 7.15 | nothing | not started |
| 7.7 | Off-policy Eligibility Traces using Importance Sampling | 188 (202) | ~370 words | Fig. 7.15 | nothing | not started |
| 7.8 | Implementation Issues | 189 (203) | ~260 words | – | nothing | not started |
| 7.9∗ | Variable λ | 190 (204) | ~300 words | – | nothing | not started |
| 7.10 | Conclusions | 190–194 (204–208) | ~1210 words | Fig. 7.2, 7.4, 7.14 | nothing | not started |

**Missing:** everything. This is the most mathematical of the remaining chapters.
- **Content:**
  - the n-step return and n-step TD (§7.1, including the error-reduction property);
  - the λ-return and the forward view (§7.2);
  - eligibility traces (accumulating and replacing) and the backward view (§7.3);
  - the offline equivalence of the two views, with its full derivation (§7.4);
  - Sarsa(λ) (§7.5) and Watkins's Q(λ) (§7.6);
  - off-policy traces with importance sampling (§7.7);
  - implementation issues (§7.8);
  - variable λ (§7.9∗, about 300 words; the table's word count for it is a measurement artefact).
- **Algorithms to implement and verify:** n-step TD, offline λ-return, TD(λ) with both kinds of trace, Sarsa(λ) and Watkins's Q(λ).
- **Draft fixtures:** Example 7.1 (n-step methods on the 19-state random walk, Figure 7.2, and the λ-return in Figure 7.6) and Example 7.2 (traces in a gridworld, Figure 7.12).
- **Exact check:** the summed offline backward-view updates equal the forward-view updates, to rounding. This is an identity, so it can be tested exactly.
- 7 exercises; 7.5 is programming and 7.3 optional.

### Chapter 8: Planning and Learning with Tabular Methods (pp. 195–222)

| § | Title | Printed pp. (PDF) | Source size | Draft examples · figures | In the app now | Status |
|---|---|---|---|---|---|---|
| 8.1 | Models and Planning | 195–197 (209–211) | ~1050 words | Fig. 8.1 | nothing | not started |
| 8.2 | Integrating Planning, Acting, and Learning | 198–202 (212–216) | ~1690 words | Ex. 8.1 · Fig. 8.1, 8.2, 8.3, 8.4, 8.5, 8.6 | nothing | not started |
| 8.3 | When the Model Is Wrong | 203–205 (217–219) | ~870 words | Ex. 8.2, 8.3 · Fig. 8.7, 8.8 | nothing | not started |
| 8.4 | Prioritized Sweeping | 206–209 (220–223) | ~1290 words | Ex. 8.4, 8.5 · Fig. 8.4, 8.5, 8.6, 8.9, 8.10, 8.11 | nothing | not started |
| 8.5 | Full vs. Sample Backups | 210–212 (224–226) | ~1080 words | Fig. 8.12, 8.13 | nothing | not started |
| 8.6 | Trajectory Sampling | 213–216 (227–230) | ~1210 words | Fig. 8.14 | nothing | not started |
| 8.7 | Heuristic Search | 217–219 (231–233) | ~1180 words | Fig. 8.15 | nothing | not started |
| 8.8 | Monte Carlo Tree Search | 220 (234) | – | – | nothing | heading only in draft |
| 8.9 | Summary | 220–222 (234–236) | ~880 words | Fig. 8.2, 8.8, 8.10, 8.11, 8.14 | nothing | not started |

**Missing:** everything.
- **Algorithms:** random-sample one-step tabular Q-planning, Dyna-Q (Figure 8.4), Dyna-Q+ (§8.3) and prioritized sweeping (Figure 8.9). Full against sample backups (§8.5) is an analysis with a small computational demonstration; trajectory sampling (§8.6) is an experiment.
- **Draft fixtures:** Examples 8.1 (Dyna maze, Figures 8.5–8.6), 8.2 (blocking maze) and 8.3 (shortcut maze). Example 8.4 (prioritized sweeping on mazes) reports a speed-up of a fixed size. Example 8.5 (rod maneuvering) is described rather than fully specified, so it will be presented, not reproduced.
- Few numbered equations (2), so this chapter is mostly algorithmic and experimental.
- 7 exercises: 8.1 is a placeholder; 8.4 and 8.7 are programming.
- §8.8 (Monte Carlo tree search) is a heading only.

### Chapter 9: On-policy Approximation of Action Values (pp. 225–254)

| § | Title | Printed pp. (PDF) | Source size | Draft examples · figures | In the app now | Status |
|---|---|---|---|---|---|---|
| 9.1 | Value Prediction with Function Approximation | 226–228 (240–242) | ~1460 words | – | nothing | not started |
| 9.2 | Gradient-Descent Methods | 229–231 (243–245) | ~1090 words | Fig. 9.1 | nothing | not started |
| 9.3 | Linear Methods | 232–240 (246–254) | ~3150 words | Ex. 9.1 · Fig. 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7 | nothing | not started |
| 9.4 | Control with Function Approximation | 241–246 (255–260) | ~1590 words | Ex. 9.2 · Fig. 9.5, 9.8, 9.9, 9.10, 9.11 | nothing | not started |
| 9.5 | Should We Bootstrap? | 247–248 (261–262) | ~460 words | Fig. 9.12 | nothing | not started |
| 9.6 | Summary | 249–254 (263–268) | ~1940 words | Fig. 9.2 | nothing | not started |

**Missing:** everything.
- **Content:**
  - the root-mean-squared error objective, **RMSE** (9.1), weighted by the on-policy distribution d(s);
  - gradient-descent methods (§9.2): the general update (9.3), gradient-descent Monte Carlo (which converges to a local optimum, p. 231), and **gradient-descent TD(λ)** (Figure 9.1), with its stated convergence properties;
  - linear methods, with the feature constructions: coarse coding (Example 9.1), tile coding, radial basis functions and Kanerva coding (§9.3);
  - control with linear Sarsa(λ) on mountain car (Example 9.2, Figures 9.8–9.10);
  - the bootstrapping comparison (§9.5, Figure 9.12).
- **Algorithms to implement and verify:** gradient-descent MC, linear gradient-descent TD(λ), tile coding, and linear gradient-descent Sarsa(λ) on mountain car.
- **Notation to keep:** the draft says RMSE and "gradient-descent TD(λ)". The 2018 edition's VE and "semi-gradient" are later terms; they may appear only as flagged, unverified cross-references.
- **Mathematical care needed:**
  - the gradient of the RMSE objective, and why a bootstrapped target makes the TD update depart from true gradient descent (the draft's discussion in §9.2);
  - the convergence of linear TD(λ), with step sizes satisfying (2.7), to a point that is not the RMSE minimum (p. 233);
  - the bound (9.9): the error is at most (1 − γλ)/(1 − γ) times the minimum possible (pp. 233, 249), stated as the draft states it, with its conditions.
- 7 exercises.

### Chapter 10: Off-policy Approximation of Action Values (pp. 255–256)

Title page only in the draft. It stays marked as unwritten in the source, with no content.

### Chapter 11: Policy Approximation (pp. 257–264)

| § | Title | Printed pp. (PDF) | Source size | Draft examples · figures | In the app now | Status |
|---|---|---|---|---|---|---|
| 11.1 | Actor–Critic Methods | 257–258 (271–272) | ~690 words | Fig. 11.1 | nothing | not started |
| 11.2 | Eligibility Traces for Actor–Critic Methods | 259 (273) | ~260 words | – | nothing | not started |
| 11.3 | R-Learning and the Average-Reward Setting | 260–264 (274–278) | ~760 words | Ex. 11.1 · Fig. 11.2, 11.3 | nothing | not started |

**Missing:** everything.
- Actor–critic with the TD error as the critic (§11.1, Figure 11.1, two equations).
- Eligibility traces for actor–critic (§11.2).
- R-learning and the average-reward setting (§11.3), with Example 11.1 (access-control queuing, Figure 11.3) as a verifiable lab fixture.
- 1 exercise (11.1, optional).
- This chapter is short. The policy-gradient theorem and REINFORCE of later editions are **not** in this draft and will not be added to the core.

### Chapters 12 and 13: Psychology, Neuroscience

Title pages only in the draft. They stay marked as unwritten.

### Chapter 14: Applications and Case Studies (pp. 273–302)

| § | Title | Printed pp. (PDF) | Source size | Draft examples · figures | In the app now | Status |
|---|---|---|---|---|---|---|
| 14.1 | TD-Gammon | 273–278 (287–292) | ~2540 words | Fig. 14.1, 14.2 | nothing | not started |
| 14.2 | Samuel's Checkers Player | 279–281 (293–295) | ~1400 words | Fig. 14.3 | nothing | not started |
| 14.3 | The Acrobot | 282–285 (296–299) | ~1150 words | Fig. 14.4, 14.5, 14.6, 14.7 | nothing | not started |
| 14.4 | Elevator Dispatching | 286–290 (300–304) | ~1870 words | Fig. 14.8, 14.9 | nothing | not started |
| 14.5 | Dynamic Channel Allocation | 291–294 (305–308) | ~1700 words | Fig. 14.10 | nothing | not started |
| 14.6 | Job-Shop Scheduling | 295–302 (309–316) | ~2580 words | Fig. 14.11, 14.12 | nothing | not started |

**Missing:** everything.
- Six descriptive case studies with one numbered equation and no exercises.
- **Proposed treatment:** a lesson per case study (problem formulation, state and action representation, reward, learning method, results, and the lessons the draft draws), with conceptual and scenario questions that link back to the methods of Chapters 6–9.
- **No reimplementations:** TD-Gammon, Samuel's checkers, elevators, channel allocation and job-shop are not specified fully enough in the draft to reproduce or verify. The acrobot (§14.3) reuses the mountain-car machinery, so an optional demonstration is possible but not planned.

### Chapter 15: Prospects (pp. 303–310)

| § | Title | Printed pp. (PDF) | Source size | Draft examples · figures | In the app now | Status |
|---|---|---|---|---|---|---|
| 15.1 | The Unified View | 303–305 (317–319) | ~1060 words | Fig. 15.1 | nothing | not started |
| 15.2 | State Estimation | 306 (320) | – | – | nothing | heading only in draft |
| 15.3 | Temporal Abstraction | 306 (320) | – | – | nothing | heading only in draft |
| 15.4 | Predictive Representations | 306 (320) | – | – | nothing | heading only in draft |
| 15.5 | Other Frontier Dimensions | 306–310 (320–324) | ~1080 words | – | nothing | not started |

**Missing:** §15.1 (the two-dimensional view of methods, Figure 15.1) and §15.5 (other frontier dimensions) need short lessons. §15.2–15.4 are headings only.

## 4. Existing content that needs correction or completion

1. **Lessons.** Only §2.3 and §2.4 have lessons. Every other covered section shows items without explanation, so each chapter of 2–6 needs lessons for all its written sections before it can be called covered.
2. **Questions by section.** Several sections with content have no questions: §2.5, §3.6, §4.2 and §6.2. Every not-started section has none.
3. **Exercises.** 5 of 85 are incorporated, and 80 remain, apart from the 2 placeholders.
4. **The equation library** lacks (2.11) and most of Chapters 3–5.
5. **Figures** exist as items for only Figures 3.4 and 4.2. Lab reproductions of Figures 2.1–2.4, 4.6, 6.6, 6.7, 6.11 and 6.13 are not linked from their sections as figures.
6. **Two examples were not found by caption pattern** (4.1 and 6.3). I'll confirm their headings so that every named example is accounted for.
7. **Kept as they are:** the existing flags for the (2.9) typo, the Figure 4.3 bug and the Figure 4.2 rounding; the unverified 2018 cross-references.

## 5. Algorithm verification issues

### A. Windy gridworld (Example 6.5)

**What the draft states (p. 157):**
- Sarsa is run with ε = 0.1, α = 0.5 and Q(s, a) = 0.
- By 8000 time steps the greedy policy "was long since optimal".
- ε-greedy exploration kept the average episode length at about 17 steps, two more than the minimum of 15.

**Measured for this audit:**
- **Exact expected episode length of the ε-greedy (ε = 0.1) policy on the optimal action values: 17.05 steps.** I computed this by solving the policy-evaluation equations exactly, with no sampling. It reproduces the draft's "about 17": the environment, the wind and the definition of ε-greedy agree with the draft.
- Our Sarsa, after 8000 steps (50 seeds): the mean length of the last 20 episodes is **23.5 steps** (range 18.1–31.5). The exact expected length of ε-greedy on the *learned* Q averages 93 steps. That is dominated by states off the main path, whose values are still poor.
- If exploration excluded the greedy action, the length on q_* would be 17.87. So that misreading cannot explain the gap either.

**Conclusion so far:** the gap comes from learning progress at 8000 steps, not from the environment. Either our learner converges more slowly than the draft's run did, or the draft's figure of about 17 describes the policy once the off-path values have also converged.

**To do in 4B:**
- check whether our greedy policy is optimal at 8000 steps for each seed, as the draft says it was;
- measure the episode length as a function of total steps, out to 50,000;
- check tie-breaking (random against first index) and the order of the action set;
- test the generator (`makeRng`) for uniformity and independence across seeds;
- record the result in the lab and D-039, whether or not the gap closes.

### B. Monte Carlo ES cutoff

- **Why the cutoff exists:** Figure 5.4 assumes every episode ends. On the gridworld, a deterministic greedy policy can loop for ever, so 3E cut episodes at 50 steps.
- **Why it changes the algorithm:** 3E averaged the truncated returns as if they were complete, which biases Q downwards for the pairs involved. That is a real departure, not just a speed limit.
- **Proposal:**
  1. Implement **blackjack** exactly as specified in Example 5.1. Make it the Monte Carlo ES problem, reproducing Example 5.3 (the optimal policy and state values of Figure 5.5) with no cutoff, because every blackjack episode ends.
  2. Keep the gridworld as a labelled demonstration of *why* exploring starts needs terminating episodes. Episodes that hit the limit are **discarded and counted**, not averaged.
  3. Test long episodes and looping policies: a policy that only loops makes no updates and is reported, and a long but terminating episode is processed in full.
- Blackjack also provides Examples 5.1 and 5.4 (off-policy estimation of one state's value) for §5.1 and §5.5.

### C. 2018 notation cross-references

These stay as they are: every 2018 mapping carries the `notation-unverified` flag, which the validator already enforces. No equivalence will be claimed without a checked copy of that edition.

### New algorithms (Chapters 7–11)

Each will be verified in two ways:
1. exact hand-computed traces in unit tests;
2. a statistical reproduction of the draft's figure, with tolerances.

Some properties are identities and will be tested exactly: forward/backward equivalence, the linear TD fixed point, and tile-coding feature counts.

## 6. Validator and quality tooling

| Requested check | Today | Plan |
|---|---|---|
| Missing source references | Present: every item must cite its source | Keep |
| Invalid page mappings | Present: PDF = printed + 14, pages inside the chapter, exercise pages, **and** pages inside the cited section's range | *Corrected in 4A:* the section-range check already existed (`schema.ts`, `validateSourceRef`); this audit first listed it as missing |
| Broken concept links | Present for fields | Add: links written inside Markdown text (lessons, solutions) |
| Missing prerequisites | Present for unknown ids and cycles | Add a warning when a lesson uses an item whose concept is not in its prerequisite chain |
| Unreferenced equations | Missing | Add: every equation must be used by a lesson, concept or question; unused ones are listed in the coverage report |
| Worked-example verification | Present: example facts, labs and numeric answers need computed checks | Keep |
| Duplicate questions | Ids only | Add a normalised-stem similarity check |
| Invalid mathematical notation | In tests only (`katex.test`) | Move into `npm run validate` |
| Control characters | One test (added in 3F) | Move into the validator |
| Accidental verbatim copying | `npm run overlap`, 9-word runs, separate | Keep; run per chapter and show the result in the coverage report |
| Core/supplementary contamination | Present | Keep |
| Coverage report per chapter | Missing | New `tools/coverage_report`: this audit's measurement made permanent, writing `docs/coverage/chNN.md`. A chapter counts as covered only when every written section has a lesson, its numbered equations, its examples, its exercises (or a stated reason why not) and questions on each concept |

## 7. Interface and performance

**Already present:**
- chapter and section pages with previous/next links;
- search over sections, concepts, equations and items;
- concept pages with their prerequisite chain and dependents;
- question bookmarks and marks;
- the revision backlog (3F);
- per-chapter content chunks.

**Gaps:**
- **Search loads everything.** The first query fetches every chapter to build the index (`fetchSearchIndex`). That is fine at today's size, where the five chapter chunks total about 160 kB, but full coverage will be many times larger. **Plan:** build a compact search index at build time (titles, keywords, short extracts) as its own chunk, so search never loads chapter bodies.
- **Reading progress:** only the last page visited is stored. **Plan:** record sections read, as an optional addition to the progress format so existing exports still import, and show it in the chapter contents and on Progress.
- **Section bookmarks:** questions only today. **Plan:** bookmarks for sections and items.
- **Honest coverage badges** on chapter and section listings, from the coverage report: covered, partial, not started, or unwritten in the source.
- **Related examples and figures** on section pages, and prerequisite links from lessons to the concept pages.
- **Speed:** a size budget per chapter chunk, checked at build time, and a check that the app shell does not grow with content.

## 8. Proposed plan

Each step ends with validation, tests, a browser review at 375 px and desktop, documentation and a local commit. No chapter starts before the previous one passes.

| Step | Scope |
|---|---|
| **4A** | Tooling only, no bulk content: the coverage report, the validator additions in §6, the build-time search index, the reading-progress and section-bookmark formats, and confirming Examples 4.1 and 6.3 |
| **4B** | Verification: the windy-gridworld investigation, blackjack with Monte Carlo ES (and the gridworld handling above), generator tests |
| **4C–4G** | Completing Chapters 2, 3, 4, 5 and 6 in turn: a lesson for every written section, every numbered equation with symbols, assumptions and steps, every named example, every exercise, questions covering each concept, and the new labs (Jack's car rental, blackjack, batch TD for Example 6.3) |
| **4H** | Chapter 1 (if approved) |
| **4I** | Chapter 7, with n-step, λ-return, TD(λ), Sarsa(λ) and Q(λ) labs and explainers |
| **4J** | Chapter 8, with Dyna-Q, Dyna-Q+ and prioritized sweeping on the draft's mazes |
| **4K** | Chapter 9, with gradient-descent MC, linear gradient-descent TD(λ), tile coding and mountain car |
| **4L** | Chapter 11, with actor–critic and R-learning on the access-control queue |
| **4M** | Chapter 14, as lessons and questions |
| **4N** | Chapter 15, as short lessons; then a final whole-app QA, including offline |

### Decisions for you

1. **Chapter 1:** include it, after Chapter 6 (my recommendation), or leave it out?
2. **Summary, history and bibliographic sections:** short reading guides with a few questions, instead of full lessons? (Recommended.)
3. **Programming exercises** (2.4, 4.5, 4.9, 5.9, 7.5, 8.4, 8.7): present each, reworded, as a guided lab task with the result shown, rather than as a marked question? (Recommended.)
4. **Chapter 14:** lessons and questions only, with no reimplementation of the case studies? (Recommended.)
5. **Monte Carlo ES:** switch to blackjack as described in §5.B? (Recommended.)
6. **Placeholder exercises** 3.7 and 8.1: list them as placeholders in the draft, with no question? (Recommended.)
