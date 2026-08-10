// ★ The holder census — separation of powers vs. its costume.
//
// Owner ruling ⭐ #3 (2026-08-10): all four keys are held by one person,
// and that fact is to be recorded honestly rather than left to be
// inferred from a quorum that passes.
//
// These tests exist because this is the one place in the design where
// EVERY RULE CAN PASS while the impression given is false. Nothing here
// gates a record; a census that reports one holder must still verify.
// What is being tested is whether the system SAYS SO.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { generateKey, signRecord } from "../src/keys.js";
import { signingHash } from "../src/canonical.js";
import {
  createGenesisAuthority,
  holderCensus,
  describeSeparation,
  checkQuorum,
} from "../src/authority.js";
import { verifyRecord } from "../src/verifier.js";
import { buildScenario } from "../src/scenario.js";

const ROLES = ["entity", "controller", "steward", "recovery"];

/** Four roles, four keys, holders assigned by the caller. */
function authorityWith(holderOf) {
  const keys = Object.fromEntries(ROLES.map((role) => [role, generateKey(role)]));
  const doc = createGenesisAuthority({
    activeKeys: ROLES.map((role) => ({
      keyId: keys[role].keyId,
      role,
      publicPem: keys[role].publicPem,
      heldBy: holderOf(role),
    })),
    quorumRules: {
      "organ-swap": { threshold: 2, roles: ["controller", "steward"] },
      "memory-advance": { threshold: 1, roles: ["entity"] },
    },
    effectiveFrom: 0,
  });
  return { doc, keys };
}

describe("holder census", () => {
  test("undeclared is reported as undeclared, never as neutral", () => {
    const { doc } = authorityWith(() => undefined);
    const census = holderCensus(doc);

    assert.equal(census.state, "undeclared");
    assert.equal(census.distinct, null);
    assert.equal(census.soleHolder, null);
    // Silence must not be readable as independence.
    assert.match(describeSeparation(doc), /UNDECLARED/);
    assert.match(describeSeparation(doc), /implies nothing about agreement between PEOPLE/);
  });

  test("★ one person holding every role is named as such", () => {
    const { doc } = authorityWith(() => "shawn");
    const census = holderCensus(doc);

    assert.equal(census.state, "declared");
    assert.equal(census.roles, 4);
    assert.equal(census.distinct, 1);
    assert.equal(census.soleHolder, "shawn");
    assert.deepEqual(census.byHolder.shawn, ["controller", "entity", "recovery", "steward"]);

    const sentence = describeSeparation(doc);
    assert.match(sentence, /ALL held by "shawn"/);
    assert.match(sentence, /one person, every role/i);
    assert.match(sentence, /decorative/);
  });

  test("partial declaration refuses to guess a count", () => {
    const { doc } = authorityWith((role) => (role === "entity" ? "shawn" : undefined));
    const census = holderCensus(doc);

    assert.equal(census.state, "partial");
    assert.equal(census.declaredFor, 1);
    // A count over incomplete data would be the exact false confidence
    // this whole mechanism exists to prevent.
    assert.equal(census.distinct, null);
    assert.match(describeSeparation(doc), /incomplete/);
  });

  test("genuinely separated holders are reported with who holds what", () => {
    const holders = { entity: "the-entity", controller: "alice", steward: "bob", recovery: "carol" };
    const { doc } = authorityWith((role) => holders[role]);
    const census = holderCensus(doc);

    assert.equal(census.distinct, 4);
    assert.equal(census.soleHolder, null);
    assert.match(describeSeparation(doc), /4 declared holder/);
    assert.match(describeSeparation(doc), /alice \(controller\)/);
  });
});

describe("quorum reports holders, and never gates on them", () => {
  const payload = { anything: "signable" };

  test("★ a sole holder still MEETS quorum — the census reports, it does not block", () => {
    const { doc, keys } = authorityWith(() => "shawn");
    const record = signRecord({ ...payload }, [keys.controller, keys.steward]);
    const quorum = checkQuorum(doc, "organ-swap", record.signatures, signingHash(record), 10);

    // The rule is satisfied: two distinct keys, both permitted roles.
    assert.equal(quorum.ok, true);
    assert.equal(quorum.distinctKeys, 2);
    // And the honest reading is attached to it.
    assert.equal(quorum.distinctHolders, 1);
    assert.equal(quorum.independent, false);
  });

  test("two real holders report as independent", () => {
    const holders = { entity: "the-entity", controller: "alice", steward: "bob", recovery: "carol" };
    const { doc, keys } = authorityWith((role) => holders[role]);
    const record = signRecord({ ...payload }, [keys.controller, keys.steward]);
    const quorum = checkQuorum(doc, "organ-swap", record.signatures, signingHash(record), 10);

    assert.equal(quorum.ok, true);
    assert.equal(quorum.distinctHolders, 2);
    assert.equal(quorum.independent, true);
  });

  test("undeclared holders never report as independent", () => {
    const { doc, keys } = authorityWith(() => undefined);
    const record = signRecord({ ...payload }, [keys.controller, keys.steward]);
    const quorum = checkQuorum(doc, "organ-swap", record.signatures, signingHash(record), 10);

    assert.equal(quorum.ok, true);
    assert.equal(quorum.distinctHolders, null);
    // The load-bearing assertion: silence is not evidence of oversight.
    assert.equal(quorum.independent, false);
  });
});

describe("the verifier says it out loud", () => {
  test("★ V3's note qualifies the roles it just listed", () => {
    // The existing scenario declares no holders, which is the state the
    // qualifier exists for: the note lists roles, so it must also say
    // that roles are not people.
    const s = buildScenario();
    const result = verifyRecord(s.ctx, s.refs.swappedRef);
    const v3 = result.checks.find((c) => c.rule === "V3");

    assert.equal(result.ok, true);
    assert.match(v3.note, /authorised by/);
    assert.match(v3.note, /holders undeclared/);
    assert.match(v3.note, /agreement between KEYS/);
  });
});

describe("the claim this mechanism does NOT make", () => {
  test("★ a holder label is a claim, not proof — one person may declare four", () => {
    // The honest limit, asserted so it cannot quietly stop being true:
    // nothing verifies that "alice" and "bob" are different humans. One
    // person with four keys can write four names and the census will
    // report four holders and independent: true.
    const fictitious = { entity: "e", controller: "alice", steward: "bob", recovery: "r" };
    const { doc, keys } = authorityWith((role) => fictitious[role]);
    const record = signRecord({ x: 1 }, [keys.controller, keys.steward]);
    const quorum = checkQuorum(doc, "organ-swap", record.signatures, signingHash(record), 10);

    assert.equal(quorum.independent, true);
    assert.equal(holderCensus(doc).distinct, 4);

    // Declaration converts silence into an explicit lie. That is the
    // whole of the improvement — it is not, and must never be described
    // as, verification of key custody.
  });
});
