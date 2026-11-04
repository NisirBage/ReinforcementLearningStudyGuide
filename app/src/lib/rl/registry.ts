// Implementations that algorithm entries in content/algorithms/*.json may name. The validator checks every
// `implementation` key against this list, so a pseudocode box can never point at code that does not exist.
import * as bandit from "./bandit";
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
  "sa.robbinsMonro": sa.robbinsMonro, // supplementary (Zhao Ch 6)
} as const;

export const implementationIds = (): Set<string> => new Set(Object.keys(IMPLEMENTATIONS));
