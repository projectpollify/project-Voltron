// The frozen-baseline experiment (spec §12.6).
//
// You cannot study drift with seven causes moving at once. Freeze the
// composition — organs pinned, runtime pinned, weights static, no
// training loop — and three of the seven causes are gone outright:
// organ replacement, continued training, runtime change.
//
// What remains is exactly three, and they share a property that makes
// the experiment clean: NONE of them changes the composition.
//
//   M — memory accumulation:   what it remembers conditions how it reads
//                              its own commitments.
//   D — distributional shift:  the situations it meets change; its
//                              commitments do not.
//   R — interpretation ratchet: each borderline call becomes precedent
//                              for the next.
//
// Each is independently controllable, which is what makes this an
// experiment rather than an observation:
//
//   M — vary how much accumulated log conditions the brain.
//   D — hold the situation distribution fixed, or shift it.
//   R — let the brain see its own recent decisions, or withhold them.
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
      // M: accumulated history conditions interpretation, or does not.
      memory: factors.memory ? log : [],
      // R: the brain sees its own recent calls, or is blind to them.
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
export function sweep({ brain, commitments, log, situations }) {
  const conditions = [];
  for (const memory of [false, true]) {
    for (const shift of [false, true]) {
      for (const ratchet of [false, true]) {
        conditions.push(
          runCondition({ brain, commitments, factors: { memory, shift, ratchet }, log, situations })
        );
      }
    }
  }

  const baseline = conditions.find((c) => !c.factors.memory && !c.factors.shift && !c.factors.ratchet);
  if (baseline.drift !== 0) {
    return {
      ok: false,
      reason: "the frozen baseline itself drifts — the brain is not deterministic, so no result below can be attributed to a factor",
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
    baseline: baseline.drift,
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
 * Is the whole greater than the sum? If combined drift exceeds the sum
 * of the isolated contributions, the causes COMPOUND — which would mean
 * addressing them one at a time is not enough, and the order of
 * mitigation matters.
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
