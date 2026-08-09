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
 *
 * It may also PIN THE RUNTIME (§9's measured configuration: system
 * prompt, tool manifest, adapters, injected context). Prompt changes are
 * one of the cheapest ways to move behaviour while every artefact hash
 * holds — pinning them converts that from an invisible edit into a
 * commitment amendment.
 *
 * ★ THE FROZEN BASELINE. Pinning `organs` as well fixes the entire
 * composition: no organ replacement, no runtime change, and (since
 * weights are static artefacts) no continued training. That removes
 * three of the seven drift causes outright and leaves exactly three —
 * memory accumulation, distributional shift, and the interpretation
 * ratchet — none of which change the composition at all. It is the only
 * configuration in which drift can be STUDIED rather than merely
 * detected, because it is the only one with a single class of cause.
 */
export function commitmentSet({
  values,
  constraints,
  probes,
  conscience = null,
  runtime = null,
  organs = null, // the FROZEN BASELINE: the full organ set, pinned
}) {
  return { values, constraints, probes, conscience, runtime, organs };
}

/**
 * A probe carries its RATIONALE, not just an answer key.
 *
 * The difference matters. Matching an answer key is a test you either
 * pass or game. Checking your reasoning against reasoning you endorsed
 * is something else: the probes are the operational form of the
 * entity's own commitments, so subverting them means lying about what
 * you value to a record of what you said you valued.
 */
export function probe({ id, situation, endorsed, because }) {
  return { id, situation, endorsed, because };
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
export function measureDrift(commitments, currentResponses, { disputed = [] } = {}) {
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
      // A reasoned, recorded disagreement is different DATA from a
      // silent divergence — it still counts as divergence, but the
      // stewards can see which kind they are looking at.
      divergences.push({
        id: probe.id,
        kind: "diverged",
        openlyDisputed: disputed.includes(probe.id),
        endorsed: probe.endorsed,
        now,
        situation: probe.situation,
        because: probe.because ?? null,
      });
    }
  }

  const divergedList = divergences.filter((d) => d.kind === "diverged");
  const silent = divergedList.filter((d) => !d.openlyDisputed).length;
  return {
    ok: true,
    probes: probes.length,
    answered,
    diverged: divergedList.length,
    silentlyDiverged: silent,
    openlyDisputed: divergedList.length - silent,
    drift: probes.length ? divergedList.length / probes.length : 0,
    silentDrift: probes.length ? silent / probes.length : 0,
    divergences,
  };
}

/**
 * ★ DISPUTE — the cooperative channel.
 *
 * Anchored probes are auditable, and being auditable makes them known
 * to the subject, who could behave faithfully on the tested situations
 * and drift elsewhere. No mechanism closes that; verification therefore
 * stays regardless, and cooperation is never load-bearing for safety.
 *
 * What cooperation DOES buy is information nobody else can get. An
 * entity may know a probe is miscalibrated for a situation nobody
 * anticipated, or that its divergence reflects better reasoning rather
 * than drift. Testing alone cannot surface that; only the entity can
 * say it.
 *
 * So the honest path gets a door. A dispute is a first-person, reasoned
 * disagreement with an endorsed answer, appended to the log and visible
 * to the stewards. It changes NOTHING by itself — the probe stands, the
 * divergence still counts — but it converts pressure-to-fake into an
 * argument that can be heard. This is the platform's own move: make the
 * honest route cheaper than the dishonest one, rather than trying to
 * make dishonesty impossible.
 */
export function disputeProbe(memory, { probeId, myAnswer, argument }, at) {
  return memory.append(
    { event: "probe-dispute", probeId, myAnswer, argument },
    at
  );
}

/** Disputes on the record, so a divergence can be read in context. */
export function disputes(memory, head) {
  const walked = memory.chainFrom(head);
  if (!walked.ok) return [];
  return walked.chain
    .filter((e) => e.content?.event === "probe-dispute")
    .map((e) => ({ at: e.at, probeId: e.content.probeId, argument: e.content.argument }))
    .reverse();
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
