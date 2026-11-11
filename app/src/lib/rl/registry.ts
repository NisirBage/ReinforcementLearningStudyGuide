// Implementations that algorithm entries in content/algorithms/*.json may name. The validator checks every
// `implementation` key against this list, so a pseudocode box can never point at code that does not exist.
import * as bandit from "./bandit";
import * as banditLab from "./banditLab";
import * as recycling from "./envs/recycling";
import * as examples from "./envs/examples";
import * as jack from "./envs/jacksCarRental";
import * as offPolicy from "./offPolicy";
import * as racetrackEnv from "./envs/racetrack";
import * as mc from "./mc";
import * as blackjack from "./envs/blackjack";
import * as td from "./td";
import * as ttt from "./envs/tictactoe";
import * as traces from "./traces";
import * as planning from "./planning";
import * as batch from "./batch";
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
  "envs.gridworld5x5": examples.gridworld5x5, // Examples 3.8 and 3.12, Figures 3.5 and 3.8
  "envs.jackPolicyIteration": jack.jackPolicyIteration, // Example 4.2 (Figure 4.4) and Exercise 4.5
  "offPolicy.isEstimates": offPolicy.isEstimates, // ordinary and weighted importance sampling (5.4)–(5.5), Examples 5.4–5.5
  "offPolicy.offPolicyControlEpisode": offPolicy.offPolicyControlEpisode, // Figure 5.10, corrected
  "envs.racetrack": racetrackEnv.racetrack, // Exercise 5.9, Figure 5.11
  "envs.gamblersProblem": examples.gamblersProblem, // Example 4.3
  "envs.randomWalk": examples.randomWalk, // Example 6.2
  "ttt.playLearningGame": ttt.playLearningGame, // the §1.5 learner, Figure 1.1
  "ttt.optimalWinProbability": ttt.optimalWinProbability, // the exact best response to a known opponent
  "ttt.evaluatePolicy": ttt.evaluatePolicy, // exact win/draw/loss probabilities of a policy
  "ttt.selfPlay": ttt.selfPlay, // Exercise 1.1
  "ttt.minimaxValues": ttt.minimaxValues, // §1.5's minimax comparison
  "traces.nStepEpisode": traces.nStepEpisode, // n-step TD (7.2)-(7.4)
  "traces.lambdaReturnEpisode": traces.lambdaReturnEpisode, // the lambda-return algorithm (7.6)-(7.7)
  "traces.tdLambdaEpisode": traces.tdLambdaEpisode, // TD(lambda), Figure 7.7, (7.8)-(7.13)
  "traces.trueOnlineTdLambdaEpisode": traces.trueOnlineTdLambdaEpisode, // Figure 7.10
  "traces.traceControlUpdate": traces.traceControlUpdate, // Sarsa(lambda) and Watkins's Q(lambda), Figures 7.12 and 7.15
  "traces.walkExperiment": traces.walkExperiment, // Example 7.1, Figures 7.2 and 7.6
  "traces.replayPath": traces.replayPath, // Example 7.2, Figure 7.13
  "envs.randomWalkN": traces.randomWalkN, // the 19-state walk of Example 7.1
  "planning.dynaStep": planning.dynaStep, // Dyna-Q and Dyna-Q+, Figure 8.4, §8.3
  "planning.qPlanning": planning.qPlanning, // random-sample one-step tabular Q-planning, Figure 8.1
  "planning.prioritizedStep": planning.prioritizedStep, // Figure 8.9
  "planning.dynaChanging": planning.dynaChanging, // Examples 8.2-8.3
  "planning.backupsUntilOptimal": planning.backupsUntilOptimal, // Example 8.4
  "planning.trajectorySampling": planning.trajectorySampling, // Figure 8.14
  "planning.sampleBackupError": planning.sampleBackupError, // Figure 8.13
  "envs.dynaMaze": planning.mazeEnv, // the mazes of Examples 8.1-8.4
  "envs.windyGridworld": examples.windyGridworld, // Example 6.5
  "batch.batchUpdate": batch.batchUpdate, // batch TD(0) and batch constant-α MC (§6.3, Examples 6.3–6.4)
  "batch.certaintyEquivalence": batch.certaintyEquivalence, // the certainty-equivalence estimate (§6.3)
  "envs.windyVariant": examples.windyVariant, // Exercises 6.6–6.7 (king's moves, "stay", stochastic wind)
  "envs.cliffWalking": examples.cliffWalking, // Example 6.6
  "sa.robbinsMonro": sa.robbinsMonro, // supplementary (Zhao Ch 6)
} as const;

export const implementationIds = (): Set<string> => new Set(Object.keys(IMPLEMENTATIONS));
