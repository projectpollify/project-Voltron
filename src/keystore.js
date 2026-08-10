// Persisting keys between runs.
//
// ★ THIS MODULE EXISTS BECAUSE OF A REAL BUG, and the bug is worth
// stating so nobody reintroduces it.
//
// `generateKey()` returns an object holding a Node `KeyObject`. That
// object has no JSON representation, so `JSON.stringify` renders it as
// `{}` and DROPS THE PRIVATE KEY SILENTLY. A state file written that
// way looks perfectly correct, contains everything except the one thing
// that matters, and fails only later, at signing time.
//
// Phase 1 shipped with exactly that defect, three lines below a comment
// promising that keys persist across runs, and explaining why: without
// persistence, a re-run "would silently create a DIFFERENT entity that
// happens to look the same", the precise confusion this whole
// specification exists to prevent. It survived 81 passing tests because
// every one of them ran in a single process, where the in-memory key
// was still there.
//
// So keys are serialised deliberately here, in one place, rather than
// incidentally at each call site.
//
// ★ WHAT THIS FILE HOLDS. Private keys, unencrypted, in PKCS8 PEM.
// Whoever reads the file controls the entity: they can sign memory
// advances, swap organs, and (given the ⭐ #3 ruling that one person
// holds every role) satisfy every quorum in the document. It belongs in
// a gitignored directory and nowhere else. Encrypting it at rest is a
// real improvement and is NOT done here, because a passphrase this
// project does not yet have a home for would be theatre.

import { createPrivateKey, createPublicKey } from "node:crypto";
import { hash } from "./canonical.js";

/**
 * A saveable form of a key set. Private keys become PKCS8 PEM strings,
 * which are text and therefore survive JSON intact.
 */
export function serialiseKeys(keys) {
  const out = {};
  for (const [role, key] of Object.entries(keys)) {
    if (!key?.privateKey) {
      throw new Error(
        `Refusing to serialise the key for "${role}": it carries no private key. ` +
          "Saving it would produce a state file that looks complete and cannot sign."
      );
    }
    out[role] = {
      keyId: key.keyId,
      label: key.label ?? role,
      publicPem: key.publicPem,
      privatePem: key.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    };
  }
  return out;
}

/**
 * Rehydrate what `serialiseKeys` wrote.
 *
 * ★ It re-derives the keyId from the public key rather than trusting
 * the stored one, and re-derives the public key from the PRIVATE key
 * rather than trusting the stored public half. A tampered or truncated
 * state file therefore fails here, loudly, instead of producing a key
 * set that signs under someone else's identity.
 */
export function deserialiseKeys(saved) {
  const out = {};
  for (const [role, k] of Object.entries(saved ?? {})) {
    if (!k?.privatePem || typeof k.privatePem !== "string") {
      throw new Error(
        `The saved key for "${role}" has no private half. This is the JSON.stringify(KeyObject) ` +
          "failure: the file was written before keys were serialised properly. " +
          "The lineage it belongs to can no longer be signed for."
      );
    }
    const privateKey = createPrivateKey(k.privatePem);
    const publicPem = createPublicKey(privateKey).export({ type: "spki", format: "pem" }).toString();

    if (k.publicPem && k.publicPem !== publicPem) {
      throw new Error(
        `The saved key for "${role}" is inconsistent: its stored public key does not match ` +
          "the one derived from its private key. Refusing to load a tampered key set."
      );
    }
    const keyId = hash({ publicPem }).slice(0, 32);
    if (k.keyId && k.keyId !== keyId) {
      throw new Error(
        `The saved key for "${role}" has a keyId that does not match its public key. ` +
          "A keyId is derived, never asserted."
      );
    }
    out[role] = { keyId, label: k.label ?? role, publicPem, privateKey };
  }
  return out;
}

/**
 * Did this state file survive the KeyObject bug? Cheap to ask, and the
 * answer decides whether a lineage is still controllable.
 */
export function keysAreUsable(saved) {
  try {
    const keys = deserialiseKeys(saved);
    return Object.keys(keys).length > 0;
  } catch {
    return false;
  }
}
