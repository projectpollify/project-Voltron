// Canonical serialisation and hashing.
//
// Every hash in this system is taken over a canonical form, so that two
// structurally identical records always produce the same digest
// regardless of key insertion order. Without this, "the same record"
// would hash differently depending on how it was built, and the whole
// lineage would be unverifiable.

import { createHash } from "node:crypto";

/** Recursively sort object keys; arrays keep their order (order is data). */
export function canonicalise(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalise);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) continue; // undefined is absence, not data
    out[key] = canonicalise(value[key]);
  }
  return out;
}

export function canonicalJSON(value) {
  return JSON.stringify(canonicalise(value));
}

export function hash(value) {
  return createHash("sha256").update(canonicalJSON(value)).digest("hex");
}

/**
 * The payload a signature covers: the record WITHOUT its own signatures.
 * Signing a record that contains its signatures would be circular.
 */
export function signingPayload(record) {
  const { signatures, ...rest } = record;
  return rest;
}

export function signingHash(record) {
  return hash(signingPayload(record));
}
