// Keys and signatures (Ed25519, via Node's built-in crypto — no
// dependencies). A keyId is the hash of the public key, so a key's
// identity travels with it and cannot be renamed.

import { generateKeyPairSync, sign as nodeSign, verify as nodeVerify, createPublicKey } from "node:crypto";
import { hash, signingHash } from "./canonical.js";

export function generateKey(label = "") {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  return {
    keyId: hash({ publicPem }).slice(0, 32),
    label,
    publicPem,
    privateKey, // kept in-process only; never serialised into a record
  };
}

export function sign(key, payloadHash) {
  return nodeSign(null, Buffer.from(payloadHash, "hex"), key.privateKey).toString("hex");
}

export function verify(publicPem, payloadHash, signatureHex) {
  try {
    return nodeVerify(
      null,
      Buffer.from(payloadHash, "hex"),
      createPublicKey(publicPem),
      Buffer.from(signatureHex, "hex")
    );
  } catch {
    return false;
  }
}

/** Sign a record (any record: composition or authority document). */
export function signRecord(record, keys) {
  const payload = signingHash(record);
  return {
    ...record,
    signatures: keys.map((k) => ({ keyId: k.keyId, sig: sign(k, payload) })),
  };
}
