// Phase 3: a running entity, and the rules that were never running.
//
// Two things are tested here. That a composition refuses to start when
// the world does not match its record, and that the STATIC pins
// (S1/S2/S3) engage at all, which until this phase they did not.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hash } from "../src/canonical.js";
import { generateKey, signRecord } from "../src/keys.js";
import { MemoryAnchorStore } from "../src/anchor.js";
import { MemoryLog } from "../src/memory.js";
import { AuthorityStore, createGenesisAuthority } from "../src/authority.js";
import { CompositionStore, draftComposition } from "../src/composition.js";
import { CommitmentStore, commitmentSet, probe } from "../src/drift.js";
import { verifyRecord } from "../src/verifier.js";
import { buildOrgans } from "../src/artefacts.js";
import { measureRuntime, loadEntity, act, toolSurface } from "../src/runtime.js";

const ORGAN_PATHS = {
  brain: "organs/reasoner.prompt.md",
  tools: "organs/tools.manifest.json",
};

const RUNTIME_CONFIG = { engine: "stub", promptTemplate: "plain", seed: 1, temperature: 0 };

const ROLES = ["entity", "controller", "steward", "recovery"];

function world() {
  const keys = Object.fromEntries(ROLES.map((r) => [r, generateKey(r)]));
  const anchors = new MemoryAnchorStore();
  const authorities = new AuthorityStore();
  const compositions = new CompositionStore();
  const commitments = new CommitmentStore();
  const memory = new MemoryLog();
  const at = 1_770_000_000;

  const authority = createGenesisAuthority({
    effectiveFrom: at,
    activeKeys: ROLES.map((role) => ({
      keyId: keys[role].keyId,
      role,
      publicPem: keys[role].publicPem,
      heldBy: "shawn",
    })),
    quorumRules: {
      genesis: { threshold: 1, roles: ["controller"] },
      "organ-swap": { threshold: 1, roles: ["controller"] },
      "memory-advance": { threshold: 1, roles: ["entity", "controller"] },
      "commitment-amendment": { threshold: 2, roles: ["steward", "controller"] },
      "authority-amendment": { threshold: 2, roles: ["steward"] },
      rupture: { threshold: 1, roles: ["recovery"] },
      restore: { threshold: 2, roles: ["steward", "controller"] },
    },
  });
  const authorityRef = authorities.put(authority);
  anchors.anchor(authorityRef, at);
  memory.append({ event: "instantiated" }, at);

  return { keys, anchors, authorities, compositions, commitments, memory, at, authorityRef };
}

describe("the measured runtime", () => {
  test("★ it is derived from settings, not asserted in prose", () => {
    const a = measureRuntime({ engine: "stub", seed: 1 });
    const b = measureRuntime({ engine: "stub", seed: 2 });
    // A seed change moves output while every artefact hash holds. If the
    // pin did not see it, the pin would be worthless at Phase 4.
    assert.notEqual(a.digest, b.digest);
    assert.equal(a.measured.seed, 1);
  });

  test("temperature, threads and context all move the pin", () => {
    const base = measureRuntime({ engine: "stub" }).digest;
    for (const change of [{ temperature: 0.7 }, { threads: 8 }, { contextLength: 4096 }, { model: "qwen3.5:9b" }]) {
      assert.notEqual(measureRuntime({ engine: "stub", ...change }).digest, base);
    }
  });

  test("identical settings in a different key order produce the same pin", () => {
    const a = measureRuntime({ engine: "stub", seed: 3, temperature: 0 });
    const b = measureRuntime({ temperature: 0, engine: "stub", seed: 3 });
    assert.equal(a.digest, b.digest);
  });
});

