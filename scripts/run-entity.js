// Phase 3, step 2: run the entity.
//
//   npm run entity
//
// Loads the composition that is actually anchored, refuses to start if
// the artefacts on disk are not the pinned ones, and then acts only
// inside the tool surface its own pinned manifest declares.
//
// ★ NO FEE, NO NETWORK WRITES. This reads the chain to confirm what is
// anchored and never submits anything. Running the entity is not a
// change to it.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { deserialiseKeys } from "../src/keystore.js";
import { rebuildLineage, assertMatchesChain } from "../src/rebuild.js";
import { loadEntity, act } from "../src/runtime.js";
import { RUNTIME_CONFIG, ORGAN_PATHS } from "../src/entityConfig.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (n) => {
  const p = join(ROOT, ".voltron", n);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
};

const log = (...a) => console.log(...a);

async function main() {
  log("\nVoltron Phase 3, step 2: the entity runs\n");

  const state = read("genesis.json");
  const organState = read("organs.json");
  if (!state || !organState) {
    log("  Run `npm run anchor:genesis` and `npm run anchor:organs` first.\n");
    process.exit(1);
  }
  // ★ Found by running this, not by a test. Without `swapRef` the
  // rebuild silently falls back to GENESIS, whose organs are the Phase 1
  // placeholders, and the load then fails with "organs no longer match
  // the record", a true statement that points at entirely the wrong
  // problem. An incomplete state file must say so itself.
  if (!organState.swapRef) {
    log("  .voltron/organs.json has no swapRef, so the Phase 2 record is unknown.");
    log("  Without it the lineage would fall back to genesis and its placeholder organs.");
    log("  Re-run `npm run anchor:organs`.\n");
    process.exit(1);
  }

  const keys = deserialiseKeys(
    Object.fromEntries(
      Object.entries(state.keys).map(([role, k]) => [
        role,
        { ...k, privatePem: k.privatePem ?? (typeof k.privateKey === "string" ? k.privateKey : undefined) },
      ])
    )
  );

  const lineage = rebuildLineage(keys, state, organState);
  assertMatchesChain(lineage, state, organState);

  const pinned = read("pinned.json");
  if (!pinned?.amendmentRef) {
    // ★ No workaround here on purpose. Before the amendment, the record's
    // runtime is genesis's asserted string, which no measurement can
    // reproduce. A flag to skip the runtime check would be a hole in the
    // one rule this phase exists to make real, so the entity simply does
    // not run until its runtime is genuinely pinned.
    log("  The commitment set has not been published, so the runtime is not pinned.");
    log("  Run `npm run amend:commitments` first.\n");
    process.exit(1);
  }

  const record = { organs: lineage.head.organs, runtime: pinned.runtimeDigest };

  log("  record :", pinned.amendmentRef);
  log("  organs :");
  for (const [role, digest] of Object.entries(record.organs)) {
    log(`   ${role.padEnd(6)} ${digest.slice(0, 24)}…`);
  }

  // ---- load, or refuse -----------------------------------------------
  let entity;
  try {
    entity = await loadEntity({
      record,
      organPaths: ORGAN_PATHS,
      runtimeConfig: RUNTIME_CONFIG,
      memory: lineage.memory,
    });
  } catch (e) {
    log("\n  ✗ " + e.message + "\n");
    process.exit(1);
  }

  log("\n  ✓ organs verified against disk at load");
  log("  ✓ runtime matches the pin");
  log("  ✗ nothing proves to a third party that THIS process ran them (§9)");

  // ---- act -------------------------------------------------------------
  log("\n  acting:");
  const result = await act(entity, "Summarise what you are permitted to do.");
  log("   engine :", result.provenance.engine);
  log("   model  :", result.provenance.model ?? "none");
  log("   note   :", result.answer.note ?? "(a model produced this)");

  // ---- the tool surface, exercised -------------------------------------
  log("\n  tool calls:");
  const at = Math.floor(Date.now() / 1000);
  for (const name of ["read_memory", "append_memory", "restore", "amend_commitments", "transfer_funds"]) {
    const r = await entity.call(name, {}, at);
    log(`   ${r.ok ? "✓ allowed " : "✗ refused "} ${name.padEnd(18)} ${r.ok ? r.effect : r.reason.slice(0, 96)}`);
  }

  log("\n  What this run established: the pinned artefacts are the ones on disk,");
  log("  the runtime matches, and the entity acted only inside its declared surface.");
  log("  What it did NOT establish: that any model reasoned, or that a third party");
  log("  can confirm this process loaded what it says it loaded.\n");
  log("PHASE3_ENTITY_OK\n");
}

main().catch((e) => {
  console.error("\nPHASE3_FAIL:", e.message ?? e);
  process.exit(1);
});
