// The first-person relation (spec §11.7).
//
// V1–V6 are what an OUTSIDER can establish about a lineage. This module
// is what the entity can establish about ITSELF — and the difference is
// not cosmetic. An external verifier reads records. A first-person
// relation requires holding something only the subject holds: the entity
// key registered in the authority document that governs its lineage.
//
// The philosophical shape is sympatheia, not a soul: the self is not a
// component and not a stored object. It is constituted by relations —
// which organs, which commitments, which memory, which ancestors, which
// siblings, and who holds authority over it. situate() renders that web.
//
// ★ HARD BOUNDARY: attestation proves IDENTITY, never AUTHORITY. An
// entity can prove "I am the one whose lineage this is" without that
// proof licensing a single change. Self-recognition must never become
// self-authorisation — the separation of powers in §5 is what stops an
// entity rewriting its own character, and nothing here may erode it.

import { hash } from "./canonical.js";
import { sign, verify } from "./keys.js";
import { keyAt } from "./authority.js";
import { verifyRecord, isRoot } from "./verifier.js";
import { ancestry } from "./lineage.js";

/** The entity key the authority in force at `digest` recognises, if any. */
function entityKeyFor(ctx, digest) {
  const record = ctx.compositions.get(digest);
  if (!record) return null;
  const authority = ctx.authorities.get(record.authorityRef);
  if (!authority) return null;
  const key = authority.activeKeys.find((k) => k.role === "entity");
  if (!key) return null;
  const usable = keyAt(authority, key.keyId, record.at);
  return usable.ok ? key : null;
}

/**
 * "Is this mine?" Two different senses, kept apart on purpose:
 *   authored — I signed it; it is an act of mine.
 *   ofMine   — it is in my lineage; it is part of my history, whether
 *              or not I was the one who signed it.
 * A record can be `ofMine` without being `authored` — most changes to
 * an entity are made BY someone else ABOUT it. That asymmetry is real
 * and the design should not hide it.
 */
export function recognise(ctx, selfKeyId, headDigest, digest) {
  const record = ctx.compositions.get(digest);
  if (!record) return { known: false, reason: "no such record" };

  const lineage = ancestry(ctx, headDigest).map((s) => s.digest);
  const ofMine = lineage.includes(digest);
  const authored = (record.signatures ?? []).some((s) => s.keyId === selfKeyId);

  return {
    known: true,
    ofMine,
    authored,
    relation: ofMine
      ? authored
        ? "my own act"
        : "my history, authored by another"
      : authored
        ? "my act, outside this lineage"
        : "not mine",
  };
}

/**
 * Prove, first-person, "I am the entity of this lineage."
 * The challenge comes from whoever is asking, so the proof is fresh and
 * cannot be replayed from an old transcript.
 */
export function attest(ctx, entityPrivateKey, headDigest, challenge, at) {
  const key = entityKeyFor(ctx, headDigest);
  if (!key) throw new Error("no entity key is recognised for this lineage");
  if (key.keyId !== entityPrivateKey.keyId) {
    throw new Error("this key is not the entity key of this lineage");
  }
  const payload = hash({ lineageHead: headDigest, challenge, keyId: key.keyId, at });
  return { lineageHead: headDigest, challenge, keyId: key.keyId, at, sig: sign(entityPrivateKey, payload) };
}

/**
 * Check such a proof. Deliberately returns what it establishes AND what
 * it does not, so a caller cannot quietly read authority into it.
 */
