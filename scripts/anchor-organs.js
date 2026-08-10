// Phase 2: replace the placeholder organs with real files.
//
//   npm run anchor:organs
//
// ★ THIS IS AN ORGAN SWAP, NOT A CORRECTION TO GENESIS. The genesis
// record is anchored on preprod and cannot be edited; that permanence
// is the property the whole design is built on, and the first time it
// costs us something is the first time it is real. So the lineage
// CONTINUES: a new composition record, change type `organ-swap`, signed
// by the controller, naming genesis as its predecessor.
//
// That is the honest shape. "The organs used to be placeholders and are
// now files" is a fact about this entity's history, and history is
// exactly what a lineage is for.
//
// One transaction, not two, so the UTxO race that bit Phase 1 cannot
// occur here.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hash } from "../src/canonical.js";
import { signRecord } from "../src/keys.js";
import { deserialiseKeys, serialiseKeys } from "../src/keystore.js";
import { MemoryLog } from "../src/memory.js";
import { AuthorityStore, createGenesisAuthority, describeSeparation } from "../src/authority.js";
import { CompositionStore, draftComposition } from "../src/composition.js";
import { CardanoAnchorStore } from "../src/anchorCardano.js";
import { buildOrgans, verifyOrgans } from "../src/artefacts.js";
import { verifyRecord } from "../src/verifier.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_FILE = join(ROOT, ".voltron", "genesis.json");
const ORGANS_FILE = join(ROOT, ".voltron", "organs.json");

const ROLES = ["entity", "controller", "steward", "recovery"];
const HOLDER = process.env.VOLTRON_HOLDER ?? "shawn";

// The organ roles, mapped to real files in the repo. Phase 4 changes
// only the right-hand side: a `.gguf` pins exactly as a `.md` does.
const ORGAN_FILES = {
  brain: join(ROOT, "organs", "reasoner.prompt.md"),
  tools: join(ROOT, "organs", "tools.manifest.json"),
};

const log = (...a) => console.log(...a);

/**
 * Load the keys Phase 1 persisted, tolerating both the shape this repo
 * writes and the near-miss shapes an earlier fix may have produced.
 * A lineage whose keys cannot be loaded is a lineage nobody can extend,
 * so this fails with an explanation rather than a stack trace.
 */
function loadKeys(state) {
  const saved = state?.keys;
  if (!saved) throw new Error("No keys in .voltron/genesis.json. Run `npm run anchor:genesis` first.");

  const normalised = {};
  for (const [role, k] of Object.entries(saved)) {
    const privatePem =
      k.privatePem ?? (typeof k.privateKey === "string" ? k.privateKey : undefined);
    if (!privatePem) {
      throw new Error(
        `The saved key for "${role}" has no usable private half.\n` +
          "  This is the JSON.stringify(KeyObject) failure from Phase 1. If this state file\n" +
          "  predates the fix, the anchored lineage can no longer be signed for, and the\n" +
          "  honest move is a NEW lineage rather than pretending to continue this one."
      );
    }
    normalised[role] = { keyId: k.keyId, label: k.label ?? role, publicPem: k.publicPem, privatePem };
  }
  return deserialiseKeys(normalised);
}

/** Rebuild genesis exactly, so its digest reproduces. */
function rebuildGenesis(keys, at) {
  const authorities = new AuthorityStore();
  const compositions = new CompositionStore();
  const memory = new MemoryLog();

  const authority = createGenesisAuthority({
    effectiveFrom: at,
    activeKeys: ROLES.map((role) => ({
      keyId: keys[role].keyId,
      role,
      publicPem: keys[role].publicPem,
      heldBy: HOLDER,
    })),
    quorumRules: {
      genesis: { threshold: 1, roles: ["controller"] },
      "memory-advance": { threshold: 1, roles: ["entity", "controller"] },
      "organ-swap": { threshold: 1, roles: ["controller"] },
      "commitment-amendment": { threshold: 2, roles: ["steward", "controller"] },
      "authority-amendment": { threshold: 2, roles: ["steward"] },
      rupture: { threshold: 1, roles: ["recovery"] },
      restore: { threshold: 2, roles: ["steward", "controller"] },
    },
  });
  const authorityRef = authorities.put(authority);

  memory.append({ event: "instantiated", note: "first light, on real rails" }, at);

  const genesis = signRecord(
    draftComposition({
      predecessor: null,
      authorityRef,
      organs: {
        brain: hash({ artefact: "placeholder-reasoner", version: 1 }),
        memory: hash({ artefact: "placeholder-log-store", version: 1 }),
      },
      runtime: hash({ runtime: "local", quantisation: "none", prompt: "v1" }),
      commitments: hash({
        values: ["state limits before capabilities", "never claim experience"],
        constraints: ["no unattributed action"],
      }),
      memoryHead: memory.head,
      change: "genesis",
      // ★ DO NOT EDIT THIS STRING, em dash included, which the owner's
      // writing rule would otherwise remove. These exact bytes are
      // hashed into the genesis record anchored at 85a67783… on
      // preprod. Change one character and the digest changes, the
      // rebuild check below fails, and the lineage cannot be extended.
      // Permanence means this text is evidence now, not prose.
      reason: "Phase 1 — the first record witnessed by a public chain.",
      at,
    }),
    [keys.controller]
  );
  const genesisRef = compositions.put(genesis);
  return { authorities, compositions, memory, authority, authorityRef, genesis, genesisRef };
}

