// Authority documents (spec §5).
//
// "Entitled to declare continuity" is only meaningful if entitlement is
// mechanically checkable. Authority is therefore an OBJECT — hashed,
// anchored, and referenced by every composition record.
//
// The security-critical property lives in isValidSuccessor(): an
// authority document may only take effect if it is the one in force for
// the predecessor, or descends from it through validly-signed
// amendments. Without that, a successor could point at a freshly minted
// authority document naming its own author, and authorisation would be
// SELF-GRANTING.
//
// Honest note on the trust root: a genesis authority document has no
// predecessor and is therefore trusted by assertion. Every lineage
// bottoms out in someone's say-so; the design makes that point explicit
// and auditable rather than pretending it away.

import { hash, signingHash } from "./canonical.js";
import { verify } from "./keys.js";

export const CHANGE_TYPES = [
  "genesis",
  "organ-swap",
  "memory-advance",
  "commitment-amendment",
  "rupture",
  "restore",
  "authority-amendment",
];

export class AuthorityStore {
  #docs = new Map(); // digest -> doc

  put(doc) {
    const digest = hash(doc);
    this.#docs.set(digest, doc);
    return digest;
  }

  get(digest) {
    return this.#docs.get(digest) ?? null;
  }

  has(digest) {
    return this.#docs.has(digest);
  }
}

export function createGenesisAuthority({ activeKeys, quorumRules, effectiveFrom }) {
  return {
    predecessor: null,
    activeKeys: activeKeys.map(({ keyId, role, publicPem }) => ({ keyId, role, publicPem })),
    quorumRules,
    revocations: [],
    effectiveFrom,
    signatures: [],
  };
}

/** Is this key usable — present, and not revoked as of `at`? */
export function keyAt(doc, keyId, at) {
  const key = doc.activeKeys.find((k) => k.keyId === keyId);
  if (!key) return { ok: false, reason: `key ${keyId.slice(0, 8)} is not in activeKeys` };
  const revocation = doc.revocations.find((r) => r.keyId === keyId && r.revokedAt <= at);
  if (revocation) return { ok: false, reason: `key ${keyId.slice(0, 8)} was revoked` };
  return { ok: true, key };
}

/**
 * Do these signatures satisfy the quorum rule for this change type?
 * A rule is { threshold, roles }: at least `threshold` DISTINCT keys,
 * each holding one of the permitted roles.
 */
export function checkQuorum(doc, changeType, signatures, payloadHash, at) {
  const rule = doc.quorumRules[changeType];
  if (!rule) return { ok: false, reason: `no quorum rule for change type "${changeType}"` };

  const seen = new Set();
  const accepted = [];
  for (const { keyId, sig } of signatures ?? []) {
    if (seen.has(keyId)) continue; // one key, one vote — never counted twice
    const usable = keyAt(doc, keyId, at);
    if (!usable.ok) continue;
    if (!rule.roles.includes(usable.key.role)) continue;
    if (!verify(usable.key.publicPem, payloadHash, sig)) continue;
    seen.add(keyId);
    accepted.push({ keyId, role: usable.key.role });
  }

  if (accepted.length < rule.threshold) {
    return {
      ok: false,
      reason: `quorum not met for "${changeType}": ${accepted.length} valid of ${rule.threshold} required from roles [${rule.roles.join(", ")}]`,
    };
  }
  return { ok: true, accepted };
}

/**
 * Amend an authority document. The amendment must itself satisfy the
 * PRIOR document's rule for "authority-amendment" — authority cannot
 * bootstrap its own legitimacy.
 */
export function amendAuthority(store, priorDigest, changes, signWith, at, signRecord) {
  const prior = store.get(priorDigest);
  if (!prior) throw new Error("prior authority document not found");

  const draft = {
    predecessor: priorDigest,
    activeKeys: changes.activeKeys ?? prior.activeKeys,
    quorumRules: changes.quorumRules ?? prior.quorumRules,
    revocations: changes.revocations ?? prior.revocations,
    effectiveFrom: at,
  };
  return signRecord(draft, signWith);
}

/**
 * ★ V3's critical clause. Is `candidateDigest` either the same document
 * as `ancestorDigest`, or a valid successor of it — where every step in
 * the chain was signed in satisfaction of ITS predecessor's
 * authority-amendment rule?
 */
export function isValidSuccessor(store, candidateDigest, ancestorDigest) {
  if (candidateDigest === ancestorDigest) return { ok: true, steps: 0 };

  const seen = new Set();
  let cursor = candidateDigest;
  let steps = 0;

  while (cursor) {
    if (seen.has(cursor)) return { ok: false, reason: "cycle in authority chain" };
    seen.add(cursor);

    const doc = store.get(cursor);
    if (!doc) return { ok: false, reason: `authority document ${cursor.slice(0, 12)} not found` };
    if (!doc.predecessor) {
      return {
        ok: false,
        reason:
          "authority document does not descend from the one in force for the predecessor — it is an unrelated root, so its authority would be self-granting",
      };
    }

    const parent = store.get(doc.predecessor);
    if (!parent) return { ok: false, reason: `authority parent ${doc.predecessor.slice(0, 12)} not found` };

    // Each amendment must satisfy its PARENT's rule.
    const quorum = checkQuorum(
      parent,
      "authority-amendment",
      doc.signatures,
      signingHash(doc),
      doc.effectiveFrom
    );
    if (!quorum.ok) {
      return { ok: false, reason: `invalid authority amendment: ${quorum.reason}` };
    }
    if (doc.effectiveFrom < parent.effectiveFrom) {
      return { ok: false, reason: "authority amendment predates the document it amends" };
    }

    steps += 1;
    if (doc.predecessor === ancestorDigest) return { ok: true, steps };
    cursor = doc.predecessor;
  }

  return { ok: false, reason: "authority chain did not reach the document in force for the predecessor" };
}
