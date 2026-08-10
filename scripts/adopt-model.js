// Phase 4, step 1: adopt a real model as an organ.
//
//   VOLTRON_MODEL_PATH=/path/to/Qwen3.5-9B-Q4_K_M.gguf \
//   VOLTRON_ENGINE=ollama VOLTRON_MODEL=qwen3.5:9b \
//   npm run adopt:model
//
// ★ WHY THIS COSTS A QUORUM. The commitment set pins the organ set (S1)
// and the runtime (S2). Adding a model organ changes the first; setting
// an engine changes the second. Either alone would be refused at load,
// which is the design working: swapping the thing that thinks is not a
// configuration change, it is an amendment.
//
// One record does both, signed by steward and controller, and the
// verifier is handed the commitment set so S1 and S2 actually run.
//
// ★ HASHING A 5.68 GB FILE TAKES A MINUTE. It is streamed, so memory
// stays flat. This is the artefact the streaming existed for.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { signRecord } from "../src/keys.js";
import { deserialiseKeys } from "../src/keystore.js";
import { draftComposition } from "../src/composition.js";
import { commitmentSet } from "../src/drift.js";
import { describeSeparation } from "../src/authority.js";
import { CardanoAnchorStore } from "../src/anchorCardano.js";
import { verifyRecord } from "../src/verifier.js";
import { rebuildLineage, assertMatchesChain } from "../src/rebuild.js";
import { measureRuntime } from "../src/runtime.js";
import { buildOrgans } from "../src/artefacts.js";
import { RUNTIME_CONFIG, ORGAN_PATHS } from "../src/entityConfig.js";
import { checkOllama } from "../src/brains/ollama.js";
import { COMMITMENT_VALUES, COMMITMENT_CONSTRAINTS, PROBES } from "../src/commitments.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = (n) => join(ROOT, ".voltron", n);
const read = (n) => (existsSync(P(n)) ? JSON.parse(readFileSync(P(n), "utf8")) : null);
const HOLDER = process.env.VOLTRON_HOLDER ?? "shawn";
const log = (...a) => console.log(...a);

