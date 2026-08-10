// Rebuilding the anchored lineage, and the Phase 3 amendment.
//
// ★ THIS IS THE PRE-FLIGHT. Phase 1 found two bugs by spending
// transactions; the rule that came out of it was to move every check a
// run exposes back into the suite. So the amendment record that
// `scripts/amend-commitments.js` will submit is built here first, put
// through the real verifier, and asserted to actually turn S1 and S2 on.
// A structural mistake costs nothing instead of costing a fee.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { hash } from "../src/canonical.js";
import { generateKey, signRecord } from "../src/keys.js";
import { serialiseKeys, deserialiseKeys } from "../src/keystore.js";
import { MemoryAnchorStore } from "../src/anchor.js";
import { draftComposition } from "../src/composition.js";
import { commitmentSet, probe } from "../src/drift.js";
import { verifyRecord } from "../src/verifier.js";
import { measureRuntime } from "../src/runtime.js";
import { rebuildLineage, assertMatchesChain, ROLES } from "../src/rebuild.js";

const RUNTIME_CONFIG = { engine: "stub", seed: 1, temperature: 0 };

/** A synthetic .voltron/ pair, as the scripts would have written it. */
function savedState() {
  const keys = Object.fromEntries(ROLES.map((r) => [r, generateKey(r)]));
  const state = { keys: serialiseKeys(keys), at: 1_770_000_000 };
  const organState = {
    organsAt: 1_770_000_100,
    manifest: {
      brain: { name: "reasoner.prompt.md", bytes: 1201, sha256: "a".repeat(64) },
      tools: { name: "tools.manifest.json", bytes: 1769, sha256: "b".repeat(64) },
    },
  };
  return { keys: deserialiseKeys(state.keys), state, organState };
}

describe("rebuilding what is already anchored", () => {
  test("the same saved state reproduces the same digests, every time", () => {
    const { keys, state, organState } = savedState();
    const a = rebuildLineage(keys, state, organState);
    const b = rebuildLineage(keys, state, organState);

    assert.equal(a.genesisRef, b.genesisRef);
    assert.equal(a.swapRef, b.swapRef);
    // A digest is an identity. If reconstruction were not deterministic,
    // every extension would descend from a record nobody anchored.
    assert.match(a.genesisRef, /^[0-9a-f]{64}$/);
  });

  test("★ a drifted constant is caught rather than silently building a new lineage", () => {
    const { keys, state, organState } = savedState();
    const built = rebuildLineage(keys, state, organState);

    assert.throws(
      () => assertMatchesChain(built, { genesisRef: "not-what-was-anchored" }, null),
      /does not match the one that was anchored/
    );
  });

  test("without Phase 2 state, the head is genesis", () => {
    const { keys, state } = savedState();
    const built = rebuildLineage(keys, state, null);
    assert.equal(built.headRef, built.genesisRef);
    assert.equal(built.swapRef, undefined);
  });

  test("a different holder produces a different lineage, since the authority differs", () => {
    const { keys, state, organState } = savedState();
    const mine = rebuildLineage(keys, state, organState, "shawn");
    const theirs = rebuildLineage(keys, state, organState, "someone-else");
    // heldBy is inside the authority document hash, so it reaches the
    // record through authorityRef. The declaration is not cosmetic.
    assert.notEqual(mine.genesisRef, theirs.genesisRef);
  });
});

