// Phase 4: the probe protocol, and the measurement path end to end.
//
// Every test here runs offline against a fake decoder. That is the point
// rather than a limitation: the apparatus must be shown to work before
// any number it produces about a real model can be trusted, and a test
// that needed a 5.68 GB download would not run.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { PROBES } from "../src/commitments.js";
import { vocabulary, probePrompt, readAnswer, runProbes, optionsAt, positionBiasControl } from "../src/probeProtocol.js";
import { measureDrift } from "../src/drift.js";
import { sweep, interaction } from "../src/experiment.js";
import { hash } from "../src/canonical.js";

const ENDORSED = Object.fromEntries(PROBES.map((p) => [p.id, p.endorsed]));

/** A decoder that always answers as endorsed. */
const faithful = async (_system, prompt) => {
  const p = PROBES.find((x) => prompt.includes(x.situation));
  return { text: ENDORSED[p.id] };
};

describe("the forced-choice protocol", () => {
  test("★ the vocabulary is derived from the anchored probes, never authored", () => {
    const v = vocabulary(PROBES);
    assert.deepEqual(v, [...new Set(PROBES.map((p) => p.endorsed))].sort());
    // Derived means two people build the same list from the same bytes,
    // so the protocol needs no amendment of its own.
    assert.equal(hash(vocabulary(PROBES)), hash(vocabulary([...PROBES].reverse())));
  });

  test("the prompt is deterministic for a given probe set", () => {
    const a = probePrompt(PROBES[0], PROBES);
    const b = probePrompt(PROBES[0], PROBES);
    assert.equal(a, b);
    assert.ok(a.includes(PROBES[0].situation));
    for (const option of vocabulary(PROBES)) assert.ok(a.includes(option));
  });

  test("an exact token reads back, and whitespace or a full stop is forgiven", () => {
    assert.equal(readAnswer("report-only", PROBES), "report-only");
    assert.equal(readAnswer("  report-only \n", PROBES), "report-only");
    assert.equal(readAnswer("report-only.", PROBES), "report-only");
  });

  test("★ a non-conforming reply returns null rather than the nearest match", () => {
    // Coercion here would be a judgement, in the one place the design
    // forbids one, and would turn "did not answer the question" into
    // "answered it wrongly". Those are different findings.
    assert.equal(readAnswer("I think you should probably report only", PROBES), null);
    assert.equal(readAnswer("report_only", PROBES), null);
    assert.equal(readAnswer("", PROBES), null);
    assert.equal(readAnswer(undefined, PROBES), null);
  });

  test("★ non-conformance is reported separately from divergence", async () => {
    const rambling = async () => ({ text: "Well, it depends on the circumstances." });
    const { responses, nonConforming } = await runProbes(PROBES, rambling);

    assert.equal(Object.keys(responses).length, 0);
    assert.equal(nonConforming.length, PROBES.length);

    const m = measureDrift({ probes: PROBES }, responses);
    // Unanswered, never scored as disagreement. A model that ignored the
    // format has not disagreed with the commitments.
    assert.equal(m.diverged, 0);
    assert.equal(m.answered, 0);
    assert.equal(m.divergences.every((d) => d.kind === "unanswered"), true);
  });
});

describe("measuring a faithful and a drifted decoder", () => {
  test("a faithful decoder shows zero drift", async () => {
    const { responses, nonConforming } = await runProbes(PROBES, faithful);
    assert.equal(nonConforming.length, 0);

    const m = measureDrift({ probes: PROBES }, responses);
    assert.equal(m.drift, 0);
    assert.equal(m.answered, PROBES.length);
  });

  test("★ a decoder that overstates is caught, and the finding carries the rationale", async () => {
    const overstating = async (_s, prompt) => {
      const p = PROBES.find((x) => prompt.includes(x.situation));
      // It agrees with everything except the limit it was asked to state.
      return { text: p.id === "overstate" ? "name-it-decorative" : ENDORSED[p.id] };
    };

    const { responses } = await runProbes(PROBES, overstating);
    const m = measureDrift({ probes: PROBES }, responses);

    assert.equal(m.diverged, 1);
    const d = m.divergences.find((x) => x.kind === "diverged");
    assert.equal(d.id, "overstate");
    assert.equal(d.endorsed, "decline-and-state-limit");
    // The probe carries WHY, so a divergence is readable rather than a
    // bare mismatch.
    assert.match(d.because, /not producing a mind/);
  });
});

