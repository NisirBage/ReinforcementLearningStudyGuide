// Implementations that algorithm entries in content/algorithms/*.json may name. The validator checks every
// `implementation` key against this list, so a pseudocode box can never point at code that does not exist.
import * as bandit from "./bandit";
import * as banditLab from "./banditLab";
import * as recycling from "./envs/recycling";
import * as examples from "./envs/examples";
import * as mc from "./mc";
import * as blackjack from "./envs/blackjack";
import * as td from "./td";
import * as dp from "./dp";
import * as mdp from "./mdp";
import * as sa from "./sa";

export const IMPLEMENTATIONS = {
  "bandit.incrementalAverages": bandit.incrementalAverages,
  "bandit.constantStepEstimates": bandit.constantStepEstimates,
  "bandit.epsilonGreedy": bandit.epsilonGreedy,
  "bandit.ucbSelect": bandit.ucbSelect,
  "mdp.bellmanExpectationBackup": mdp.bellmanExpectationBackup,
  "dp.iterativePolicyEvaluation": dp.iterativePolicyEvaluation,
  "banditLab.agentStep": banditLab.agentStep, // ε-greedy, optimistic, UCB and gradient bandit steps (§2.2–2.7)
  "banditLab.runExperiment": banditLab.runExperiment, // averages over many runs (Figures 2.1–2.4; Exercise 2.4's random walk)
  "banditLab.parameterStudy": banditLab.parameterStudy, // the parameter study of Figure 2.5
  "mdp.solveExact": mdp.solveExact, // v_π by solving (4.4) exactly
  "mdp.backupTerms": mdp.backupTerms, // the terms of (3.12)
  "mdp.expectedReward": mdp.expectedReward, // (3.7)
  "mdp.transitionProb": mdp.transitionProb, // (3.8)
  "envs.recyclingRobot": recycling.recyclingRobot, // Example 3.7, Table 3.1
  "dp.greedyPolicy": dp.greedyPolicy, // policy improvement (4.9)
  "dp.policyIteration": dp.policyIteration, // Figure 4.3
  "dp.valueIteration": dp.valueIteration, // (4.10), Figure 4.5
  "mc.mcUpdate": mc.mcUpdate, // first-/every-visit and constant-α MC (Figure 5.1, 6.1)
  "mc.esEpisode": mc.esEpisode, // Monte Carlo ES (Figure 5.4)
  "mc.runEs": mc.runEs, // many ES episodes in place, equal to repeated esEpisode
  "envs.blackjack": blackjack.blackjack, // Example 5.1, exact infinite-deck model
  "td.td0Update": td.td0Update, // TD(0) (6.2), Figure 6.1
  "td.sarsaStep": td.sarsaStep, // Sarsa (6.5), Figure 6.9
  "td.qLearningStep": td.qLearningStep, // Q-learning (6.6), Figure 6.12
  "envs.gamblersProblem": examples.gamblersProblem, // Example 4.3
  "envs.randomWalk": examples.randomWalk, // Example 6.2
  "envs.windyGridworld": examples.windyGridworld, // Example 6.5
  "envs.cliffWalking": examples.cliffWalking, // Example 6.6
  "sa.robbinsMonro": sa.robbinsMonro, // supplementary (Zhao Ch 6)
} as const;

export const implementationIds = (): Set<string> => new Set(Object.keys(IMPLEMENTATIONS));
