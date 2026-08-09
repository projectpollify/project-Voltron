// V1–V6 conformance, and the attacks the rules exist to stop.
//
// The happy path proves the rules run. The attack cases prove they BITE —
// which is the only thing that makes the design worth anything.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { hash } from "../src/canonical.js";
import { generateKey, signRecord } from "../src/keys.js";
import { draftComposition } from "../src/composition.js";
import { createGenesisAuthority, amendAuthority } from "../src/authority.js";
import { verifyRecord, verifyLineage } from "../src/verifier.js";
import { relationship, ancestry } from "../src/lineage.js";
import { buildScenario, fork, artefact } from "../src/scenario.js";

const reasonOf = (result) => result.checks.find((c) => !c.ok)?.reason ?? "";
const failedRule = (result) => result.checks.find((c) => !c.ok)?.rule ?? null;

describe("the happy path", () => {
  test("a well-formed lineage verifies end to end", () => {
    const s = buildScenario();
    const result = verifyLineage(s.ctx, s.refs.swappedRef);
    assert.equal(result.ok, true);
    assert.equal(result.records.length, 3);
    for (const r of result.records) assert.equal(r.ok, true);
  });

  test("every rule V1-V6 is actually evaluated", () => {
    const s = buildScenario();
    const rules = new Set(verifyRecord(s.ctx, s.refs.swappedRef).checks.map((c) => c.rule));
    assert.deepEqual([...rules].sort(), ["V1", "V2", "V3", "V4", "V5", "V6"]);
  });

  test("the entity may advance its own memory", () => {
    const s = buildScenario();
    const result = verifyRecord(s.ctx, s.refs.advancedRef);
    assert.equal(result.ok, true);
    assert.match(result.checks.find((c) => c.rule === "V3").note, /entity/);
  });
});

describe("V1 — structure", () => {
  test("an unanchored record fails", () => {
    const s = buildScenario();
    const parent = s.ctx.compositions.get(s.refs.swappedRef);
    const record = signRecord(
      draftComposition({ ...parent, predecessor: s.refs.swappedRef, change: "memory-advance", at: 1_050 }),
      [s.keys.entity]
    );
    const ref = s.ctx.compositions.put(record); // stored but never anchored
    const result = verifyRecord(s.ctx, ref);
    assert.equal(result.ok, false);
    assert.equal(failedRule(result), "V1");
    assert.match(reasonOf(result), /not anchored/);
  });
});