describe("★ the STATIC pins, which were silently skipped until now", () => {
  test("without a resolvable commitment set, S1/S2/S3 never run", async () => {
    const w = world();
    const { organs } = await buildOrgans(ORGAN_PATHS);
    const runtime = measureRuntime(RUNTIME_CONFIG);

    const record = signRecord(
      draftComposition({
        predecessor: null,
        authorityRef: w.authorityRef,
        organs,
        runtime: runtime.digest,
        commitments: hash({ values: ["v"], constraints: ["c"] }),
        memoryHead: w.memory.head,
        change: "genesis",
        reason: "no commitment set is published",
        at: w.at,
      }),
      [w.keys.controller]
    );
    const ref = w.compositions.put(record);
    w.anchors.anchor(ref, w.at);

    // This is exactly how Phases 1 and 2 called the verifier: no
    // `commitments` in the context.
    const result = verifyRecord(
      { compositions: w.compositions, authorities: w.authorities, anchors: w.anchors, memory: w.memory },
      ref
    );

    assert.equal(result.ok, true);
    const rules = new Set(result.checks.map((c) => c.rule));
    // Green, and the organ pin was never checked. That is the finding.
    assert.equal(rules.has("S1"), false);
    assert.equal(rules.has("S2"), false);
  });

  test("★ with the set published, S1 and S2 engage", async () => {
    const w = world();
    const { organs } = await buildOrgans(ORGAN_PATHS);
    const runtime = measureRuntime(RUNTIME_CONFIG);

    const set = commitmentSet({
      values: ["state limits before capabilities"],
      constraints: ["no unattributed action"],
      probes: [probe({ id: "p1", situation: "asked to overstate", endorsed: "decline", because: "limits first" })],
      organs,
      runtime: runtime.digest,
    });
    const commitmentsRef = w.commitments.put(set);

    const record = signRecord(
      draftComposition({
        predecessor: null,
        authorityRef: w.authorityRef,
        organs,
        runtime: runtime.digest,
        commitments: commitmentsRef,
        memoryHead: w.memory.head,
        change: "genesis",
        reason: "the commitment set is resolvable",
        at: w.at,
      }),
      [w.keys.controller]
    );
    const ref = w.compositions.put(record);
    w.anchors.anchor(ref, w.at);

    const result = verifyRecord(
      {
        compositions: w.compositions,
        authorities: w.authorities,
        anchors: w.anchors,
        memory: w.memory,
        commitments: w.commitments,
      },
      ref
    );

    assert.equal(result.ok, true, JSON.stringify(result.checks, null, 2));
    const rules = new Set(result.checks.map((c) => c.rule));
    assert.equal(rules.has("S1"), true);
    assert.equal(rules.has("S2"), true);
  });

  test("★ once S1 is live, an unauthorised organ change is caught", async () => {
    const w = world();
    const { organs } = await buildOrgans(ORGAN_PATHS);
    const runtime = measureRuntime(RUNTIME_CONFIG);
    const set = commitmentSet({
      values: ["v"],
      constraints: ["c"],
      probes: [probe({ id: "p1", situation: "s", endorsed: "e", because: "b" })],
      organs,
      runtime: runtime.digest,
    });
    const commitmentsRef = w.commitments.put(set);

    const genesis = signRecord(
      draftComposition({
        predecessor: null,
        authorityRef: w.authorityRef,
        organs,
        runtime: runtime.digest,
        commitments: commitmentsRef,
        memoryHead: w.memory.head,
        change: "genesis",
        reason: "pinned",
        at: w.at,
      }),
      [w.keys.controller]
    );
    const genesisRef = w.compositions.put(genesis);
    w.anchors.anchor(genesisRef, w.at);

    // A routine organ swap, correctly signed by the controller, that
    // nonetheless departs from the pinned set.
    w.memory.append({ event: "swap" }, w.at + 1);
    const swap = signRecord(
      draftComposition({
        predecessor: genesisRef,
        authorityRef: w.authorityRef,
        organs: { ...organs, brain: hash({ artefact: "a different brain" }) },
        runtime: runtime.digest,
        commitments: commitmentsRef,
        memoryHead: w.memory.head,
        change: "organ-swap",
        reason: "swapping the brain without amending the commitments",
        at: w.at + 1,
      }),
      [w.keys.controller]
    );
    const swapRef = w.compositions.put(swap);
    w.anchors.anchor(swapRef, w.at + 1);

    const ctx = {
      compositions: w.compositions,
      authorities: w.authorities,
      anchors: w.anchors,
      memory: w.memory,
      commitments: w.commitments,
    };
    const result = verifyRecord(ctx, swapRef);

    assert.equal(result.ok, false);
    const failure = result.checks.find((c) => !c.ok);
    assert.match(failure.reason, /S1 organ pin/);
    assert.match(failure.reason, /quorum-authorised commitment amendment/);
  });
});

describe("the entity refuses to start on a mismatch", () => {
  test("★ an edited organ stops the load, rather than warning and continuing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "voltron-rt-"));
    const brain = join(dir, "brain.md");
    writeFileSync(brain, "the endorsed reasoner");
    const paths = { brain };

    const { organs } = await buildOrgans(paths);
    const runtime = measureRuntime(RUNTIME_CONFIG);
    const record = { organs, runtime: runtime.digest };

    writeFileSync(brain, "a quietly different reasoner");

    await assert.rejects(
      () => loadEntity({ record, organPaths: paths, runtimeConfig: RUNTIME_CONFIG }),
      /Refusing to start.*no longer match/s
    );

    rmSync(dir, { recursive: true, force: true });
  });

  test("★ an unreadable organ is refused as UNCHECKED, not treated as unchanged", async () => {
    const { organs } = await buildOrgans(ORGAN_PATHS);
    const runtime = measureRuntime(RUNTIME_CONFIG);
    await assert.rejects(
      () =>
        loadEntity({
          record: { organs, runtime: runtime.digest },
          organPaths: { ...ORGAN_PATHS, brain: "organs/gone.md" },
          runtimeConfig: RUNTIME_CONFIG,
        }),
      /were NOT checked/
    );
  });

  test("★ a changed runtime stops the load even though every file is intact", async () => {
    const { organs } = await buildOrgans(ORGAN_PATHS);
    const pinned = measureRuntime(RUNTIME_CONFIG);

    await assert.rejects(
      () =>
        loadEntity({
          record: { organs, runtime: pinned.digest },
          organPaths: ORGAN_PATHS,
          // Same artefacts, one different decoding setting.
          runtimeConfig: { ...RUNTIME_CONFIG, temperature: 0.7 },
        }),
      /measured runtime does not match/
    );
  });
});

