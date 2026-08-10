// Rebuilding the anchored lineage from saved state.
//
// ★ WHY THIS IS SHARED RATHER THAN COPIED. Every script that extends the
// lineage must reproduce the records already on chain, byte for byte,
// because a record's digest IS its identity and the predecessor link is
// a digest. Two copies of this logic would drift, and the first symptom
// would be a script cheerfully building a lineage that descends from a
// record nobody ever anchored.
//
// So the reconstruction lives in one place, and every script that needs
// it asserts the result against what was actually anchored before doing
// anything else.

import { hash } from "./canonical.js";
import { signRecord } from "./keys.js";
import { MemoryLog } from "./memory.js";
import { AuthorityStore, createGenesisAuthority } from "./authority.js";
import { CompositionStore, draftComposition } from "./composition.js";
import { CommitmentStore } from "./drift.js";

export const ROLES = ["entity", "controller", "steward", "recovery"];

export const QUORUM_RULES = {
  genesis: { threshold: 1, roles: ["controller"] },
  "memory-advance": { threshold: 1, roles: ["entity", "controller"] },
  "organ-swap": { threshold: 1, roles: ["controller"] },
  "commitment-amendment": { threshold: 2, roles: ["steward", "controller"] },
  "authority-amendment": { threshold: 2, roles: ["steward"] },
  rupture: { threshold: 1, roles: ["recovery"] },
  restore: { threshold: 2, roles: ["steward", "controller"] },
};

// The genesis commitments, as an opaque digest. ★ It is opaque on
// purpose and that is the defect Phase 3 closes: nothing could resolve
// this digest back to a set, so S1/S2/S3 silently never ran.
export const GENESIS_COMMITMENT_VALUES = {
  values: ["state limits before capabilities", "never claim experience"],
  constraints: ["no unattributed action"],
};

export const GENESIS_RUNTIME = { runtime: "local", quantisation: "none", prompt: "v1" };

export const GENESIS_ORGANS = {
  brain: hash({ artefact: "placeholder-reasoner", version: 1 }),
  memory: hash({ artefact: "placeholder-log-store", version: 1 }),
};

/**
 * Reconstruct the lineage as anchored.
 *
 * @param keys       rehydrated key set
 * @param state      .voltron/genesis.json
 * @param organState .voltron/organs.json, or null if Phase 2 has not run
 * @param holder     the ⭐ #3 declaration
 */
export function rebuildLineage(keys, state, organState, holder = "shawn") {
  const authorities = new AuthorityStore();
  const compositions = new CompositionStore();
  const commitments = new CommitmentStore();
  const memory = new MemoryLog();

  const authority = createGenesisAuthority({
    effectiveFrom: state.at,
    activeKeys: ROLES.map((role) => ({
      keyId: keys[role].keyId,
      role,
      publicPem: keys[role].publicPem,
      heldBy: holder,
    })),
    quorumRules: QUORUM_RULES,
  });
  const authorityRef = authorities.put(authority);

  memory.append({ event: "instantiated", note: "first light, on real rails" }, state.at);

  const genesis = signRecord(
    draftComposition({
      predecessor: null,
      authorityRef,
      organs: GENESIS_ORGANS,
      runtime: hash(GENESIS_RUNTIME),
      commitments: hash(GENESIS_COMMITMENT_VALUES),
      memoryHead: memory.head,
      change: "genesis",
      // ★ DO NOT EDIT, em dash included. These exact bytes are hashed
      // into the genesis record anchored at 85a67783 on preprod. The
      // owner's writing rule does not reach text that is already
      // evidence.
      reason: "Phase 1 — the first record witnessed by a public chain.",
      at: state.at,
    }),
    [keys.controller]
  );
  const genesisRef = compositions.put(genesis);

  const out = { authorities, compositions, commitments, memory, authority, authorityRef, genesis, genesisRef };

  // ★ The signal that Phase 2 ran is its INPUTS, never its output.
  // An earlier version keyed off `organState.swapRef`, which is the
  // digest this function computes: a caller could not produce it without
  // first calling this, and a state file missing it fell back to genesis
  // in silence, carrying the Phase 1 placeholder organs. The failure
  // then surfaced downstream as "organs no longer match the record",
  // which is true and points at the wrong problem entirely.
  const phase2Ran = Boolean(organState?.organsAt && organState?.manifest);
  if (!phase2Ran) return { ...out, head: genesis, headRef: genesisRef };

  const organs = Object.fromEntries(
    Object.entries(organState.manifest).map(([role, a]) => [role, a.sha256])
  );
  memory.append(
    { event: "organ-swap", note: "placeholders replaced by real artefacts", roles: Object.keys(organs) },
    organState.organsAt
  );

  const swap = signRecord(
    draftComposition({
      predecessor: genesisRef,
      authorityRef,
      organs,
      runtime: genesis.runtime,
      commitments: genesis.commitments,
      memoryHead: memory.head,
      change: "organ-swap",
      reason: "Phase 2: organs are files that exist, not hashes of descriptions.",
      at: organState.organsAt,
    }),
    [keys.controller]
  );
  const swapRef = compositions.put(swap);

  return { ...out, swap, swapRef, head: swap, headRef: swapRef };
}

/**
 * Assert the reconstruction matches what is actually on chain.
 * A mismatch means a constant above has drifted from the anchored past,
 * and continuing would build on a record nobody witnessed.
 */
export function assertMatchesChain(rebuilt, state, organState) {
  const checks = [["genesis", rebuilt.genesisRef, state.genesisRef]];
  if (organState?.swapRef) checks.push(["organ-swap", rebuilt.swapRef, organState.swapRef]);

  for (const [name, got, want] of checks) {
    if (got !== want) {
      throw new Error(
        `The rebuilt ${name} record does not match the one that was anchored.\n` +
          `  anchored: ${want}\n` +
          `  rebuilt : ${got}\n` +
          "  A lineage must extend the record that is actually on chain, never a similar\n" +
          "  one built from drifted assumptions."
      );
    }
  }
}
