// The verifier — spec §11, rules V1–V6.
//
// "These rules are the specification's real content; the organism
// metaphor is commentary until they run." Each rule is pass/fail, and
// a failing rule names why in terms a human can act on.

import { hash, signingHash } from "./canonical.js";
import { checkQuorum, isValidSuccessor, CHANGE_TYPES } from "./authority.js";

const REQUIRED_FIELDS = [
  "authorityRef",
  "organs",
  "runtime",
  "commitments",
  "memoryHead",
  "change",
  "reason",
  "at",
];

/** A record with no predecessor: genesis or rupture (spec §3.2). */
export function isRoot(record) {
  return record.predecessor === null || record.predecessor === undefined;
}

export function verifyRecord(ctx, digest) {
  const { compositions, authorities, anchors, memory, commitments: commitmentSets } = ctx;
  const checks = [];
  const record = compositions.get(digest);

  const fail = (rule, reason) => {
    checks.push({ rule, ok: false, reason });
    return { ok: false, digest, checks };
  };
  const pass = (rule, note) => checks.push({ rule, ok: true, note });

  // ---------------------------------------------------------------- V1
  if (!record) return fail("V1", "record not found");
  if (hash(record) !== digest) return fail("V1", "digest does not match record content");
  if (!anchors.isAnchored(digest)) return fail("V1", "record is not anchored");
  for (const field of REQUIRED_FIELDS) {
    if (record[field] === undefined || record[field] === null) {
      return fail("V1", `missing required field "${field}"`);
    }
  }
  if (!CHANGE_TYPES.includes(record.change)) {
    return fail("V1", `unknown change type "${record.change}"`);
  }
  if (!Array.isArray(record.signatures) || record.signatures.length === 0) {
    return fail("V1", "record carries no signatures");
  }
  pass("V1", "well-formed and anchored");

  // ---------------------------------------------------------------- V2
  const root = isRoot(record);
  let predecessor = null;
  if (root) {
    if (record.priorLineage && !compositions.has(record.priorLineage)) {
      return fail("V2", "priorLineage names a record that is not present");
    }
    pass("V2", record.change === "rupture" ? "rupture: new lineage, prior named as context" : "genesis");
  } else {
    predecessor = compositions.get(record.predecessor);
    if (!predecessor) return fail("V2", "predecessor not found");
    if (!anchors.isAnchored(record.predecessor)) return fail("V2", "predecessor is not anchored");
    pass("V2", `descends from ${record.predecessor.slice(0, 12)}`);
  }

  // ---------------------------------------------------------------- V3
  const authority = authorities.get(record.authorityRef);
  if (!authority) return fail("V3", "authority document not found");
  if (!anchors.isAnchored(record.authorityRef)) return fail("V3", "authority document is not anchored");
  if (authority.effectiveFrom > record.at) {
    return fail("V3", "authority document was not yet effective when this record was made");
  }

  // ★ The succession clause: the authority must be the one in force for
  // the predecessor, or a valid successor of it. Without this a record
  // could mint its own authority and self-grant.
  if (!root) {
    const succession = isValidSuccessor(authorities, record.authorityRef, predecessor.authorityRef);
    if (!succession.ok) return fail("V3", succession.reason);
  }

  const quorum = checkQuorum(
    authority,
    record.change,
    record.signatures,
    signingHash(record),
    record.at
  );
  if (!quorum.ok) return fail("V3", quorum.reason);
  pass("V3", `authorised by ${quorum.accepted.map((a) => a.role).join(" + ")}`);

  // ------------------------------------------------------------- V4/V5
  // Both rules reference the predecessor, which does not exist for a
  // genesis or rupture. For those, the declared initial commitments and
  // memory head satisfy them, subject to V3 (spec §11).
  if (root) {
    pass("V4", "root record: declared initial commitments accepted under V3");
    const walked = memory.chainFrom(record.memoryHead);
    if (!walked.ok) return fail("V5", walked.reason);
    pass("V5", `root record: declared memory head (${walked.chain.length} entries)`);
  } else if (record.change === "restore") {
    // -------------------------------------------------- V4 (restore)
    // Re-centring after drift. The destination must be an ANCESTOR that
    // was already anchored and already authorised — so nothing new can
    // be smuggled in under the name of a restoration.
    const target = compositions.get(record.restoresFrom ?? "");
    if (!target) return fail("V4", "restore names no target, or a target that is not present");

    const line = new Set();
    for (let c = record.predecessor; c; ) {
      line.add(c);
      const r = compositions.get(c);
      if (!r || isRoot(r)) break;
      c = r.predecessor;
    }
    if (!line.has(record.restoresFrom)) {
      return fail("V4", "restore target is not an ancestor of this record — a restoration may only return to where this lineage has actually been");
    }
    if (record.commitments !== target.commitments) {
      return fail("V4", "restored commitments do not match the target exactly — this is an amendment wearing a restoration's name");
    }

    // Reverting an amendment must clear the same bar as making one, or
    // a restore becomes a veto over the quorum that amended it.
    if (record.commitments !== predecessor.commitments) {
      const amendmentBar = checkQuorum(
        authority,
        "commitment-amendment",
        record.signatures,
        signingHash(record),
        record.at
      );
      if (!amendmentBar.ok) {
        return fail("V4", `restoring past a commitment amendment needs the amendment authority: ${amendmentBar.reason}`);
      }
    }
    pass("V4", `restored to ${record.restoresFrom.slice(0, 12)}`);

    const extension = memory.verifyExtension(record.memoryHead, predecessor.memoryHead);
    if (!extension.ok) return fail("V5", extension.reason);
    pass("V5", "memory continues — a restoration re-centres character, never erases history");
  } else {
    // -------------------------------------------------------------- V4
    const changed = record.commitments !== predecessor.commitments;
    if (changed && record.change !== "commitment-amendment") {
      return fail(
        "V4",
        `commitments changed under change type "${record.change}" — only a commitment-amendment may alter them`
      );
    }
    if (!changed && record.change === "commitment-amendment") {
      return fail("V4", "declared a commitment-amendment but commitments are unchanged");
    }
    pass("V4", changed ? "commitments amended under the amendment rule" : "commitments unchanged");

    // -------------------------------------------------------------- V5
    const extension = memory.verifyExtension(record.memoryHead, predecessor.memoryHead);
    if (!extension.ok) return fail("V5", extension.reason);
    pass("V5", `memory extended by ${extension.appended} entr${extension.appended === 1 ? "y" : "ies"}`);
  }

  // ------------------------------------------------------ V4b (pin)
  // If the commitment set is resolvable and pins a conscience organ,
  // the composition must actually be running that evaluator. Otherwise
  // the drift compass could be silently unplugged — probes anchored,
  // nothing left to run them.
  const commitmentSet = commitmentSets?.get(record.commitments) ?? null;
  if (commitmentSet?.conscience) {
    if (record.organs.conscience !== commitmentSet.conscience) {
      return fail(
        "V4",
        "the conscience organ does not match the one pinned in the commitments — the drift compass has been swapped or unplugged, which is a commitment amendment, not an organ swap"
      );
    }
    pass("V4b", "conscience organ matches the one pinned in the commitments");
  }
  if (commitmentSet?.organs) {
    const pinned = commitmentSet.organs;
    const roles = new Set([...Object.keys(pinned), ...Object.keys(record.organs)]);
    for (const role of roles) {
      if (pinned[role] !== record.organs[role]) {
        return fail(
          "V4",
          `frozen baseline: organ "${role}" does not match the composition pinned in the commitments — under a freeze, changing ANY organ is a commitment amendment`
        );
      }
    }
    pass("V4b", "frozen baseline: full organ set matches the pin");
  }
  if (commitmentSet?.runtime && record.runtime !== commitmentSet.runtime) {
    return fail(
      "V4",
      "runtime does not match the configuration pinned in the commitments — a prompt or tool change is a commitment amendment here, not an invisible edit"
    );
  }

  // ---------------------------------------------------------------- V6
  // Siblings are a property of the SET, not of one record: a record with
  // siblings is still valid. V6 exists so nothing may report one sibling
  // as the continuation of another.
  const siblings = root ? [] : compositions.childrenOf(record.predecessor).filter((c) => c.digest !== digest);
  pass(
    "V6",
    siblings.length
      ? `has ${siblings.length} sibling(s) — this branch is one of several continuations, not THE continuation`
      : "sole continuation of its predecessor"
  );

  return { ok: true, digest, checks, siblings: siblings.map((s) => s.digest) };
}

export function verifyLineage(ctx, headDigest) {
  const results = [];
  let cursor = headDigest;
  const seen = new Set();

  while (cursor) {
    if (seen.has(cursor)) {
      results.push({ ok: false, digest: cursor, checks: [{ rule: "V2", ok: false, reason: "cycle in lineage" }] });
      break;
    }
    seen.add(cursor);
    const result = verifyRecord(ctx, cursor);
    results.push(result);
    if (!result.ok) break;
    const record = ctx.compositions.get(cursor);
    cursor = isRoot(record) ? null : record.predecessor;
  }

  return { ok: results.every((r) => r.ok), records: results.reverse() };
}
