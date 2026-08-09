// The anchor store.
//
// Spec §8: the chain provides durable public ordering and tamper-evidence
// and NOTHING ELSE — not availability, not authorisation, not uniqueness,
// not meaning. This module is deliberately an INTERFACE with a local
// implementation, per the spec's "define by contract, never by channel"
// rule (§7): swapping this for Cardano must not change a single line of
// the verifier.
//
// What an anchor asserts: "this digest existed, and was witnessed at this
// position in an ordered sequence." Nothing more.

export class MemoryAnchorStore {
  #anchored = new Map(); // digest -> { seq, at }
  #seq = 0;

  /** Witness a digest. Idempotent: re-anchoring returns the first witness. */
  anchor(digest, at) {
    if (this.#anchored.has(digest)) return this.#anchored.get(digest);
    const entry = { seq: ++this.#seq, at };
    this.#anchored.set(digest, entry);
    return entry;
  }

  isAnchored(digest) {
    return this.#anchored.has(digest);
  }

  positionOf(digest) {
    return this.#anchored.get(digest)?.seq ?? null;
  }

  get size() {
    return this.#anchored.size;
  }
}