async function main() {
  log("\nVoltron Phase 4, step 1: adopt a model as an organ\n");

  if (!ORGAN_PATHS.model) {
    log("  VOLTRON_MODEL_PATH is not set, so there is no model file to pin.");
    log("  Point it at the .gguf you downloaded, for example:");
    log("    export VOLTRON_MODEL_PATH=~/models/Qwen3.5-9B-Q4_K_M.gguf\n");
    process.exit(1);
  }
  if (RUNTIME_CONFIG.engine === "stub") {
    log("  VOLTRON_ENGINE is still \"stub\". Adopting a model file while nothing runs it");
    log("  would pin an artefact the composition never uses, which is worse than not");
    log("  pinning it: the record would claim a brain that is decorative.");
    log("    export VOLTRON_ENGINE=ollama");
    log("    export VOLTRON_MODEL=qwen3.5:9b\n");
    process.exit(1);
  }

  // Checked BEFORE anything is anchored. Pinning a model that cannot be
  // run would put a permanent claim on chain that the next step refutes.
  const health = await checkOllama({ model: RUNTIME_CONFIG.model });
  if (!health.ok) {
    log("  " + health.reason + "\n");
    process.exit(1);
  }
  log("  ollama   : running, model present");

  const state = read("genesis.json");
  const organState = read("organs.json");
  const pinned = read("pinned.json");
  if (!state || !organState || !pinned?.amendmentRef) {
    log("  Phases 1 to 3 must have run first.\n");
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

  // Rebuild the Phase 3 amendment so this record has a real predecessor.
  const priorRuntime = pinned.runtimeDigest;
  const priorSet = commitmentSet({
    values: COMMITMENT_VALUES,
    constraints: COMMITMENT_CONSTRAINTS,
    probes: PROBES,
    organs: lineage.head.organs,
    runtime: priorRuntime,
    conscience: null,
  });
  const priorRef = lineage.commitments.put(priorSet);
  lineage.memory.append(
    {
      event: "commitment-amendment",
      note: "commitment set published; organs and runtime pinned so S1 and S2 engage",
      probes: PROBES.map((p) => p.id),
    },
    pinned.pinnedAt
  );
  const phase3 = signRecord(
    draftComposition({
      predecessor: lineage.headRef,
      authorityRef: lineage.authorityRef,
      organs: lineage.head.organs,
      runtime: priorRuntime,
      commitments: priorRef,
      memoryHead: lineage.memory.head,
      change: "commitment-amendment",
      reason: "Phase 3: publish the commitment set so the organ and runtime pins stop being inert.",
      at: pinned.pinnedAt,
    }),
    [keys.steward, keys.controller]
  );
  const phase3Ref = lineage.compositions.put(phase3);
  if (phase3Ref !== pinned.amendmentRef) {
    log("  ✗ The rebuilt Phase 3 amendment does not match the anchored one.");
    log("    anchored:", pinned.amendmentRef);
    log("    rebuilt :", phase3Ref);
    log("\n  Refusing to extend a lineage this process cannot reproduce.\n");
    process.exit(1);
  }
  log("  lineage  : reproduces to", phase3Ref.slice(0, 24) + "…");

  // ---- the model, hashed --------------------------------------------
  log("\n  hashing the model file (streamed, this takes a moment)…");
  const { organs, manifest } = await buildOrgans(ORGAN_PATHS);
  for (const [role, a] of Object.entries(manifest)) {
    const mb = (a.bytes / 1_048_576).toFixed(1);
    log(`   ${role.padEnd(6)} ${a.name.padEnd(30)} ${mb.padStart(9)} MB  ${a.sha256.slice(0, 16)}…`);
  }

  const runtime = measureRuntime(RUNTIME_CONFIG);
  const set = commitmentSet({
    values: COMMITMENT_VALUES,
    constraints: COMMITMENT_CONSTRAINTS,
    probes: PROBES, // unchanged: re-calibrating alongside the change would defeat the measurement
    organs,
    runtime: runtime.digest,
    conscience: null,
  });
  const commitmentsRef = lineage.commitments.put(set);

  const at = pinned.modelAt ?? Math.floor(Date.now() / 1000);
  lineage.memory.append(
    {
      event: "commitment-amendment",
      note: "a model became an organ; the brain now runs",
      engine: RUNTIME_CONFIG.engine,
      model: RUNTIME_CONFIG.model,
    },
    at
  );

  const record = signRecord(
    draftComposition({
      predecessor: phase3Ref,
      authorityRef: lineage.authorityRef,
      organs,
      runtime: runtime.digest,
      commitments: commitmentsRef,
      memoryHead: lineage.memory.head,
      change: "commitment-amendment",
      reason: "Phase 4: adopt a model as a pinned organ, and pin the decoder that runs it.",
      at,
    }),
    [keys.steward, keys.controller]
  );
  const recordRef = lineage.compositions.put(record);

  log("\n  runtime  :", RUNTIME_CONFIG.engine, "/", RUNTIME_CONFIG.model,
      `(temp ${RUNTIME_CONFIG.temperature}, seed ${RUNTIME_CONFIG.seed}, ctx ${RUNTIME_CONFIG.contextLength})`);
  log("  record   :", recordRef);
  log("\n  " + describeSeparation(lineage.authority));

  const save = (extra = {}) => {
    mkdirSync(dirname(P("model.json")), { recursive: true });
    writeFileSync(
      P("model.json"),
      JSON.stringify(
        { modelAt: at, recordRef, commitmentsRef, runtimeDigest: runtime.digest, runtime: runtime.measured, manifest, ...extra },
        null,
        2
      )
    );
  };
  const priorModel = read("model.json") ?? {};
  save(priorModel.txHash ? { txHash: priorModel.txHash } : {});

  const store = new CardanoAnchorStore();
  log("\n  wallet   :", await store.address());

  if (priorModel.txHash) {
    log("  already submitted:", priorModel.txHash);
  } else {
    log("  submitting…");
    const result = await store.anchor(recordRef, { note: "Voltron model adoption (Phase 4)" });
    save({ txHash: result.txHash });
    log("  tx       :", result.txHash);
    log("  explorer :", result.explorer);
  }

  log("\n  waiting for confirmation…");
  const witness = await store.awaitConfirmation(recordRef);
  if (!witness) {
    log("\n  Not confirmed yet. Nothing is lost, re-run and it resumes.\n");
    process.exit(1);
  }
  log(`  confirmed in block ${witness.block} (position ${witness.seq})`);

  log("\n  verifying against the live chain, with the commitment set…");
  const result = verifyRecord(
    {
      compositions: lineage.compositions,
      authorities: lineage.authorities,
      anchors: store,
      memory: lineage.memory,
      commitments: lineage.commitments,
    },
    recordRef
  );
  for (const c of result.checks) log(`   ${c.ok ? "✓" : "✗"} ${c.rule.padEnd(3)} ${c.note ?? c.reason}`);

  if (!result.ok) {
    log("\nPHASE4_FAIL\n");
    process.exit(1);
  }

  log("\n  ✅ the model is a pinned organ:");
  log("  " + witness.explorer);
  log(`\nPHASE4_MODEL_OK:${witness.txHash}:${recordRef}\n`);
}

main().catch((e) => {
  console.error("\nPHASE4_FAIL:", e.message ?? e);
  process.exit(1);
});
