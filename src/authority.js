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
//
// ★ THE SECOND HONEST NOTE — separation of powers vs. its appearance
// (owner ruling, 2026-08-10, ⭐ #3).
//
// checkQuorum counts DISTINCT KEYS. It cannot count distinct people,
// because keys are what a cryptosystem can see. So a document in which
// one human holds the entity, controller, steward and recovery keys
// satisfies a three-of-four quorum perfectly, and the verifier reports
// "authorised by entity + controller + steward" — which READS as three
// parties agreeing and is one person signing three times.
//
// Nothing here is broken: the quorum rule does exactly what it says.
// The defect is in what a reader infers. This is the one place in the
// design where every rule can pass while the impression is false.
//
// The fix is not cryptographic — it cannot be, since key custody is a
// fact about the world. The fix is DECLARATION: each key may name its
// holder, and holderCensus() reports how many distinct holders there
// actually are, so oversight and its costume can be told apart without
// comparing keys by hand.
//
// Declaration is unverifiable by construction — a holder label is a
// claim, and one person may declare four fictitious holders. It is
// therefore evidence about intent, never proof of independence. Its
// value is that the honest case becomes legible and the dishonest case
// requires an explicit lie rather than mere silence.

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
    // `heldBy` is optional and, when present, covered by the document
    // hash — so a holder claim cannot be added or altered after the fact
    // without amending the authority. Absent, it is simply undeclared;
    // canonicalise() drops undefined, so silence changes no digest.
    activeKeys: activeKeys.map(({ keyId, role, publicPem, heldBy }) => ({
      keyId,
      role,
      publicPem,
      heldBy,
    })),
    quorumRules,
    revocations: [],
    effectiveFrom,
    signatures: [],
  };
}

/**
 * ★ HOLDER CENSUS — who actually holds the keys, as declared.
 *
 * Reports the gap between how many ROLES exist and how many PEOPLE hold
 * them. Three states, and the difference between them matters:
 *
 *   undeclared  — no key names a holder. The document says nothing, so
 *                 a reader must assume nothing. This is the state that
 *                 lets a costume pass unremarked, which is why it is
 *                 reported rather than treated as a neutral default.
 *   partial     — some keys name holders. Any count would be a guess,
 *                 so none is given.
 *   declared    — every key names a holder, and `distinct` is
 *                 meaningful (as a claim, not as proof).
 *
 * `soleHolder` is the specific case worth naming: one person, every
 * role. It is a legitimate configuration for a solo project and an
 * illegitimate thing to leave implied.
 */
export function holderCensus(doc) {
  const keys = doc.activeKeys ?? [];
  const named = keys.filter((k) => k.heldBy !== undefined && k.heldBy !== null);

  if (named.length === 0) {
    return { state: "undeclared", roles: keys.length, distinct: null, soleHolder: null, holders: [] };
  }
  if (named.length < keys.length) {
    return {
      state: "partial",
      roles: keys.length,
      declaredFor: named.length,
      distinct: null,
      soleHolder: null,
      holders: [...new Set(named.map((k) => k.heldBy))].sort(),
    };
  }

  const holders = [...new Set(named.map((k) => k.heldBy))].sort();
  return {
    state: "declared",
    roles: keys.length,
    distinct: holders.length,
    soleHolder: holders.length === 1 ? holders[0] : null,
    holders,
    byHolder: Object.fromEntries(
      holders.map((h) => [h, keys.filter((k) => k.heldBy === h).map((k) => k.role).sort()])
    ),
  };
}

/**
 * The sentence a reader needs, rather than a structure they must
 * interpret. Written for the case where the answer is uncomfortable,
 * because that is the case it exists for.
 */
export function describeSeparation(doc) {
  const census = holderCensus(doc);
  if (census.state === "undeclared") {
    return `${census.roles} role(s), holder attribution UNDECLARED — this document does not say how many people hold these keys, so quorum here shows agreement between KEYS and implies nothing about agreement between PEOPLE`;
  }
  if (census.state === "partial") {
    return `${census.roles} role(s), ${census.declaredFor} declared — holder attribution is incomplete, so no count of distinct holders can be given`;
  }
  if (census.soleHolder) {
    return `${census.roles} role(s), ALL held by "${census.soleHolder}" — one person, every role. Quorum will pass and will name several roles; that is one signer, not several parties. The separation of powers here is declared decorative.`;
  }
  return `${census.roles} role(s) across ${census.distinct} declared holder(s): ${census.holders.map((h) => `${h} (${census.byHolder[h].join(", ")})`).join("; ")}`;
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

  // ★ The quorum PASSES on keys. What follows does not gate anything —
  // it reports how many distinct people, as declared, stand behind those
  // keys. A caller that renders `accepted` without this is showing an
  // appearance of agreement it has not checked.
  const holders = accepted.map((a) => doc.activeKeys.find((k) => k.keyId === a.keyId)?.heldBy);
  const distinctHolders = holders.every((h) => h !== undefined && h !== null)
    ? new Set(holders).size
    : null;

  return {
    ok: true,
    accepted,
    distinctKeys: accepted.length,
    distinctHolders, // null = undeclared; a count is a claim, never proof
    // True only when the signers are declared AND distinct. Undeclared
    // reads as false, deliberately: silence must not present as oversight.
    independent: distinctHolders !== null && distinctHolders >= rule.threshold,
  };
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