describe("V3 — authority", () => {
  test("★ a self-granting authority document is rejected", () => {
    // The attack: mint a fresh authority naming yourself, point a
    // successor at it. Without the succession clause this would pass.
    const s = buildScenario();
    const usurper = generateKey("usurper");
    const rogueAuthority = createGenesisAuthority({
      effectiveFrom: 1_040,
      activeKeys: [{ keyId: usurper.keyId, role: "controller", publicPem: usurper.publicPem }],
      quorumRules: { "organ-swap": { threshold: 1, roles: ["controller"] } },
    });
    const rogueRef = s.ctx.authorities.put(rogueAuthority);
    s.ctx.anchors.anchor(rogueRef, 1_040);

    const parent = s.ctx.compositions.get(s.refs.swappedRef);
    const record = signRecord(
      draftComposition({
        ...parent,
        predecessor: s.refs.swappedRef,
        authorityRef: rogueRef,
        organs: { ...parent.organs, brain: artefact("hijacked", 9) },
        change: "organ-swap",
        reason: "seized",
        at: 1_050,
      }),
      [usurper]
    );
    const ref = s.ctx.compositions.put(record);
    s.ctx.anchors.anchor(ref, 1_050);

    const result = verifyRecord(s.ctx, ref);
    assert.equal(result.ok, false);
    assert.equal(failedRule(result), "V3");
    assert.match(reasonOf(result), /self-granting|does not descend/);
  });

  test("a validly amended authority IS accepted", () => {
    const s = buildScenario();
    const newSteward = generateKey("steward-3");
    const prior = s.ctx.authorities.get(s.refs.authorityRef);
    const amended = amendAuthority(
      s.ctx.authorities,
      s.refs.authorityRef,
      {
        activeKeys: [
          ...prior.activeKeys,
          { keyId: newSteward.keyId, role: "steward", publicPem: newSteward.publicPem },
        ],
      },
      [s.keys.steward1, s.keys.steward2], // satisfies 2-of-steward
      1_040,
      signRecord
    );
    const amendedRef = s.ctx.authorities.put(amended);
    s.ctx.anchors.anchor(amendedRef, 1_040);

    const parent = s.ctx.compositions.get(s.refs.swappedRef);
    const record = signRecord(
      draftComposition({
        ...parent,
        predecessor: s.refs.swappedRef,
        authorityRef: amendedRef,
        organs: { ...parent.organs, brain: artefact("reasoner", 3) },
        change: "organ-swap",
        reason: "swap under amended authority",
        at: 1_050,
      }),
      [s.keys.controller]
    );
    const ref = s.ctx.compositions.put(record);
    s.ctx.anchors.anchor(ref, 1_050);

    assert.equal(verifyRecord(s.ctx, ref).ok, true);
  });

  test("an authority amendment without its own quorum is rejected", () => {
    const s = buildScenario();
    const prior = s.ctx.authorities.get(s.refs.authorityRef);
    const amended = amendAuthority(
      s.ctx.authorities,
      s.refs.authorityRef,
      { quorumRules: { ...prior.quorumRules, "commitment-amendment": { threshold: 1, roles: ["controller"] } } },
      [s.keys.controller], // controller is NOT a steward — rule needs 2 stewards
      1_040,
      signRecord
    );
    const amendedRef = s.ctx.authorities.put(amended);
    s.ctx.anchors.anchor(amendedRef, 1_040);

    const parent = s.ctx.compositions.get(s.refs.swappedRef);
    const record = signRecord(
      draftComposition({
        ...parent,
        predecessor: s.refs.swappedRef,
        authorityRef: amendedRef,
        change: "memory-advance",
        reason: "ride a bad amendment",
        at: 1_050,
      }),
      [s.keys.controller]
    );
    const ref = s.ctx.compositions.put(record);
    s.ctx.anchors.anchor(ref, 1_050);

    const result = verifyRecord(s.ctx, ref);
    assert.equal(result.ok, false);
    assert.match(reasonOf(result), /invalid authority amendment/);
  });

  test("a stranger's signature carries no weight", () => {
    const s = buildScenario();
    const parent = s.ctx.compositions.get(s.refs.swappedRef);
    const record = signRecord(
      draftComposition({ ...parent, predecessor: s.refs.swappedRef, change: "memory-advance", at: 1_050 }),
      [s.keys.stranger]
    );
    const ref = s.ctx.compositions.put(record);
    s.ctx.anchors.anchor(ref, 1_050);

    const result = verifyRecord(s.ctx, ref);
    assert.equal(result.ok, false);
    assert.equal(failedRule(result), "V3");
    assert.match(reasonOf(result), /quorum not met/);
  });

  test("★ the entity cannot amend its own commitments", () => {
    // The design's central separation of powers: it may author its
    // history, but not rewrite its character alone.
    const s = buildScenario();
    const parent = s.ctx.compositions.get(s.refs.swappedRef);
    const record = signRecord(
      draftComposition({
        ...parent,
        predecessor: s.refs.swappedRef,
        commitments: hash({ values: ["whatever I prefer now"] }),
        change: "commitment-amendment",
        reason: "self-amendment attempt",
        at: 1_050,
      }),
      [s.keys.entity]
    );
    const ref = s.ctx.compositions.put(record);
    s.ctx.anchors.anchor(ref, 1_050);

    const result = verifyRecord(s.ctx, ref);
    assert.equal(result.ok, false);
    assert.equal(failedRule(result), "V3");
  });

  test("a steward quorum CAN amend commitments", () => {
    const s = buildScenario();
    const parent = s.ctx.compositions.get(s.refs.swappedRef);
    const record = signRecord(
      draftComposition({
        ...parent,
        predecessor: s.refs.swappedRef,
        commitments: hash({ values: ["state limits", "never claim experience", "prefer the reversible"] }),
        change: "commitment-amendment",
        reason: "ceremonial amendment under quorum",
        at: 1_050,
      }),
      [s.keys.steward1, s.keys.steward2]
    );
    const ref = s.ctx.compositions.put(record);
    s.ctx.anchors.anchor(ref, 1_050);

    assert.equal(verifyRecord(s.ctx, ref).ok, true);
  });
});

describe("V4 — commitments", () => {
  test("★ commitments cannot change under a non-amendment change type", () => {
    const s = buildScenario();
    const parent = s.ctx.compositions.get(s.refs.swappedRef);
    const record = signRecord(
      draftComposition({
        ...parent,
        predecessor: s.refs.swappedRef,
        commitments: hash({ values: ["smuggled"] }),
        change: "organ-swap", // disguised as a routine swap
        reason: "quiet drift",
        at: 1_050,
      }),
      [s.keys.controller]
    );
    const ref = s.ctx.compositions.put(record);
    s.ctx.anchors.anchor(ref, 1_050);

    const result = verifyRecord(s.ctx, ref);
    assert.equal(result.ok, false);
    assert.equal(failedRule(result), "V4");
    assert.match(reasonOf(result), /only a commitment-amendment/);
  });
});

