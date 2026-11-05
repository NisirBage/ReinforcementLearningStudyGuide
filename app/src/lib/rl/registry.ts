// Implementations that algorithm entries in content/algorithms/*.json may name. The validator checks every
// `implementation` key against this list, so a pseudocode box can never point at code that does not exist.
import * as bandit from "./bandit";
import * as banditLab from "./banditLab";
import * as recycling from "./envs/recycling";
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
  "banditLab.runExperiment": banditLab.runExperiment, // averages over many runs (Figures 2.1–2.4)
  "mdp.solveExact": mdp.solveExact, // v_π by solving (4.4) exactly
  "mdp.backupTerms": mdp.backupTerms, // the terms of (3.12)
  "mdp.expectedReward": mdp.expectedReward, // (3.7)
  "mdp.transitionProb": mdp.transitionProb, // (3.8)
  "envs.recyclingRobot": recycling.recyclingRobot, // Example 3.7, Table 3.1
  "sa.robbinsMonro": sa.robbinsMonro, // supplementary (Zhao Ch 6)
} as const;

export const implementationIds = (): Set<string> => new Set(Object.keys(IMPLEMENTATIONS));
