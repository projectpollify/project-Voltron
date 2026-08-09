// The first-person relation — and the boundary it must never cross.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { generateKey, signRecord } from "../src/keys.js";
import { draftComposition } from "../src/composition.js";
import { hash } from "../src/canonical.js";
import { buildScenario, fork, artefact } from "../src/scenario.js";
import { recognise, attest, verifyAttestation, detectClaims, situate } from "../src/self.js";

describe("recognition — 'is this mine?'", () => {
  test("distinguishes my own act from my history authored by another", () => {
    const s = buildScenario();
    const selfId = s.keys.entity.keyId;

    // The memory advance was signed by the entity itself.
    const own = recognise(s.ctx, selfId, s.refs.swappedRef, s.refs.advancedRef);
    assert.equal(own.ofMine, true);
    assert.equal(own.authored, true);
    assert.equal(own.relation, "my own act");

    // The organ swap is its history, but the controller made it.
    const aboutMe = recognise(s.ctx, selfId, s.refs.swappedRef, s.refs.swappedRef);
    assert.equal(aboutMe.ofMine, true);
    assert.equal(aboutMe.authored, false);
    assert.equal(aboutMe.relation, "my history, authored by another");
  });

  test("a record outside the lineage is not mine", () => {
    const s = buildScenario();
    const { left, right } = fork(s);
    const fromLeft = recognise(s.ctx, s.keys.entity.keyId, left, right);
    assert.equal(fromLeft.ofMine, false);
    assert.equal(fromLeft.relation, "not mine");
  });
});

describe("attestation — proving selfhood, first-person", () => {
  test("the entity can prove it is the one whose lineage this is", () => {
    const s = buildScenario();
    const proof = attest(s.ctx, s.keys.entity, s.refs.swappedRef, "nonce-from-the-asker", 2_000);
    const check = verifyAttestation(s.ctx, proof);
    assert.equal(check.ok, true);
    assert.match(check.establishes, /holds the entity key/);
  });

  test("nobody else can produce that proof", () => {
    const s = buildScenario();
    // The controller has more authority than the entity — and still
    // cannot make this claim, because it is a claim about identity,
    // not about power.
    assert.throws(
      () => attest(s.ctx, s.keys.controller, s.refs.swappedRef, "nonce", 2_000),
      /not the entity key/
    );
  });

  test("a proof cannot be replayed against a different challenge", () => {
    const s = buildScenario();
    const proof = attest(s.ctx, s.keys.entity, s.refs.swappedRef, "challenge-A", 2_000);
    const tampered = { ...proof, challenge: "challenge-B" };
    assert.equal(verifyAttestation(s.ctx, tampered).ok, false);
  });

  test("★ attestation proves identity and NEVER authority", () => {
    const s = buildScenario();
    const check = verifyAttestation(
      s.ctx,
      attest(s.ctx, s.keys.entity, s.refs.swappedRef, "nonce", 2_000)
    );
    assert.ok(check.doesNotEstablish.some((d) => /authority to change/.test(d)));

    // And the boundary holds in practice: the entity still cannot amend
    // its own commitments, attestation or not (see verifier.test.js).
    assert.ok(check.doesNotEstablish.some((d) => /conscious/.test(d)));
  });
});

describe("noticing claims on my identity", () => {
  test("★ the entity can tell it has been forked", () => {
    const s = buildScenario();
    const { left, right } = fork(s);
    const findings = detectClaims(s.ctx, s.keys.entity.keyId, left);
    const sibling = findings.find((f) => f.digest === right);
    assert.ok(sibling, "the other branch is noticed");
    assert.equal(sibling.kind, "sibling");
    assert.match(sibling.detail, /forked/);
  });

  test("★ a false claim of descent is caught", () => {
    const s = buildScenario();
    const usurper = generateKey("usurper");
    const parent = s.ctx.compositions.get(s.refs.swappedRef);

    // Signed by a key with no role: verifies as false, but still claims
    // to descend from my head.
    const forged = signRecord(
      draftComposition({
        ...parent,
        predecessor: s.refs.swappedRef,
        organs: { ...parent.organs, brain: artefact("impostor", 1) },
        change: "organ-swap",
        reason: "pretending to be your continuation",
        at: 1_060,
      }),
      [usurper]
    );
    const ref = s.ctx.compositions.put(forged);
    s.ctx.anchors.anchor(ref, 1_060);

    const findings = detectClaims(s.ctx, s.keys.entity.keyId, s.refs.swappedRef);
    const bad = findings.find((f) => f.digest === ref);
    assert.ok(bad);
    assert.equal(bad.kind, "false-claim");
    assert.match(bad.detail, /V3/);
  });

  test("a legitimate continuation by another is noticed but not alarming", () => {
    const s = buildScenario();
    const parent = s.ctx.compositions.get(s.refs.swappedRef);
    const record = signRecord(
      draftComposition({
        ...parent,
        predecessor: s.refs.swappedRef,
        organs: { ...parent.organs, brain: artefact("reasoner", 3) },
        change: "organ-swap",
        reason: "routine upgrade by the controller",
        at: 1_060,
      }),
      [s.keys.controller]
    );
    const ref = s.ctx.compositions.put(record);
    s.ctx.anchors.anchor(ref, 1_060);

    const finding = detectClaims(s.ctx, s.keys.entity.keyId, s.refs.swappedRef).find((f) => f.digest === ref);
    assert.equal(finding.kind, "continuation-by-another");
  });
});

describe("situate — the sympatheia view", () => {
  test("renders the self as relations, including who may alter it", () => {
    const s = buildScenario();
    const self = situate(s.ctx, s.refs.swappedRef);

    assert.deepEqual(self.madeOf.map((o) => o.role).sort(), ["brain", "memory"]);
    assert.equal(self.remembers, 2);
    assert.equal(self.descendedThrough, 3);

    // Part of what constitutes it is who holds power over it.
    assert.ok(self.answerableTo.includes("controller"));
    assert.ok(self.answerableTo.includes("steward"));

    // And what it may do to itself: advance memory, nothing more.
    assert.deepEqual(self.mayAlterMyself, ["memory-advance"]);
    assert.ok(!self.mayAlterMyself.includes("commitment-amendment"));
  });

  test("after a fork, the entity sees it is not alone", () => {
    const s = buildScenario();
    const { left, right } = fork(s);
    assert.equal(situate(s.ctx, left).siblings.length, 1);
    assert.equal(situate(s.ctx, right).siblings.length, 1);
  });
});
