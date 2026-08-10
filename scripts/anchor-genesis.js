// Phase 1 — the first real anchor.
//
// One composition record, written to actual Cardano preprod, and then
// verified with the real anchor store in place of the in-memory one.
// The deliverable is a transaction hash a stranger can look up.
//
//   npm run anchor:genesis
//
// ★ IT IS IDEMPOTENT AND RESUMABLE. Anchoring costs a fee and takes
// minutes, and a script that redoes its work on every run would burn
// both. State lives in .voltron/ (gitignored): keys persist, so a
// second run continues the SAME lineage rather than starting a new
// entity, which is the difference between continuity and amnesia.
//
// ★ WHAT IT PROVES: that anchoring is indifferent to what is anchored,
// that the verifier's `ok` means something someone else can confirm,
// and that the interface boundary held.
// ★ WHAT IT DOES NOT PROVE: anything about organs, models, or drift.
// It is a plumbing proof and should be described as one.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hash } from "../src/canonical.js";
import { generateKey, signRecord } from "../src/keys.js";
import { MemoryLog } from "../src/memory.js";
import {
  AuthorityStore,
  createGenesisAuthority,
  describeSeparation,
} from "../src/authority.js";
import { CompositionStore, draftComposition } from "../src/composition.js";
import { CardanoAnchorStore } from "../src/anchorCardano.js";
import { verifyRecord } from "../src/verifier.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_DIR = join(ROOT, ".voltron");
const STATE_FILE = join(STATE_DIR, "genesis.json");

const ROLES = ["entity", "controller", "steward", "recovery"];

// The owner's ⭐ #3 ruling, 2026-08-10: all four roles, one holder,
// recorded honestly rather than left to be inferred from a passing
// quorum. Override with VOLTRON_HOLDER if that ever stops being true.
const HOLDER = process.env.VOLTRON_HOLDER ?? "shawn";

const log = (...a) => console.log(...a);

function loadState() {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, "utf8"));
}

function saveState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Keys persist across runs. Regenerating them would silently create a
 * DIFFERENT entity that happens to look the same — the exact confusion
 * the whole specification exists to prevent.
 */
function keysFor(state) {
  if (state?.keys) return state.keys;
  log("  generating a fresh key per role (kept in .voltron/, gitignored)…");
  return Object.fromEntries(ROLES.map((role) => [role, generateKey(role)]));
}

function buildLineage(keys, at) {
  const authorities = new AuthorityStore();
  const compositions = new CompositionStore();
  const memory = new MemoryLog();

  const authority = createGenesisAuthority({
    effectiveFrom: at,
    activeKeys: ROLES.map((role) => ({
      keyId: keys[role].keyId,
      role,
      publicPem: keys[role].publicPem,
      heldBy: HOLDER, // ★ the ruling, in the document itself
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
      // ★ Phase 2's job is to make these real files. For Phase 1 they
      // are hashes of declared descriptions — which is honest, because
      // the chain cannot tell the difference and this script is not
      // pretending it can.
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
      reason: "Phase 1 — the first record witnessed by a public chain.",
      at,
    }),
    [keys.controller]
  );
  const genesisRef = compositions.put(genesis);

  return { authorities, compositions, memory, authority, authorityRef, genesisRef };
}

async function anchorOnce(store, digest, label, state) {
  if (state.anchored?.[label]) {
    log(`  ${label.padEnd(10)} already submitted: ${state.anchored[label]}`);
    return state.anchored[label];
  }
  log(`  ${label.padEnd(10)} submitting…`);
  const result = await store.anchor(digest, { note: `Voltron ${label} (Phase 1)` });
  state.anchored = { ...state.anchored, [label]: result.txHash };
  saveState(state);
  log(`  ${label.padEnd(10)} tx ${result.txHash}`);
  log(`  ${" ".repeat(10)} ${result.explorer}`);
  return result.txHash;
}

async function main() {
  log("\nVoltron Phase 1 — first real anchor\n");

  const store = new CardanoAnchorStore();
  const address = await store.address();
  log("  wallet     :", address);

  const prior = loadState();
  const keys = keysFor(prior);
  // A stable timestamp: re-running must reproduce the SAME digests, or
  // "resumable" would quietly mean "anchor a new entity every time".
  const at = prior?.at ?? Math.floor(Date.now() / 1000);

  const { authority, authorityRef, genesisRef, compositions, authorities, memory } =
    buildLineage(keys, at);

  const state = { keys, at, anchored: prior?.anchored ?? {}, authorityRef, genesisRef };
  saveState(state);

  log("  authority  :", authorityRef);
  log("  genesis    :", genesisRef);
  log("\n  who is in charge, as the document itself states it:");
  log("  " + describeSeparation(authority) + "\n");

  // Two anchors: the authority document and the record that cites it.
  // V3 requires the authority to be anchored too — an unanchored
  // authority would be a rule enforced against a document nobody else
  // can see.
  await anchorOnce(store, authorityRef, "authority", state);
  await anchorOnce(store, genesisRef, "genesis", state);

  log("\n  waiting for the chain to confirm (a minute or two)…");
  for (const [label, digest] of [["authority", authorityRef], ["genesis", genesisRef]]) {
    const witness = await store.awaitConfirmation(digest);
    if (!witness) {
      log(`\n  ${label} not confirmed yet. Nothing is lost — re-run and it resumes.`);
      process.exit(1);
    }
    log(`  ${label.padEnd(10)} confirmed in block ${witness.block} (position ${witness.seq})`);
  }

  // ★ The moment the phase exists for: the SAME verifier, unchanged,
  // reading a real chain.
  log("\n  verifying against the real anchor store…");
  const result = verifyRecord({ compositions, authorities, anchors: store, memory }, genesisRef);
  for (const check of result.checks) {
    log(`   ${check.ok ? "✓" : "✗"} ${check.rule}  ${check.note ?? check.reason}`);
  }

  if (!result.ok) {
    log("\nPHASE1_FAIL");
    process.exit(1);
  }

  const witness = store.witnessOf(genesisRef);
  log("\n  ✅ verified — and anyone can check it:");
  log("  " + witness.explorer);
  log(`\nPHASE1_OK:${witness.txHash}:${genesisRef}\n`);
}

main().catch((e) => {
  console.error("\nPHASE1_FAIL:", e.message ?? e);
  process.exit(1);
});