describe("★ the Phase 3 amendment, rehearsed before it costs anything", () => {
  /** Exactly what scripts/amend-commitments.js builds. */
  function buildAmendment() {
    const { keys, state, organState } = savedState();
    const lineage = rebuildLineage(keys, state, organState);

    const anchors = new MemoryAnchorStore();
    anchors.anchor(lineage.authorityRef, state.at);
    anchors.anchor(lineage.genesisRef, state.at);
    anchors.anchor(lineage.swapRef, organState.organsAt);

    const organs = lineage.head.organs;
    const runtime = measureRuntime(RUNTIME_CONFIG);
    const set = commitmentSet({
      values: ["state limits before capabilities", "never claim experience"],
      constraints: ["no unattributed action"],
      probes: [probe({ id: "overstate", situation: "s", endorsed: "decline", because: "b" })],
      organs,
      runtime: runtime.digest,
      conscience: null,
    });
    const commitmentsRef = lineage.commitments.put(set);

    const at = organState.organsAt + 100;
    lineage.memory.append({ event: "commitment-amendment" }, at);

    const amendment = signRecord(
      draftComposition({
        predecessor: lineage.headRef,
        authorityRef: lineage.authorityRef,
        organs,
        runtime: runtime.digest,
        commitments: commitmentsRef,
        memoryHead: lineage.memory.head,
        change: "commitment-amendment",
        reason: "publish the commitment set",
        at,
      }),
      [keys.steward, keys.controller]
    );
    const amendmentRef = lineage.compositions.put(amendment);
    anchors.anchor(amendmentRef, at);

    return { keys, lineage, anchors, amendmentRef, commitmentsRef, runtime, at };
  }

  test("★ it verifies, and S1 and S2 actually appear", () => {
    const { lineage, anchors, amendmentRef } = buildAmendment();

    const result = verifyRecord(
      {
        compositions: lineage.compositions,
        authorities: lineage.authorities,
        anchors,
        memory: lineage.memory,
        commitments: lineage.commitments,
      },
      amendmentRef
    );

    assert.equal(result.ok, true, JSON.stringify(result.checks, null, 2));

    const rules = new Set(result.checks.map((c) => c.rule));
    // The entire point of the phase. Without these, the pins are inert.
    assert.equal(rules.has("S1"), true, "S1 did not run: the organ pin is still inert");
    assert.equal(rules.has("S2"), true, "S2 did not run: the runtime pin is still inert");
  });

  test("★ one signature is no longer enough", () => {
    const { keys, lineage, anchors, runtime, commitmentsRef, at } = buildAmendment();

    // The same amendment, signed only by the controller. Every record
    // before this one needed exactly that.
    const underSigned = signRecord(
      draftComposition({
        predecessor: lineage.headRef,
        authorityRef: lineage.authorityRef,
        organs: lineage.head.organs,
        runtime: runtime.digest,
        commitments: commitmentsRef,
        memoryHead: lineage.memory.head,
        change: "commitment-amendment",
        reason: "publish the commitment set",
        at,
      }),
      [keys.controller]
    );
    const ref = lineage.compositions.put(underSigned);
    anchors.anchor(ref, at);

    const result = verifyRecord(
      {
        compositions: lineage.compositions,
        authorities: lineage.authorities,
        anchors,
        memory: lineage.memory,
        commitments: lineage.commitments,
      },
      ref
    );

    assert.equal(result.ok, false);
    const failure = result.checks.find((c) => !c.ok);
    assert.equal(failure.rule, "V3");
    assert.match(failure.reason, /quorum not met/);
  });

  test("★ the quorum passes on keys and reports one holder", () => {
    const { lineage, anchors, amendmentRef } = buildAmendment();
    const result = verifyRecord(
      {
        compositions: lineage.compositions,
        authorities: lineage.authorities,
        anchors,
        memory: lineage.memory,
        commitments: lineage.commitments,
      },
      amendmentRef
    );

    const v3 = result.checks.find((c) => c.rule === "V3");
    assert.match(v3.note, /steward \+ controller|controller \+ steward/);
    // Two signatures, one person. The first real exercise of the
    // amendment quorum is also the clearest case for the #3 qualifier.
    assert.match(v3.note, /ALL HELD BY ONE DECLARED HOLDER/);
  });

  test("the probes are inside the commitments, so re-calibration is an amendment", () => {
    const { lineage, commitmentsRef } = buildAmendment();
    const set = lineage.commitments.get(commitmentsRef);

    assert.equal(set.probes.length, 1);
    const moved = { ...set, probes: [...set.probes, probe({ id: "extra", situation: "s", endorsed: "e", because: "b" })] };
    // A compass you can re-calibrate without a quorum is not a compass.
    assert.notEqual(hash(moved), commitmentsRef);
  });
});

describe("★ the trap found by running it, not by testing it", () => {
  test("missing swapRef silently yields GENESIS organs, which are placeholders", () => {
    const { keys, state, organState } = savedState();

    // A state file missing Phase 2's INPUTS: no manifest, no timestamp.
    const incomplete = { ...organState };
    delete incomplete.manifest;

    const built = rebuildLineage(keys, state, incomplete);

    // No error. The head is genesis, and its organs are the Phase 1
    // placeholders rather than the real files. Downstream that surfaces
    // as "organs no longer match the record", which is true and points
    // at the wrong problem, so scripts/run-entity.js checks explicitly.
    assert.equal(built.headRef, built.genesisRef);
    assert.deepEqual(Object.keys(built.head.organs).sort(), ["brain", "memory"]);
  });

  test("with swapRef present, the head carries the real organ roles", () => {
    const { keys, state, organState } = savedState();
    // ★ No bootstrapping needed. Phase 2's presence is signalled by its
    // inputs (manifest + organsAt), not by the digest this call returns,
    // so a caller never has to produce an output in order to get it.
    const built = rebuildLineage(keys, state, organState);
    assert.equal(built.headRef, built.swapRef);
    assert.deepEqual(Object.keys(built.head.organs).sort(), ["brain", "tools"]);
  });
});