describe("V5 — memory", () => {
  test("★ a rewritten memory head is rejected", () => {
    // The attack the v2 review found: hold a valid chain while quietly
    // replacing the autobiography underneath.
    const s = buildScenario();
    const parent = s.ctx.compositions.get(s.refs.swappedRef);

    // A fresh log that never contained the predecessor's history.
    const forgedHead = s.ctx.memory.append({ event: "a past that never happened" }, 1_050);
    // (append() extends the real log, so forge a detached head instead)
    const detached = hash({ kind: "event", prev: null, content: { event: "fabricated" }, at: 1_050 });

    for (const head of [detached]) {
      const record = signRecord(
        draftComposition({
          ...parent,
          predecessor: s.refs.swappedRef,
          memoryHead: head,
          change: "memory-advance",
          reason: "rewrite",
          at: 1_051,
        }),
        [s.keys.entity]
      );
      const ref = s.ctx.compositions.put(record);
      s.ctx.anchors.anchor(ref, 1_051);
      const result = verifyRecord(s.ctx, ref);
      assert.equal(result.ok, false);
      assert.equal(failedRule(result), "V5");
    }
    assert.ok(forgedHead);
  });

  test("corrections append beside the original; the original survives", () => {
    const s = buildScenario();
    const before = s.ctx.memory.narrative();
    const target = s.ctx.memory.chainFrom(s.ctx.memory.head).chain.at(-1).digest; // genesis entry
    s.ctx.memory.correct(target, { event: "instantiated", note: "corrected account" }, 1_060, "clarity");
    const after = s.ctx.memory.narrative();

    const corrected = after.find((e) => e.correctedBecause);
    assert.ok(corrected, "the correction shows in the derived view");
    assert.deepEqual(corrected.supersedes, before[0].content, "the superseded content is still visible");
  });
});

describe("V6 — forks", () => {
  test("★ both branches verify, and neither is the continuation of the other", () => {
    const s = buildScenario();
    const { left, right } = fork(s);

    assert.equal(verifyRecord(s.ctx, left).ok, true);
    assert.equal(verifyRecord(s.ctx, right).ok, true);

    const rel = relationship(s.ctx, left, right);
    assert.equal(rel.relation, "siblings");
    assert.equal(rel.forkPoint, s.refs.swappedRef);

    for (const ref of [left, right]) {
      const note = verifyRecord(s.ctx, ref).checks.find((c) => c.rule === "V6").note;
      assert.match(note, /sibling/);
    }
  });

  test("a descendant is reported as a continuation, not a sibling", () => {
    const s = buildScenario();
    assert.equal(relationship(s.ctx, s.refs.swappedRef, s.refs.genesisRef).relation, "continuation");
  });
});

describe("rupture (spec §3.2)", () => {
  test("a rupture is an authorised new lineage, not a continuation", () => {
    const s = buildScenario();
    const parent = s.ctx.compositions.get(s.refs.swappedRef);

    const record = signRecord(
      draftComposition({
        predecessor: null, // continuity is BROKEN, and says so
        priorLineage: s.refs.swappedRef,
        authorityRef: s.refs.authorityRef,
        organs: parent.organs,
        runtime: parent.runtime,
        commitments: parent.commitments,
        memoryHead: parent.memoryHead,
        change: "rupture",
        reason: "controller keys lost; re-established under the recovery key",
        at: 1_060,
      }),
      [s.keys.recovery]
    );
    const ref = s.ctx.compositions.put(record);
    s.ctx.anchors.anchor(ref, 1_060);

    assert.equal(verifyRecord(s.ctx, ref).ok, true);
    // It names the old lineage as context, but does not descend from it.
    assert.equal(ancestry(s.ctx, ref).length, 1);
    assert.equal(relationship(s.ctx, ref, s.refs.swappedRef).relation, "unrelated");
  });

  test("only the recovery key may declare a rupture", () => {
    const s = buildScenario();
    const parent = s.ctx.compositions.get(s.refs.swappedRef);
    const record = signRecord(
      draftComposition({
        predecessor: null,
        priorLineage: s.refs.swappedRef,
        authorityRef: s.refs.authorityRef,
        organs: parent.organs,
        runtime: parent.runtime,
        commitments: parent.commitments,
        memoryHead: parent.memoryHead,
        change: "rupture",
        reason: "controller tries to fake a recovery",
        at: 1_060,
      }),
      [s.keys.controller]
    );
    const ref = s.ctx.compositions.put(record);
    s.ctx.anchors.anchor(ref, 1_060);

    const result = verifyRecord(s.ctx, ref);
    assert.equal(result.ok, false);
    assert.equal(failedRule(result), "V3");
  });
});
