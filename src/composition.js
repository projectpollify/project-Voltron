// Composition records (spec §4) — the lineage's links.

import { hash } from "./canonical.js";

export class CompositionStore {
  #records = new Map(); // digest -> record

  put(record) {
    const digest = hash(record);
    this.#records.set(digest, record);
    return digest;
  }

  get(digest) {
    return this.#records.get(digest) ?? null;
  }

  has(digest) {
    return this.#records.has(digest);
  }

  all() {
    return [...this.#records.entries()].map(([digest, record]) => ({ digest, ...record }));
  }

  /** Records naming `digest` as predecessor. Two or more means a fork. */
  childrenOf(digest) {
    return this.all().filter((r) => r.predecessor === digest);
  }
}

export function draftComposition({
  predecessor = null,
  priorLineage = null,
  restoresFrom = null,
  authorityRef,
  organs,
  runtime,
  commitments,
  memoryHead,
  change,
  reason,
  at,
}) {
  return {
    predecessor,
    priorLineage,
    restoresFrom,
    authorityRef,
    organs,
    runtime,
    commitments,
    memoryHead,
    change,
    reason,
    at,
  };
}