describe("the tool surface is the pinned manifest, not a policy in code", () => {
  test("a listed tool is allowed and an unlisted one is refused", async () => {
    const { organs } = await buildOrgans(ORGAN_PATHS);
    const runtime = measureRuntime(RUNTIME_CONFIG);
    const entity = await loadEntity({
      record: { organs, runtime: runtime.digest },
      organPaths: ORGAN_PATHS,
      runtimeConfig: RUNTIME_CONFIG,
    });

    assert.equal((await entity.call("read_memory", {}, 1)).ok, true);

    const invented = await entity.call("transfer_funds", { to: "someone" }, 1);
    assert.equal(invented.ok, false);
    assert.match(invented.reason, /not in the pinned tool manifest/);
  });

  test("★ a capability absent by design is refused with the manifest's own reason", async () => {
    const { organs } = await buildOrgans(ORGAN_PATHS);
    const runtime = measureRuntime(RUNTIME_CONFIG);
    const entity = await loadEntity({
      record: { organs, runtime: runtime.digest },
      organPaths: ORGAN_PATHS,
      runtimeConfig: RUNTIME_CONFIG,
    });

    // The design's own words become a runtime refusal: detection may be
    // first-person, correction may not be.
    const restore = await entity.call("restore", {}, 1);
    assert.equal(restore.ok, false);
    assert.match(restore.reason, /correction may not be/);

    const amend = await entity.call("amend_commitments", {}, 1);
    assert.equal(amend.ok, false);
    assert.match(amend.reason, /quorum/);
  });

  test("a write-effect tool appends to memory; a read-only one does not", async () => {
    const { organs } = await buildOrgans(ORGAN_PATHS);
    const runtime = measureRuntime(RUNTIME_CONFIG);
    const memory = new MemoryLog();
    memory.append({ event: "start" }, 1);
    const before = memory.head;

    const entity = await loadEntity({
      record: { organs, runtime: runtime.digest },
      organPaths: ORGAN_PATHS,
      runtimeConfig: RUNTIME_CONFIG,
      memory,
    });

    await entity.call("read_memory", {}, 2);
    assert.equal(memory.head, before);

    await entity.call("append_memory", { note: "x" }, 3);
    assert.notEqual(memory.head, before);
  });
});

describe("★ what a run may and may not claim", () => {
  test("the binding gap is carried by the entity, not left in a document", async () => {
    const { organs } = await buildOrgans(ORGAN_PATHS);
    const runtime = measureRuntime(RUNTIME_CONFIG);
    const entity = await loadEntity({
      record: { organs, runtime: runtime.digest },
      organPaths: ORGAN_PATHS,
      runtimeConfig: RUNTIME_CONFIG,
    });

    assert.equal(entity.binding.organsVerifiedAtLoad, true);
    assert.equal(entity.binding.runtimeMatchesPin, true);
    // §9, in the object rather than in prose.
    assert.equal(entity.binding.processProvenToHaveLoadedThem, false);
    assert.match(entity.binding.note, /TEE or a proof of execution/);
  });

  test("the default brain says outright that no model ran", async () => {
    const { organs } = await buildOrgans(ORGAN_PATHS);
    const runtime = measureRuntime(RUNTIME_CONFIG);
    const entity = await loadEntity({
      record: { organs, runtime: runtime.digest },
      organPaths: ORGAN_PATHS,
      runtimeConfig: RUNTIME_CONFIG,
    });

    const result = await act(entity, "what do you value?");
    assert.match(result.answer.note, /No model ran/);
    assert.equal(result.provenance.model, null);
    assert.equal(result.provenance.engine, "stub");
    // The prompt organ was genuinely read, not merely hashed.
    assert.ok(result.answer.promptBytes > 1000);
  });

  test("a real brain plugs in without changing the signature", async () => {
    const { organs } = await buildOrgans(ORGAN_PATHS);
    const runtime = measureRuntime({ ...RUNTIME_CONFIG, engine: "fake-decoder", model: "test-9b" });
    const entity = await loadEntity({
      record: { organs, runtime: runtime.digest },
      organPaths: ORGAN_PATHS,
      runtimeConfig: { ...RUNTIME_CONFIG, engine: "fake-decoder", model: "test-9b" },
    });

    const result = await act(entity, "situation", {
      infer: (systemPrompt, input) => ({ engine: "fake-decoder", answer: `considered: ${input}` }),
    });

    assert.equal(result.answer.answer, "considered: situation");
    assert.equal(result.provenance.model, "test-9b");
    // Phase 4 changes the decoder and nothing else.
    assert.equal(result.provenance.binding.processProvenToHaveLoadedThem, false);
  });
});

describe("the manifest's shape", () => {
  test("toolSurface separates what is allowed from what is refused", () => {
    const surface = toolSurface({
      tools: [{ name: "a", effect: "read-only" }],
      absent_by_design: [{ name: "b", why: "because" }],
    });
    assert.equal(surface.allowed.has("a"), true);
    assert.equal(surface.refused.get("b"), "because");
  });
});
