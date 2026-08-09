// The spec §13 scenario, as a reusable fixture: two organs, an authority
// document with a real quorum rule, one memory advance, one brain
// replacement, and a fork.

import { hash } from "./canonical.js";
import { generateKey, signRecord } from "./keys.js";
import { MemoryAnchorStore } from "./anchor.js";
import { MemoryLog } from "./memory.js";
import { AuthorityStore, createGenesisAuthority } from "./authority.js";
import { CompositionStore, draftComposition } from "./composition.js";

/** Stand-in artefacts. A hash does not care how big the thing was. */
export const artefact = (name, version) => hash({ artefact: name, version });

export function buildScenario() {
  const keys = {
    entity: generateKey("entity"),
    controller: generateKey("controller"),
    steward1: generateKey("steward-1"),
    steward2: generateKey("steward-2"),
    recovery: generateKey("recovery"),
    stranger: generateKey("stranger"), // holds no role anywhere
  };

  const anchors = new MemoryAnchorStore();
  const authorities = new AuthorityStore();
  const compositions = new CompositionStore();
  const memory = new MemoryLog();

  // --- Authority: who may do what (spec §5.1) ---------------------------
  const genesisAuthority = createGenesisAuthority({
    effectiveFrom: 1_000,
    activeKeys: [
      { keyId: keys.entity.keyId, role: "entity", publicPem: keys.entity.publicPem },
      { keyId: keys.controller.keyId, role: "controller", publicPem: keys.controller.publicPem },
      { keyId: keys.steward1.keyId, role: "steward", publicPem: keys.steward1.publicPem },
      { keyId: keys.steward2.keyId, role: "steward", publicPem: keys.steward2.publicPem },
      { keyId: keys.recovery.keyId, role: "recovery", publicPem: keys.recovery.publicPem },
    ],
    quorumRules: {
      // The entity may advance its own memory — it authors its history...
      "memory-advance": { threshold: 1, roles: ["entity", "controller"] },
      // ...but may NOT amend its own character alone. That needs a quorum
      // including parties who are not the controller.
      "commitment-amendment": { threshold: 2, roles: ["steward", "controller"] },
      "authority-amendment": { threshold: 2, roles: ["steward"] },
      "organ-swap": { threshold: 1, roles: ["controller"] },
      genesis: { threshold: 1, roles: ["controller"] },
      rupture: { threshold: 1, roles: ["recovery"] },
    },
  });
  const authorityRef = authorities.put(genesisAuthority);
  anchors.anchor(authorityRef, 1_000);

  const ctx = { anchors, authorities, compositions, memory, keys };

  const commitmentsV1 = hash({
    values: ["state limits before capabilities", "never claim experience"],
    constraints: ["no unattributed action"],
  });

  // --- 1. Genesis -------------------------------------------------------
  memory.append({ event: "instantiated", note: "first light" }, 1_010);
  const genesis = signRecord(
    draftComposition({
      predecessor: null,
      authorityRef,
      organs: { brain: artefact("reasoner", 1), memory: artefact("log-store", 1) },
      runtime: hash({ runtime: "local", quantisation: "none", prompt: "v1" }),
      commitments: commitmentsV1,
      memoryHead: memory.head,
      change: "genesis",
      reason: "first composition",
      at: 1_010,
    }),
    [keys.controller]
  );
  const genesisRef = compositions.put(genesis);
  anchors.anchor(genesisRef, 1_010);

  // --- 2. Memory advance (signed by the entity itself) ------------------
  memory.append({ event: "worked a problem", note: "the ledger walk was the answer" }, 1_020);
  const advanced = signRecord(
    draftComposition({
      predecessor: genesisRef,
      authorityRef,
      organs: genesis.organs,
      runtime: genesis.runtime,
      commitments: commitmentsV1,
      memoryHead: memory.head,
      change: "memory-advance",
      reason: "recorded what was learned",
      at: 1_020,
    }),
    [keys.entity]
  );
  const advancedRef = compositions.put(advanced);
  anchors.anchor(advancedRef, 1_020);

  // --- 3. Brain replacement --------------------------------------------
  const swapped = signRecord(
    draftComposition({
      predecessor: advancedRef,
      authorityRef,
      organs: { ...advanced.organs, brain: artefact("reasoner", 2) },
      runtime: hash({ runtime: "local", quantisation: "none", prompt: "v1" }),
      commitments: commitmentsV1,
      memoryHead: memory.head,
      change: "organ-swap",
      reason: "upgraded reasoning; a sharper mind is the same entity thinking better",
      at: 1_030,
    }),
    [keys.controller]
  );
  const swappedRef = compositions.put(swapped);
  anchors.anchor(swappedRef, 1_030);

  return {
    ctx,
    keys,
    refs: { authorityRef, genesisRef, advancedRef, swappedRef },
    commitmentsV1,
  };
}

/** Fork the scenario: two children naming the same predecessor. */
export function fork(scenario) {
  const { ctx, keys, refs } = scenario;
  const parent = ctx.compositions.get(refs.swappedRef);

  const branch = (label, at) => {
    const record = signRecord(
      draftComposition({
        predecessor: refs.swappedRef,
        authorityRef: refs.authorityRef,
        organs: { ...parent.organs, brain: artefact(`reasoner-${label}`, 3) },
        runtime: parent.runtime,
        commitments: parent.commitments,
        memoryHead: parent.memoryHead,
        change: "organ-swap",
        reason: `branch ${label}`,
        at,
      }),
      [keys.controller]
    );
    const ref = ctx.compositions.put(record);
    ctx.anchors.anchor(ref, at);
    return ref;
  };

  return { left: branch("left", 1_040), right: branch("right", 1_041) };
}