async function main() {
  log("\nVoltron Phase 2: organs become real files\n");

  if (!existsSync(STATE_FILE)) {
    log("  No Phase 1 state found. Run `npm run anchor:genesis` first.\n");
    process.exit(1);
  }
  const state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  const keys = loadKeys(state);

  const rebuilt = rebuildGenesis(keys, state.at);
  if (rebuilt.genesisRef !== state.genesisRef) {
    log("  ✗ The rebuilt genesis record does not match the one that was anchored.");
    log("    anchored:", state.genesisRef);
    log("    rebuilt :", rebuilt.genesisRef);
    log("\n  Refusing to continue. A lineage must extend the record that is actually");
    log("  on chain, never a similar one built from drifted assumptions.\n");
    process.exit(1);
  }
  log("  genesis reproduces:", rebuilt.genesisRef.slice(0, 24) + "…");

  // ---- the real artefacts ------------------------------------------
  const { organs, manifest } = await buildOrgans(ORGAN_FILES);
  log("\n  organs, as files on disk:");
  for (const [role, a] of Object.entries(manifest)) {
    log(`   ${role.padEnd(6)} ${a.name.padEnd(24)} ${String(a.bytes).padStart(7)} bytes  ${a.sha256.slice(0, 16)}…`);
  }

  // ★ Hash them, then check them. A pin nobody re-reads is decoration.
  const check = await verifyOrgans(organs, ORGAN_FILES);
  if (!check.ok) {
    log("\n  ✗ organ verification failed before anchoring:", JSON.stringify(check, null, 2));
    process.exit(1);
  }
  log(`   verified ${check.checked} organ(s) against disk`);

  // ---- the record ---------------------------------------------------
  const { memory, compositions, authorities, authorityRef, genesisRef } = rebuilt;
  const at = state.organsAt ?? Math.floor(Date.now() / 1000);

  // The entity's history records that its brain was replaced. An organ
  // swap that left no trace in memory would be a change to the thing
  // without a change to what the thing remembers of itself.
  memory.append(
    { event: "organ-swap", note: "placeholders replaced by real artefacts", roles: Object.keys(organs) },
    at
  );

  const swap = signRecord(
    draftComposition({
      predecessor: genesisRef,
      authorityRef,
      organs,
      runtime: rebuilt.genesis.runtime,
      commitments: rebuilt.genesis.commitments, // UNCHANGED: V4 requires it
      memoryHead: memory.head,
      change: "organ-swap",
      reason: "Phase 2: organs are files that exist, not hashes of descriptions.",
      at,
    }),
    [keys.controller]
  );
  const swapRef = compositions.put(swap);
  log("\n  new record :", swapRef);
  log("  " + describeSeparation(rebuilt.authority));

  mkdirSync(dirname(ORGANS_FILE), { recursive: true });
  const organState = existsSync(ORGANS_FILE) ? JSON.parse(readFileSync(ORGANS_FILE, "utf8")) : {};
  writeFileSync(
    ORGANS_FILE,
    JSON.stringify({ ...organState, organsAt: at, swapRef, manifest, keys: serialiseKeys(keys) }, null, 2)
  );

  // ---- anchor -------------------------------------------------------
  const store = new CardanoAnchorStore();
  log("\n  wallet     :", await store.address());

  if (organState.txHash) {
    log("  already submitted:", organState.txHash);
  } else {
    log("  submitting…");
    const result = await store.anchor(swapRef, { note: "Voltron organ-swap (Phase 2)" });
    writeFileSync(
      ORGANS_FILE,
      JSON.stringify({ organsAt: at, swapRef, manifest, txHash: result.txHash, keys: serialiseKeys(keys) }, null, 2)
    );
    log("  tx         :", result.txHash);
    log("  explorer   :", result.explorer);
  }

  log("\n  waiting for confirmation…");
  const witness = await store.awaitConfirmation(swapRef);
  if (!witness) {
    log("\n  Not confirmed yet. Nothing is lost, re-run and it resumes.\n");
    process.exit(1);
  }
  log(`  confirmed in block ${witness.block} (position ${witness.seq})`);

  // ---- verify against the live chain --------------------------------
  log("\n  verifying against the real anchor store…");
  const result = verifyRecord({ compositions, authorities, anchors: store, memory }, swapRef);
  for (const c of result.checks) log(`   ${c.ok ? "✓" : "✗"} ${c.rule}  ${c.note ?? c.reason}`);

  if (!result.ok) {
    log("\nPHASE2_FAIL\n");
    process.exit(1);
  }

  log("\n  ✅ the organs are real, pinned, and witnessed:");
  log("  " + witness.explorer);
  log(`\nPHASE2_OK:${witness.txHash}:${swapRef}\n`);
}

main().catch((e) => {
  console.error("\nPHASE2_FAIL:", e.message ?? e);
  process.exit(1);
});
