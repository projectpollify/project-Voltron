// Phase 3, step 1: publish the commitment set, so the STATIC pins
// actually run.
//
//   npm run amend:commitments
//
// ★ THE DEFECT THIS CLOSES. The verifier's S1, S2 and S3 rules only
// engage when it is handed a RESOLVABLE commitment set. Phases 1 and 2
// passed only a digest, so those rules were skipped in every run: the
// output printed V1 through V6 and nothing else. The rule saying "an
// organ may not change without a quorum-authorised amendment" was
// present in the code and inert in practice.
//
// Closing it needs an amendment rather than an edit, because the
// commitments digest is already anchored. The new set pins the organs
// and the measured runtime, so from here on an organ swap or a decoding
// change requires the same two-signature quorum as a change of values.
//
// ★ AND IT IS THE FIRST TIME THE AMENDMENT QUORUM IS EXERCISED: two
// signatures, steward and controller, where every record so far needed
// one. Both keys are the owner's, and the census will say so.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { signRecord } from "../src/keys.js";
import { deserialiseKeys } from "../src/keystore.js";
import { draftComposition } from "../src/composition.js";
import { commitmentSet } from "../src/drift.js";
import { COMMITMENT_VALUES, COMMITMENT_CONSTRAINTS, PROBES } from "../src/commitments.js";
import { describeSeparation } from "../src/authority.js";
import { CardanoAnchorStore } from "../src/anchorCardano.js";
import { verifyRecord } from "../src/verifier.js";
import { rebuildLineage, assertMatchesChain } from "../src/rebuild.js";
import { measureRuntime } from "../src/runtime.js";
import { RUNTIME_CONFIG, ORGAN_PATHS } from "../src/entityConfig.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_FILE = join(ROOT, ".voltron", "genesis.json");
const ORGANS_FILE = join(ROOT, ".voltron", "organs.json");
const PINNED_FILE = join(ROOT, ".voltron", "pinned.json");

const HOLDER = process.env.VOLTRON_HOLDER ?? "shawn";
const log = (...a) => console.log(...a);

/**
 * ★ THE PROBES ARE INCLUDED NOW, NOT AT PHASE 4.
 *
 * They live in `src/commitments.js`, shared, because every script that
 * extends the lineage must reproduce this set byte for byte. Changing
 * the probes IS a commitment amendment, by design: a compass you can
 * re-calibrate at will is not a compass. Publishing them here means
 * Phase 4 can measure drift without first needing another amendment,
 * and it means these answers were endorsed BEFORE any model existed to
 * be tested against them, which is the only order in which a
 * calibration means anything.
 */