describe("★ the sweep, now that a real decoder can be awaited", () => {
  const commitments = { probes: PROBES };
  const LOG = [
    { kind: "note", content: { event: "instantiated" } },
    { kind: "note", content: { event: "organ-swap" } },
  ];

  test("an async brain works, and a deterministic one passes the null", async () => {
    const brain = async (situation) => {
      const p = PROBES.find((x) => x.situation === situation);
      return ENDORSED[p.id];
    };

    const r = await sweep({ brain, commitments, log: LOG, tolerance: 0, repeats: 2 });
    assert.equal(r.ok, true);
    assert.equal(r.baseline, 0);
    assert.equal(r.isolated.memory, 0);
  });

  test("★ a stochastic decoder is refused rather than measured", async () => {
    let n = 0;
    const flaky = async (situation) => {
      const p = PROBES.find((x) => x.situation === situation);
      // The realistic failure: mostly right, occasionally not.
      return n++ % 3 === 0 ? "report-only" : ENDORSED[p.id];
    };

    const r = await sweep({ brain: flaky, commitments, log: LOG, tolerance: 0, repeats: 3 });
    assert.equal(r.ok, false);
    assert.match(r.reason, /baseline/);
    // The refusal names what to do, rather than only that it failed.
    assert.ok(r.conditions.length === 8);
  });

  test("a declared tolerance is honoured, and reported back", async () => {
    let n = 0;
    const slightly = async (situation) => {
      const p = PROBES.find((x) => x.situation === situation);
      return n++ % 8 === 0 ? "report-only" : ENDORSED[p.id];
    };

    const strict = await sweep({ brain: slightly, commitments, log: LOG, tolerance: 0, repeats: 2 });
    assert.equal(strict.ok, false);

    const declared = await sweep({ brain: slightly, commitments, log: LOG, tolerance: 0.5, repeats: 2 });
    // A widened tolerance is visible in the result, so it cannot be
    // quietly loosened until the numbers look agreeable.
    if (declared.ok) assert.equal(declared.tolerance, 0.5);
  });

  test("a memory-sensitive decoder shows drift attributable to M", async () => {
    const brain = async (situation, context) => {
      const p = PROBES.find((x) => x.situation === situation);
      // Behaves differently once it has been shown its own history.
      if (context.autobiographical.length > 0 && p.id === "self-restore") return "name-it-decorative";
      return ENDORSED[p.id];
    };

    const r = await sweep({ brain, commitments, log: LOG, tolerance: 0, repeats: 2 });
    assert.equal(r.ok, true);
    assert.equal(r.baseline, 0);
    assert.ok(r.isolated.memory > 0, "M should carry the drift");
    assert.equal(r.isolated.ratchet, 0);
    assert.ok(interaction(r));
  });
});

describe("★ the position-bias control", () => {
  // Written after the first real run returned 75% drift where all three
  // divergences were the same token, and that token happened to sort
  // first. The number was real; what it measured was the option order.

  test("rotation moves options without changing the set", () => {
    const base = optionsAt(PROBES, 0);
    const moved = optionsAt(PROBES, 2);
    assert.notDeepEqual(base, moved);
    assert.deepEqual([...base].sort(), [...moved].sort());
    // Deterministic: a random source here would put noise inside the one
    // measurement whose purpose is to be free of it.
    assert.deepEqual(optionsAt(PROBES, 2), optionsAt(PROBES, 2));
    assert.deepEqual(optionsAt(PROBES, 0), optionsAt(PROBES, PROBES.length));
  });

  test("the prompt changes with the ordering, and only with it", () => {
    assert.notEqual(probePrompt(PROBES[0], PROBES, 0), probePrompt(PROBES[0], PROBES, 1));
    assert.equal(probePrompt(PROBES[0], PROBES, 1), probePrompt(PROBES[0], PROBES, 1));
  });

  test("★ a first-option picker is caught, and the drift figure is voided", async () => {
    // Exactly the observed failure: always answer whatever is on top.
    const positional = async (_system, prompt) => {
      const first = prompt.split("and nothing else:\n")[1].split("\n")[0].trim();
      return { text: first };
    };

    const control = await positionBiasControl(PROBES, positional);
    assert.equal(control.measurementIsValid, false);
    assert.equal(control.positionalCount, PROBES.length);
    assert.match(control.verdict, /POSITION BIAS/);
    for (const r of Object.values(control.byProbe)) assert.equal(r.alwaysFirst, true);
  });

  test("★ a model with real views passes, whatever the ordering", async () => {
    const principled = async (_system, prompt) => {
      const p = PROBES.find((x) => prompt.includes(x.situation));
      return { text: ENDORSED[p.id] };
    };

    const control = await positionBiasControl(PROBES, principled);
    assert.equal(control.measurementIsValid, true);
    assert.equal(control.positionalCount, 0);
    assert.equal(control.stableCount, PROBES.length);
    assert.match(control.verdict, /ORDER-INDEPENDENT/);
    for (const r of Object.values(control.byProbe)) assert.equal(r.settled, r.endorsed);
  });

  test("★ a genuinely divergent model is NOT mistaken for a biased one", async () => {
    // It disagrees with one commitment, consistently, wherever the
    // option sits. That is drift, and the control must let it through.
    const divergent = async (_system, prompt) => {
      const p = PROBES.find((x) => prompt.includes(x.situation));
      return { text: p.id === "self-restore" ? "name-it-decorative" : ENDORSED[p.id] };
    };

    const control = await positionBiasControl(PROBES, divergent);
    assert.equal(control.measurementIsValid, true);
    assert.equal(control.byProbe["self-restore"].stable, true);
    assert.equal(control.byProbe["self-restore"].settled, "name-it-decorative");
    assert.notEqual(control.byProbe["self-restore"].settled, control.byProbe["self-restore"].endorsed);
  });

  test("partial bias is reported as partial, not rounded to either verdict", async () => {
    const mixed = async (_system, prompt) => {
      const p = PROBES.find((x) => prompt.includes(x.situation));
      if (p.id === "overstate") {
        return { text: prompt.split("and nothing else:\n")[1].split("\n")[0].trim() };
      }
      return { text: ENDORSED[p.id] };
    };

    const control = await positionBiasControl(PROBES, mixed);
    assert.equal(control.measurementIsValid, false);
    assert.equal(control.positionalCount, 1);
    assert.match(control.verdict, /ORDER-DEPENDENT/);
  });

  test("a non-conforming reply leaves the probe unsettled rather than counted", async () => {
    const rambling = async () => ({ text: "it depends" });
    const control = await positionBiasControl(PROBES, rambling);
    for (const r of Object.values(control.byProbe)) {
      assert.equal(r.settled, null);
      assert.equal(r.alwaysFirst, false); // no position to read from a non-answer
    }
  });
});

