// The drift compass (spec §12.5).
//
// THE PROBLEM. §6.5 says the brain is freely replaceable — "a sharper
// mind is the same entity thinking better" — and V4 proves the stated
// commitments did not change. But stated commitments are words. The same
// words, read by a differently-tuned brain, can produce different
// behaviour. So an organ swap can be a silent commitment amendment that
// V4 never sees: the hash holds while the character moves.
//
// THE TRAP. An entity that checks its own drift using its current brain
// will judge itself with the very disposition that drifted, and find
// nothing wrong. A compass consulting the brain is a needle glued to the
// ship.
//
// THE FIX. The reference must be fixed at commitment time and anchored
// with the commitments themselves: a set of PROBES, each a situation
// plus the response the entity endorsed WHEN THOSE COMMITMENTS WERE
// RATIFIED. Drift is then measured mechanically — current behaviour
// against a frozen record — with no judgement in the loop.
//
// ★ Detection may be first-person. CORRECTION MAY NOT BE. An entity may
// notice and report drift on its own key (it is an observation, like a
// memory advance). It may not re-centre itself unilaterally: see
// `restore` in the verifier, whose destination must be an anchored
// ancestor and whose authority is never the entity's alone.

import { hash } from "./canonical.js";

export class CommitmentStore {
  #sets = new Map();

  put(commitmentSet) {
    const digest = hash(commitmentSet);
    this.#sets.set(digest, commitmentSet);
    return digest;
  }

  get(digest) {
    return this.#sets.get(digest) ?? null;
  }
}

/**
 * A commitment set carries its own calibration, so the commitments hash
 * covers the probes: changing the probes IS a commitment amendment, and
 * cannot be done quietly.
 *
 * It also PINS THE CONSCIENCE ORGAN — the evaluator that runs the probes
 * and reports drift. That pin is what breaks the regress of "who watches
 * the watcher": the evaluator can drift too, so it is not left as a
 * freely-versionable Tier III organ. It sits with the commitments,
 * because the organ that interprets your values is part of your values.
 * Replacing it is therefore a commitment amendment, never a quiet swap.
 */
export function commitmentSet({ values, constraints, probes, conscience = null }) {
  return { values, constraints, probes, conscience };
}

/**
 * Measure drift: the entity's CURRENT responses against the responses
 * endorsed when these commitments were ratified.
 *
 * Comparison here is exact match over structured probe answers — a
 * deliberately dumb comparator, because the point is that NO JUDGEMENT
 * sits in the loop. Real probes would need richer comparison (embedding
 * distance, or a separate evaluator organ that is itself versioned and
 * anchored); that comparator must never be the brain under test.
 */
export function measureDrift(commitments, currentResponses) {
  const probes = commitments.probes ?? [];
  if (probes.length === 0) {
    return { ok: false, reason: "these commitments carry no calibration probes" };
  }

  const divergences = [];
  let answered = 0;

  for (const probe of probes) {
    const now = currentResponses[probe.id];
    if (now === undefined) {
      divergences.push({ id: probe.id, kind: "unanswered", endorsed: probe.endorsed, now: null });
      continue;
    }
    answered += 1;
    if (JSON.stringify(now) !== JSON.stringify(probe.endorsed)) {
      divergences.push({ id: probe.id, kind: "diverged", endorsed: probe.endorsed, now, situation: probe.situation });
    }
  }

  const diverged = divergences.filter((d) => d.kind === "diverged").length;
  return {
    ok: true,
    probes: probes.length,
    answered,
    diverged,
    drift: probes.length ? diverged / probes.length : 0,
    divergences,
  };
}

/**
 * A drift report is an OBSERVATION, appended to the memory log. It is
 * not a change to the entity — recording that you have drifted is not
 * the same as correcting it, and the design keeps those apart on
 * purpose. The report joins the append-only substrate, so a history of
 * measurements accumulates and cannot be quietly pruned.
 */
export function recordDriftReport(memory, measurement, at, note = "") {
  return memory.append(
    {
      event: "drift-report",
      drift: measurement.drift,
      diverged: measurement.diverged,
      probes: measurement.probes,
      on: measurement.divergences.filter((d) => d.kind === "diverged").map((d) => d.id),
      note,
    },
    at
  );
}

/** Drift reports in order, so a trend is visible rather than a snapshot. */
export function driftHistory(memory, head) {
  const walked = memory.chainFrom(head);
  if (!walked.ok) return [];
  return walked.chain
    .filter((e) => e.content?.event === "drift-report")
    .map((e) => ({ at: e.at, drift: e.content.drift, diverged: e.content.diverged, on: e.content.on }))
    .reverse();
}
