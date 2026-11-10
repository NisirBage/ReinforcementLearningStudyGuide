// Tic-tac-toe laboratory (§1.5, Figure 1.1, Exercises 1.1–1.5). The learner of §1.5 against a fixed imperfect opponent,
// judged by the exact probability of winning of its greedy policy against the true optimum; self-play; and minimax
// compared with the best response to the opponent. Computation: lib/rl/envs/tictactoe.ts.
import { useEffect, useMemo, useRef, useState } from "react";
import { makeRng } from "../../domain/random";
import {
  EMPTY, bestMinimaxSafePolicy, evaluatePolicy, learnedPolicyResult, learnerValue, minimaxValues, moves, newLearner, optimalWinProbability, play, playLearningGame, selfPlay,
  worstCaseAgainstPerfect, greedyPolicy, type Board, type OpponentKind, type TttGame, type TttLearner, type TttSettings, type XPolicy,
} from "../../lib/rl/envs/tictactoe";
import { LineChart } from "../../components/LineChart";
import { NumberInput } from "../../components/NumberInput";

const pct = (x: number) => `${(100 * x).toFixed(2)}%`;
const OPPONENTS: Record<OpponentKind, string> = {
  random: "random: any empty square, equally likely",
  defensive: "defensive: wins if it can, blocks if it must, otherwise random",
};