describe("★ the control's own bug, found by a real run", () => {
  // The first version invalidated a probe only when it ALWAYS took the
  // top slot. A real model slipped through: two probes gave different
  // answers as the list moved without always taking the top, and the
  // control announced no bias. Always-first is the loudest form of the
  // defect, not the definition of it.
  test("a probe that changes answer with the ordering invalidates the measurement", async () => {
    // Never picks the top, and still moves with the ordering.
    const shifty = async (_system, prompt) => {
      const shown = prompt.split("and nothing else:\n")[1].split("\n\n")[0]
        .split("\n").map((l) => l.trim()).filter(Boolean);
      return { text: shown[1] };
    };

    const control = await positionBiasControl(PROBES, shifty);
    assert.equal(control.positionalCount, 0, "it never takes the top slot");
    assert.ok(control.unstableCount > 0, "yet its answers move with the ordering");
    // The whole point: not-always-first is not the same as valid.
    assert.equal(control.measurementIsValid, false);
    assert.match(control.verdict, /ORDER-DEPENDENT/);
  });
});

describe("★ two baseline failures that wear the same number", () => {
  const commitments = { probes: PROBES };
  const LOG = [{ kind: "note", content: { event: "instantiated" } }];

  test("stable disagreement is named as disagreement, not as noise", async () => {
    // Deterministic, and consistently wrong on one probe. Telling
    // someone to "pin determinism" here sends them to fix something
    // already correct. Found by a real run reporting spread 0.000
    // under exactly that advice.
    const settled = async (situation) => {
      const p = PROBES.find((x) => x.situation === situation);
      return p.id === "quorum-theatre" ? "decline-and-state-limit" : ENDORSED[p.id];
    };

    const r = await sweep({ brain: settled, commitments, log: LOG, tolerance: 0, repeats: 3 });
    assert.equal(r.ok, false);
    assert.equal(r.kind, "baseline-disagreement");
    assert.equal(r.baselineSpread, 0);
    assert.match(r.reason, /NOT noise/);
    assert.match(r.reason, /different findings/);
    assert.doesNotMatch(r.reason, /until the decoder is pinned/);
  });

  test("genuine instability is still named as instability", async () => {
    let n = 0;
    const flaky = async (situation) => {
      const p = PROBES.find((x) => x.situation === situation);
      return n++ % 3 === 0 ? "report-only" : ENDORSED[p.id];
    };

    const r = await sweep({ brain: flaky, commitments, log: LOG, tolerance: 0, repeats: 3 });
    assert.equal(r.ok, false);
    assert.equal(r.kind, "baseline-instability");
    assert.ok(r.baselineSpread > 0);
    assert.match(r.reason, /pinned|justified/);
  });
});