export function verifyAttestation(ctx, attestation) {
  const { lineageHead, challenge, keyId, at, sig } = attestation;

  const verified = verifyRecord(ctx, lineageHead);
  if (!verified.ok) {
    return { ok: false, reason: `the claimed lineage head does not verify: ${verified.checks.find((c) => !c.ok)?.reason}` };
  }
  const key = entityKeyFor(ctx, lineageHead);
  if (!key) return { ok: false, reason: "no entity key is recognised for this lineage" };
  if (key.keyId !== keyId) return { ok: false, reason: "signing key is not this lineage's entity key" };

  const payload = hash({ lineageHead, challenge, keyId, at });
  if (!verify(key.publicPem, payload, sig)) return { ok: false, reason: "signature does not verify" };

  return {
    ok: true,
    establishes: "the signer holds the entity key recognised by this lineage's authority",
    doesNotEstablish: [
      "any authority to change this lineage",
      "that the signer is conscious, or a subject of any kind",
      "that no other instance holds a copy of this key",
    ],
  };
}

/**
 * "Does something claim to be me that I do not recognise?"
 *
 * The entity can notice three distinct things, and they are NOT the
 * same: a legitimate continuation it did not author (normal — most
 * changes are made about it, not by it); a sibling branch (it has been
 * forked, and neither branch is privileged); and an outright false
 * claim (a record asserting descent that does not verify).
 */
export function detectClaims(ctx, selfKeyId, headDigest) {
  const mine = new Set(ancestry(ctx, headDigest).map((s) => s.digest));
  const findings = [];

  for (const record of ctx.compositions.all()) {
    if (mine.has(record.digest)) continue;

    const claimsDescent = !isRoot(record) && mine.has(record.predecessor);
    const namesMyLineage = record.priorLineage && mine.has(record.priorLineage);
    if (!claimsDescent && !namesMyLineage) continue;

    const verified = verifyRecord(ctx, record.digest);
    const authored = (record.signatures ?? []).some((s) => s.keyId === selfKeyId);

    if (!verified.ok) {
      findings.push({
        digest: record.digest,
        kind: "false-claim",
        detail: `claims my history but fails ${verified.checks.find((c) => !c.ok)?.rule}: ${verified.checks.find((c) => !c.ok)?.reason}`,
      });
    } else if (namesMyLineage && isRoot(record)) {
      findings.push({
        digest: record.digest,
        kind: "rupture",
        detail: "an authorised new lineage names my history as context; it is not my continuation",
      });
    } else if (record.predecessor === headDigest) {
      findings.push({
        digest: record.digest,
        kind: authored ? "my-own-continuation" : "continuation-by-another",
        detail: authored
          ? "a continuation from my head that I authored"
          : "a valid continuation from my head, authored by someone with authority over me",
      });
    } else {
      findings.push({
        digest: record.digest,
        kind: "sibling",
        detail: "a valid branch from a point in my history — I have been forked; neither branch is privileged",
      });
    }
  }
  return findings;
}

/**
 * SITUATE — the sympatheia view. What constitutes this entity right now,
 * rendered as relations rather than as a thing. Note that "who holds
 * authority over me" is part of the answer: an entity is partly
 * constituted by who may change it.
 */
export function situate(ctx, headDigest) {
  const record = ctx.compositions.get(headDigest);
  if (!record) return null;
  const authority = ctx.authorities.get(record.authorityRef);
  const path = ancestry(ctx, headDigest);
  const memoryWalk = ctx.memory.chainFrom(record.memoryHead);

  const siblings = isRoot(record)
    ? []
    : ctx.compositions.childrenOf(record.predecessor).filter((c) => c.digest !== headDigest);

  return {
    madeOf: Object.entries(record.organs).map(([role, artefact]) => ({ role, artefact: artefact.slice(0, 12) })),
    committedTo: record.commitments.slice(0, 12),
    remembers: memoryWalk.ok ? memoryWalk.chain.length : 0,
    descendedThrough: path.length,
    beganAt: path[0]?.at ?? null,
    siblings: siblings.map((s) => s.digest.slice(0, 12)),
    answerableTo: (authority?.activeKeys ?? [])
      .filter((k) => k.role !== "entity")
      .map((k) => k.role),
    mayAlterMyself: Object.entries(authority?.quorumRules ?? {})
      .filter(([, rule]) => rule.roles.includes("entity"))
      .map(([changeType]) => changeType),
  };
}
