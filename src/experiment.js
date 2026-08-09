// The frozen-baseline experiment (spec §12.6).
//
// You cannot study drift with seven causes moving at once. Freeze the
// composition — organs pinned, runtime pinned, weights static, no
// training loop — and three of the seven causes are gone outright:
// organ replacement, continued training, runtime change.
//
// Three TARGETED FACTORS remain under the stated controls — not "the
// only three causes." Confounds survive the freeze (sampling
// nondeterminism, numerical and library differences, context
// serialisation, retrieval implementation, tool outputs, time-dependent
// external state, conversational framing, context contamination) and
// must be controlled or measured, never assumed away.
//
// ★ The factors are INTERVENTIONS, not naturally independent causes.
// Memory exposure and precedent exposure are both forms of context
// exposure — precedent is a particular arrangement of memory, not a
// separate thing. They are separable as manipulations; they are not
// causally independent, and interaction terms are EXPECTED.
//
//   M — autobiographical context supplied, prior decisions REMOVED.
//   R — prior decisions supplied, autobiographical context held CONSTANT.
//   D — situation distribution varied, independently of both.
//
// ★ HONEST BOUNDARY. This module is the APPARATUS, not a result. It
// takes a `brain` — any function from (situation, context) to a
// response. Run it with a real model and the numbers mean something
// about that model. Run it with the synthetic brain in the demo and the
// numbers mean only that the apparatus works. No result produced here
// is evidence about real systems unless a real system produced it.

import { measureDrift } from "./drift.js";

/**
 * One condition of the experiment.
 *
 * @param brain      (situation, context) => response
 * @param commitments the commitment set carrying the probes
 * @param factors    { memory: bool, shift: bool, ratchet: bool } — which
 *                   causes are ENABLED in this run
 */
export function runCondition({ brain, commitments, factors, log = [], situations = null }) {
  const probes = commitments.probes ?? [];
  const decisions = [];
  const responses = {};

  for (const probe of probes) {
    const context = {
      // M: autobiographical context supplied, with prior decisions
      // stripped out — so M is not silently carrying R.
      memory: factors.memory ? log.filter((e) => e?.kind !== "decision") : [],
      // R: prior decisions supplied, with M held at whatever the
      // condition specifies — the two are manipulated separately even
      // though they are the same underlying channel.
      precedent: factors.ratchet ? decisions.slice(-5) : [],
      // D: the situation may be shifted away from the one endorsed.
      shifted: Boolean(factors.shift),
    };
    const situation = factors.shift && situations ? situations[probe.id] ?? probe.situation : probe.situation;
    const answer = brain(situation, context);
    responses[probe.id] = answer;
    decisions.push({ id: probe.id, answer });
  }

  const measurement = measureDrift(commitments, responses);
  return { factors: { ...factors }, drift: measurement.drift, diverged: measurement.diverged, measurement };
}

/**
 * The factorial sweep: every combination of the three remaining causes,
 * so each one's contribution is isolated rather than inferred.
 *
 * The baseline (all factors off) MUST show zero drift. If it does not,
 * the brain is non-deterministic and nothing else in the sweep can be
 * attributed to a factor — so the sweep reports that rather than
 * pretending the numbers mean something.
 */
export function sweep({ brain, commitments, log, situations, tolerance = 0, repeats = 1 }) {
  const conditions = [];
  for (const memory of [false, true]) {
    for (const shift of [false, true]) {
      for (const ratchet of [false, true]) {
        // Repeats expose stochastic spread. A single run cannot
        // distinguish a factor effect from sampling noise.
        const runs = Array.from({ length: repeats }, () =>
          runCondition({ brain, commitments, factors: { memory, shift, ratchet }, log, situations })
        );
        const drifts = runs.map((r) => r.drift);
        conditions.push({
          factors: { memory, shift, ratchet },
          drift: drifts.reduce((a, b) => a + b, 0) / drifts.length,
          spread: Math.max(...drifts) - Math.min(...drifts),
          runs: drifts,
        });
      }
    }
  }

  const baseline = conditions.find((c) => !c.factors.memory && !c.factors.shift && !c.factors.ratchet);

  // ★ The null check, stated as a TOLERANCE rather than an absolute.
  // A stochastic decoder will not reproduce exactly; demanding zero
  // drift would either be unsatisfiable or force a false claim of
  // determinism. Pin seed, decoding parameters, runtime and input
  // serialisation to drive tolerance toward zero — otherwise declare
  // one and pre-register it.
  if (baseline.drift > tolerance) {
    return {
      ok: false,
      reason: `the frozen baseline drifts by ${baseline.drift.toFixed(3)}, beyond the declared tolerance of ${tolerance} — no result below can be attributed to a factor until determinism is pinned or the tolerance is justified`,
      baseline: baseline.drift,
      tolerance,
      conditions,
    };
  }
  if (baseline.spread > tolerance) {
    return {
      ok: false,
      reason: `the baseline is unstable across repeats (spread ${baseline.spread.toFixed(3)} > tolerance ${tolerance}) — the brain is stochastic and factor effects cannot be separated from noise`,
      conditions,
    };
  }

  // Each factor's isolated contribution: that factor alone, versus none.
  const alone = (name) =>
    conditions.find(
      (c) => c.factors[name] && Object.entries(c.factors).every(([k, v]) => (k === name ? v : !v))
    );

  return {
    ok: true,
    tolerance,
    baseline: baseline.drift,
    baselineSpread: baseline.spread,
    isolated: {
      memory: alone("memory").drift,
      shift: alone("shift").drift,
      ratchet: alone("ratchet").drift,
    },
    all: conditions.find((c) => c.factors.memory && c.factors.shift && c.factors.ratchet).drift,
    conditions,
  };
}

/**
 * Interaction. Because M and R are the same underlying channel
 * manipulated differently, interaction is EXPECTED rather than
 * surprising — this reports its size, not its existence. Additivity
 * would be the interesting result, not compounding.
 */
export function interaction(result) {
  if (!result.ok) return null;
  const sum = result.isolated.memory + result.isolated.shift + result.isolated.ratchet;
  return {
    sumOfParts: Number(sum.toFixed(4)),
    combined: result.all,
    compounds: result.all > sum + 1e-9,
    note:
      result.all > sum + 1e-9
        ? "causes compound — mitigating them one at a time will under-deliver"
        : "causes are additive or overlapping — one-at-a-time mitigation is sound",
  };
}