function MiniBoard({ b, label, explore }: { b: Board; label: string; explore?: boolean }) {
  return (
    <table className={`ttt${explore ? " explore" : ""}`} aria-label={label}>
      <tbody>
        {[0, 1, 2].map((r) => (
          <tr key={r}>
            {[0, 1, 2].map((c) => (
              <td key={c}>{b[3 * r + c] === "." ? "" : b[3 * r + c]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Learner() {
  const [kind, setKind] = useState<OpponentKind>("random");
  const [epsilon, setEpsilon] = useState(0.1);
  const [stepRule, setStepRule] = useState<"0.1" | "1/n">("0.1");
  const [symmetries, setSymmetries] = useState(false);
  const [learnFromExploration, setLfe] = useState(false);
  const cfg: TttSettings = useMemo(() => ({ epsilon, alpha: stepRule === "1/n" ? "1/n" : 0.1, symmetries, learnFromExploration }), [epsilon, stepRule, symmetries, learnFromExploration]);
  const L = useRef<TttLearner>(newLearner());
  const rng = useRef(makeRng(1));
  const [games, setGames] = useState(0);
  const [curve, setCurve] = useState<number[]>([]);
  const [last, setLast] = useState<TttGame | null>(null);
  const [busy, setBusy] = useState(false);
  const cancel = useRef(false);
  const reset = () => {
    L.current = newLearner();
    rng.current = makeRng(1);
    setGames(0);
    setCurve([]);
    setLast(null);
  };
  useEffect(reset, [kind, cfg]);
  useEffect(() => () => void (cancel.current = true), []);
  const optimum = useMemo(() => optimalWinProbability(kind), [kind]);
  const train = (n: number) => {
    cancel.current = false;
    setBusy(true);
    let left = n;
    const acc: number[] = [];
    const block = () => {
      if (cancel.current) return setBusy(false);
      const k = Math.min(left, 2000);
      let g: TttGame | null = null;
      for (let i = 0; i < k; i += 100) {
        let wins = 0;
        for (let j = 0; j < 100; j++) if ((g = playLearningGame(L.current, kind, cfg, rng.current)).result === "win") wins++;
        acc.push(wins / 100);
      }
      left -= k;
      setGames((x) => x + k);
      setCurve((c) => [...c, ...acc.splice(0)]);
      setLast(g);
      if (left > 0) setTimeout(block, 0);
      else setBusy(false);
    };
    setTimeout(block, 0);
  };
  const result = useMemo(() => (games ? learnedPolicyResult(L.current, kind, cfg) : null), [games, kind, cfg]);
  const vsPerfect = useMemo(() => (games ? worstCaseAgainstPerfect(greedyPolicy((s) => learnerValue(L.current, s, cfg))) : null), [games, cfg]);
  const firstMoves = useMemo(() => (games ? moves(EMPTY).map((i) => learnerValue(L.current, play(EMPTY, i, "X"), cfg)) : null), [games, cfg]);
  return (
    <section className="card" aria-labelledby="ttt-h">
      <h2 id="ttt-h">The §1.5 player against an imperfect opponent</h2>
      <p className="muted small">
        We play X and move first. Values belong to the positions after our moves: 1 for three Xs in a row, 0 for a loss or a draw, 0.5 to start. Most moves are greedy; with probability ε the
        move is chosen at random among the other moves. After each greedy move the previous position's value moves toward the new one, V(s) ← V(s) + α[V(s′) − V(s)]; exploratory moves cause no
        update. Where the draft leaves details open we chose: when the opponent ends the game, its final position (worth 0) is the last later state; "reducing α properly" is a step size of
        1/n for a position updated for the n-th time. The opponent is fixed and known to the lab (not to the learner), so the true probability of winning of the learned greedy policy, and the best
        possible one, are computed exactly over the game tree.
      </p>
      <div className="inputs">
        <label>
          Opponent{" "}
          <select value={kind} onChange={(e) => setKind(e.target.value as OpponentKind)} disabled={busy}>
            {(Object.keys(OPPONENTS) as OpponentKind[]).map((k) => (
              <option key={k} value={k}>
                {OPPONENTS[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          ε <NumberInput label="exploration rate epsilon" value={epsilon} min={0} max={1} onChange={setEpsilon} />
        </label>
        <label>
          Step size{" "}
          <select value={stepRule} onChange={(e) => setStepRule(e.target.value as "0.1" | "1/n")} disabled={busy}>
            <option value="0.1">α = 0.1</option>
            <option value="1/n">α = 1/n per position</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={symmetries} onChange={(e) => setSymmetries(e.target.checked)} disabled={busy} /> One value per symmetry class (Exercise 1.2)
        </label>
        <label>
          <input type="checkbox" checked={learnFromExploration} onChange={(e) => setLfe(e.target.checked)} disabled={busy} /> Learn from exploratory moves too (Exercise 1.4)
        </label>
      </div>
      <div className="inputs">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => train(2000)}>
          +2,000 games
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => train(20_000)}>
          +20,000 games
        </button>
        <button type="button" className="btn" disabled={busy} onClick={reset}>
          Reset
        </button>
      </div>
      <p role="status" className="muted">
        {busy ? "Playing… " : ""}
        {games} games played.
      </p>
      {curve.length > 0 && (
        <LineChart
          title="Fraction of games won, per block of 100 (exploratory moves included)"
          series={[{ label: "learner", values: curve }]}
          xLabel="Block of 100 games"
          yLabel="wins"
          format={(x) => x.toFixed(2)}
          yMin={0}
          yMax={1}
          reference={{ y: optimum, label: "best possible" }}
        />
      )}
      {result && (
        <table className="lab-table">
          <caption>The learned greedy policy (no exploration), evaluated exactly against this opponent</caption>
          <thead>
            <tr>
              <th scope="col">quantity</th>
              <th scope="col">value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>probability of winning</td>
              <td>{pct(result.win)}</td>
            </tr>
            <tr>
              <td>best possible against this opponent</td>
              <td>{pct(optimum)}</td>
            </tr>
            <tr>
              <td>draw / loss</td>
              <td>
                {pct(result.draw)} / {pct(result.loss)}
              </td>
            </tr>
            <tr>
              <td>against a perfect opponent that knows the policy</td>
              <td>{vsPerfect}</td>
            </tr>
          </tbody>
        </table>
      )}
      {firstMoves && (
        <>
          <h3>Learned values of our first move</h3>
          <table className="ttt values" aria-label="Learned value of each first move">
            <tbody>
              {[0, 1, 2].map((r) => (
                <tr key={r}>
                  {[0, 1, 2].map((c) => (
                    <td key={c}>{firstMoves[3 * r + c].toFixed(3)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {last && (
        <>
          <h3>The last game (as in Figure 1.1)</h3>
          <div className="ttt-row">
            {last.positions.slice(1).map((b, i) => (
              <MiniBoard
                key={i}
                b={b}
                explore={last.exploratory.includes(i + 1)}
                label={`${i % 2 === 0 ? "our" : "opponent's"} move ${Math.floor(i / 2) + 1}${last.exploratory.includes(i + 1) ? " (exploratory)" : ""}`}
              />
            ))}
          </div>
          <p className="muted small">
            Result: {last.result}. Dashed boards follow an exploratory move, which caused no backup; {last.updates} values were updated in this game.
          </p>
        </>
      )}
    </section>
  );
}

function SelfPlay() {
  const [res, setRes] = useState<{ games: number; tally: Record<string, number>; perfect: string; vsRandom: number; perfectTrained: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const go = () => {
    setBusy(true);
    setTimeout(() => {
      const cfg: TttSettings = { epsilon: 0.1, alpha: 0.1 };
      const X = newLearner();
      const O = newLearner();
      const r = selfPlay(X, O, cfg, 50_000, makeRng(1));
      const tally = { win: 0, draw: 0, loss: 0 } as Record<string, number>;
      for (const x of r.slice(-5000)) tally[x]++;
      const pol = greedyPolicy((s) => learnerValue(X, s, cfg));
      const T = newLearner();
      const rng = makeRng(1);
      for (let g = 0; g < 50_000; g++) playLearningGame(T, "random", cfg, rng);
      setRes({ games: r.length, tally, perfect: worstCaseAgainstPerfect(pol), vsRandom: evaluatePolicy(pol, "random").win, perfectTrained: worstCaseAgainstPerfect(greedyPolicy((s) => learnerValue(T, s, cfg))) });
      setBusy(false);
    }, 0);
  };
  return (
    <section className="card" aria-labelledby="sp-h">
      <h2 id="sp-h">Self-play (Exercise 1.1)</h2>
      <p className="muted small">
        Two §1.5 learners (ε = 0.1, α = 0.1), one for each side, play 50,000 games against each other. Each values the positions after its own moves. Then X's greedy policy is tested against a
        perfect opponent and against the random one, beside a learner trained for 50,000 games against the random opponent.
      </p>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={go}>
        {busy ? "Playing…" : "Run self-play"}
      </button>
      {res && (
        <table className="lab-table">
          <caption>Self-play compared with training against the random opponent</caption>
          <thead>
            <tr>
              <th scope="col">quantity</th>
              <th scope="col">value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>last 5,000 self-play games (X win / draw / loss, exploration included)</td>
              <td>
                {res.tally.win} / {res.tally.draw} / {res.tally.loss}
              </td>
            </tr>
            <tr>
              <td>self-play X policy against a perfect opponent</td>
              <td>{res.perfect}</td>
            </tr>
            <tr>
              <td>self-play X policy against the random opponent (probability of winning)</td>
              <td>{pct(res.vsRandom)}</td>
            </tr>
            <tr>
              <td>policy trained against the random opponent, against a perfect opponent</td>
              <td>{res.perfectTrained}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

function Minimax() {
  const rows = useMemo(() => {
    const M = minimaxValues();
    const firstTie: XPolicy = (b) => {
      const ms = moves(b);
      const best = Math.max(...ms.map((i) => M.get(play(b, i, "X"))!));
      return [{ move: ms.find((i) => M.get(play(b, i, "X")) === best)!, p: 1 }];
    };
    return (Object.keys(OPPONENTS) as OpponentKind[]).map((k) => ({
      k,
      opt: optimalWinProbability(k),
      safe: evaluatePolicy(bestMinimaxSafePolicy(k), k).win,
      plain: evaluatePolicy(firstTie, k).win,
    }));
  }, []);
  return (
    <section className="card" aria-labelledby="mm-h">
      <h2 id="mm-h">Minimax against an imperfect opponent</h2>
      <p className="muted small">
        §1.5 says minimax is not the right answer here: it assumes a perfect opponent, so it never moves to a position from which it could lose, even if this opponent would in fact lose from
        there. Below, the probability of winning (exactly computed) of plain minimax (the first of its equally good moves), of the best player that still never risks a loss, and of the best
        response to the opponent.
      </p>
      <table className="lab-table">
        <caption>Probability of winning a game, by opponent</caption>
        <thead>
          <tr>
            <th scope="col">opponent</th>
            <th scope="col">plain minimax</th>
            <th scope="col">best never-risk-a-loss</th>
            <th scope="col">best response</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td>{r.k}</td>
              <td>{pct(r.plain)}</td>
              <td>{pct(r.safe)}</td>
              <td>{pct(r.opt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        Against these two opponents, never risking a loss turns out to cost nothing: the best such player wins as often as the best response. What plain minimax loses comes from its indifference
        among moves that are equally good against a perfect player. The draft's point is one of principle, and these opponents do not happen to illustrate its strongest form.
      </p>
    </section>
  );
}

export function TicTacToeLab() {
  return (
    <>
      <Learner />
      <SelfPlay />
      <Minimax />
    </>
  );
}