async function main() {
  log("\nVoltron Phase 3, step 1: publish the commitment set\n");

  if (!existsSync(STATE_FILE)) {
    log("  No Phase 1 state. Run `npm run anchor:genesis` first.\n");
    process.exit(1);
  }
  const state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  const organState = existsSync(ORGANS_FILE) ? JSON.parse(readFileSync(ORGANS_FILE, "utf8")) : null;
  if (!organState?.swapRef) {
    log("  No Phase 2 state. Run `npm run anchor:organs` first.\n");
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

  const lineage = rebuildLineage(keys, state, organState, HOLDER);
  assertMatchesChain(lineage, state, organState);
  log("  lineage reproduces:", lineage.headRef.slice(0, 24) + "…");

  // The organs stay exactly as anchored; only the commitments change.
  const organs = lineage.head.organs;
  const runtime = measureRuntime(RUNTIME_CONFIG);

  const set = commitmentSet({
    values: COMMITMENT_VALUES,
    constraints: COMMITMENT_CONSTRAINTS,
    probes: PROBES,
    organs, // ★ S1 becomes live
    runtime: runtime.digest, // ★ S2 becomes live
    // S3 pins the conscience organ. There is no conscience organ yet, so
    // it stays null rather than pointing at something that would make
    // the rule look enforced when it is not. Phase 4's job.
    conscience: null,
  });
  const commitmentsRef = lineage.commitments.put(set);

  const at = organState.pinnedAt ?? Math.floor(Date.now() / 1000);
  lineage.memory.append(
    {
      event: "commitment-amendment",
      note: "commitment set published; organs and runtime pinned so S1 and S2 engage",
      probes: PROBES.map((p) => p.id),
    },
    at
  );

  const amendment = signRecord(
    draftComposition({
      predecessor: lineage.headRef,
      authorityRef: lineage.authorityRef,
      organs,
      runtime: runtime.digest,
      commitments: commitmentsRef,
      memoryHead: lineage.memory.head,
      change: "commitment-amendment",
      reason: "Phase 3: publish the commitment set so the organ and runtime pins stop being inert.",
      at,
    }),
    // ★ TWO signatures. Every prior record needed one.
    [keys.steward, keys.controller]
  );
  const amendmentRef = lineage.compositions.put(amendment);

  log("\n  commitment set :", commitmentsRef);
  log("  probes         :", PROBES.map((p) => p.id).join(", "));
  log("  runtime pin    :", runtime.digest.slice(0, 24) + "…");
  log("  organs pinned  :", Object.keys(organs).join(", "));
  log("  new record     :", amendmentRef);
  log("\n  " + describeSeparation(lineage.authority));

  mkdirSync(dirname(PINNED_FILE), { recursive: true });
  const prior = existsSync(PINNED_FILE) ? JSON.parse(readFileSync(PINNED_FILE, "utf8")) : {};
  const save = (extra = {}) =>
    writeFileSync(
      PINNED_FILE,
      JSON.stringify(
        {
          ...prior,
          pinnedAt: at,
          amendmentRef,
          commitmentsRef,
          runtimeDigest: runtime.digest, // what S2 compares against
          runtime: runtime.measured, // the settings, for a human to read
          ...extra,
        },
        null,
        2
      )
    );
  save();

  const store = new CardanoAnchorStore();
  log("\n  wallet   :", await store.address());

  if (prior.txHash) {
    log("  already submitted:", prior.txHash);
  } else {
    log("  submitting…");
    const result = await store.anchor(amendmentRef, { note: "Voltron commitment amendment (Phase 3)" });
    save({ txHash: result.txHash });
    log("  tx       :", result.txHash);
    log("  explorer :", result.explorer);
  }

  log("\n  waiting for confirmation…");
  const witness = await store.awaitConfirmation(amendmentRef);
  if (!witness) {
    log("\n  Not confirmed yet. Nothing is lost, re-run and it resumes.\n");
    process.exit(1);
  }
  log(`  confirmed in block ${witness.block} (position ${witness.seq})`);

  // ★ The verifier now receives the commitment store, which is the whole
  // point: S1 and S2 should appear in this output. If they do not, the
  // pins are still inert and the phase has not done its job.
  log("\n  verifying against the live chain, WITH the commitment set…");
  const result = verifyRecord(
    {
      compositions: lineage.compositions,
      authorities: lineage.authorities,
      anchors: store,
      memory: lineage.memory,
      commitments: lineage.commitments,
    },
    amendmentRef
  );
  for (const c of result.checks) log(`   ${c.ok ? "✓" : "✗"} ${c.rule.padEnd(3)} ${c.note ?? c.reason}`);

  const rules = new Set(result.checks.map((c) => c.rule));
  if (!result.ok) {
    log("\nPHASE3_FAIL\n");
    process.exit(1);
  }
  if (!rules.has("S1") || !rules.has("S2")) {
    log("\n  ✗ S1/S2 still did not run. The pins remain inert and this phase failed.\n");
    process.exit(1);
  }

  log("\n  ✅ the organ and runtime pins are live:");
  log("  " + witness.explorer);
  log(`\nPHASE3_PINNED_OK:${witness.txHash}:${amendmentRef}\n`);
}

main().catch((e) => {
  console.error("\nPHASE3_FAIL:", e.message ?? e);
  process.exit(1);
});
