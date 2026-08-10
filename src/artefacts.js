// Phase 2: organs as real files.
//
// Until now an organ was `hash({ artefact: "placeholder-reasoner",
// version: 1 })`: a fingerprint of a description of a thing that does
// not exist. Every rule ran correctly over it, which is the point of
// Phase 1 and also its limit. This module makes the fingerprints refer
// to files you can open.
//
// ★ WHY THIS IS A PHASE AND NOT A DETAIL. The verifier's S1 rule says
// an organ may not change without a quorum-authorised amendment. That
// rule is only worth anything if "the organ" names something in the
// world. Pointing it at a placeholder made it a statement about a
// string. Pointing it at a file makes it a statement about an artefact
// someone could substitute, and therefore a rule that can be broken and
// caught.
//
// ★ WHAT A CONTENT HASH PROVES, EXACTLY: that these bytes are those
// bytes. It does not prove the file is good, that it does what its name
// suggests, or that any process actually loaded it. §9's binding
// problem is untouched here and is Phase 3's to state in running code.
//
// ★ AND AN ORGAN NEED NOT BE A MODEL. A system prompt, a tool manifest,
// a retrieval configuration: each is a file, each hashes identically,
// and none needs a GPU. This is deliberate. It keeps hardware off the
// critical path, so the composition machinery can be proven end to end
// on a machine that cannot run a single open weight.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";

/**
 * Hash a file's contents.
 *
 * ★ STREAMED, NOT READ. `readFile` on a 5.68 GB model would need 5.68 GB
 * of memory, and Phase 4's whole hardware budget is 16 GB. The artefact
 * this project most wants to hash is precisely the one that cannot be
 * held in memory, so streaming is a requirement rather than a
 * refinement.
 */
export async function hashFile(path) {
  const digest = createHash("sha256");
  const stream = createReadStream(path);
  for await (const chunk of stream) digest.update(chunk);
  return digest.digest("hex");
}

/**
 * Describe one artefact: what it is, and what it hashes to.
 *
 * ★ THE PATH IS NOT PART OF THE IDENTITY. `bytes` and `name` are
 * recorded because they help a human find the thing again; only `sha256`
 * decides whether two artefacts are the same. Moving a file must not
 * change the organ, and renaming it must not either. If the path were
 * hashed, every organ would break the moment someone reorganised a
 * folder, and identity would depend on filesystem layout, which is not
 * a property of the artefact at all.
 */
export async function describeArtefact(path) {
  const full = resolve(path);
  const info = await stat(full);
  if (!info.isFile()) throw new Error(`Not a file: ${full}`);
  return {
    name: basename(full),
    bytes: info.size,
    sha256: await hashFile(full),
    path: full, // convenience for humans; deliberately NOT hashed
  };
}

/**
 * Build the organ set from real files.
 *
 * @param roleToPath  e.g. { brain: "organs/reasoner.md", memory: "..." }
 * @returns { organs, manifest }. `organs` is what a composition record
 *          carries (role to digest); `manifest` is the human-readable
 *          companion, which is NOT anchored and NOT authoritative.
 */
export async function buildOrgans(roleToPath) {
  const entries = await Promise.all(
    Object.entries(roleToPath).map(async ([role, path]) => [role, await describeArtefact(path)])
  );

  const organs = {};
  const manifest = {};
  for (const [role, artefact] of entries) {
    organs[role] = artefact.sha256;
    manifest[role] = artefact;
  }
  return { organs, manifest };
}

/**
 * ★ THE CHECK THAT MAKES THE PIN REAL: re-hash what is on disk now and
 * compare it to what the record claims.
 *
 * A pinned organ is only a pin if somebody looks. Without this, S1
 * compares a record against another record and never against the world,
 * and a swapped file passes every rule.
 *
 * Returns a per-role verdict rather than a bare boolean, so a failure
 * says WHICH organ moved and to what. "Something changed" is not an
 * actionable finding.
 */
export async function verifyOrgans(organs, roleToPath) {
  const results = [];
  for (const [role, expected] of Object.entries(organs)) {
    const path = roleToPath[role];
    if (!path) {
      results.push({ role, ok: false, reason: "no file is mapped to this organ role" });
      continue;
    }
    try {
      const actual = await hashFile(path);
      results.push(
        actual === expected
          ? { role, ok: true, sha256: actual }
          : {
              role,
              ok: false,
              expected,
              actual,
              reason: `the file at ${path} does not hash to the pinned organ: the artefact has been replaced or edited`,
            }
      );
    } catch (e) {
      // ★ Missing is not "changed", and neither is unreadable. Both are
      // reported as what they are, because a verifier that cannot read
      // an artefact has not checked it, and must not say that it did.
      results.push({ role, ok: false, reason: `could not read ${path}: ${e.message}`, unchecked: true });
    }
  }

  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    checked: results.filter((r) => !r.unchecked).length,
    results,
    // Distinguishing these two matters: one is evidence, the other is
    // the absence of evidence.
    changed: failed.filter((r) => !r.unchecked).map((r) => r.role),
    unchecked: failed.filter((r) => r.unchecked).map((r) => r.role),
  };
}
