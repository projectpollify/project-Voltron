// Phase 2: organs as real files.
//
// The rules already worked over placeholder digests. What is tested here
// is the part that placeholders could never exercise: that a pin refers
// to something in the world, and that substituting the world is caught.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashFile, describeArtefact, buildOrgans, verifyOrgans } from "../src/artefacts.js";
import { serialiseKeys, deserialiseKeys, keysAreUsable } from "../src/keystore.js";
import { generateKey, sign, verify } from "../src/keys.js";
import { hash } from "../src/canonical.js";

const scratch = () => mkdtempSync(join(tmpdir(), "voltron-"));

describe("hashing a real file", () => {
  test("the hash is of the contents, and matches hashing the bytes directly", async () => {
    const dir = scratch();
    const path = join(dir, "organ.md");
    writeFileSync(path, "the reasoner, v1\n");

    const { createHash } = await import("node:crypto");
    const expected = createHash("sha256").update("the reasoner, v1\n").digest("hex");
    assert.equal(await hashFile(path), expected);

    rmSync(dir, { recursive: true, force: true });
  });

  test("★ the path is not part of the identity", async () => {
    const a = scratch();
    const b = scratch();
    writeFileSync(join(a, "brain.md"), "same bytes");
    writeFileSync(join(b, "totally-different-name.txt"), "same bytes");

    const one = await describeArtefact(join(a, "brain.md"));
    const two = await describeArtefact(join(b, "totally-different-name.txt"));

    // Moving or renaming a file must not change the organ. If the path
    // were hashed, identity would depend on filesystem layout, which is
    // not a property of the artefact.
    assert.equal(one.sha256, two.sha256);
    assert.notEqual(one.name, two.name);

    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  });

  test("a single changed byte changes the organ", async () => {
    const dir = scratch();
    const path = join(dir, "organ.md");
    writeFileSync(path, "version one");
    const before = await hashFile(path);
    writeFileSync(path, "version onf");
    assert.notEqual(await hashFile(path), before);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("the organ set", () => {
  test("real repo artefacts build an organ set", async () => {
    const { organs, manifest } = await buildOrgans({
      brain: "organs/reasoner.prompt.md",
      tools: "organs/tools.manifest.json",
    });

    assert.match(organs.brain, /^[0-9a-f]{64}$/);
    assert.match(organs.tools, /^[0-9a-f]{64}$/);
    assert.notEqual(organs.brain, organs.tools);
    assert.ok(manifest.brain.bytes > 0);
    assert.equal(manifest.brain.name, "reasoner.prompt.md");
  });

  test("★ an organ set of real files verifies against disk", async () => {
    const paths = { brain: "organs/reasoner.prompt.md", tools: "organs/tools.manifest.json" };
    const { organs } = await buildOrgans(paths);
    const result = await verifyOrgans(organs, paths);

    assert.equal(result.ok, true);
    assert.equal(result.checked, 2);
    assert.deepEqual(result.changed, []);
  });
});

describe("★ substituting the world is caught", () => {
  test("a swapped file fails, and the failure names which organ moved", async () => {
    const dir = scratch();
    const path = join(dir, "brain.md");
    writeFileSync(path, "the endorsed reasoner");

    const paths = { brain: path };
    const { organs } = await buildOrgans(paths);

    // Someone edits the artefact without amending the record. Every
    // rule in the verifier still passes, because the record did not
    // change. Only re-hashing the world catches this.
    writeFileSync(path, "a quietly different reasoner");

    const result = await verifyOrgans(organs, paths);
    assert.equal(result.ok, false);
    assert.deepEqual(result.changed, ["brain"]);
    assert.deepEqual(result.unchecked, []);

    const finding = result.results.find((r) => r.role === "brain");
    assert.match(finding.reason, /replaced or edited/);
    assert.equal(finding.expected, organs.brain);
    assert.notEqual(finding.actual, organs.brain);

    rmSync(dir, { recursive: true, force: true });
  });

  test("★ a missing file is UNCHECKED, not 'changed'", async () => {
    const { organs } = await buildOrgans({ brain: "organs/reasoner.prompt.md" });
    const result = await verifyOrgans(organs, { brain: "organs/does-not-exist.md" });

    assert.equal(result.ok, false);
    // The distinction that matters: one is evidence the artefact moved,
    // the other is the absence of evidence either way. A verifier that
    // could not read an artefact must not report that it checked it.
    assert.deepEqual(result.changed, []);
    assert.deepEqual(result.unchecked, ["brain"]);
    assert.equal(result.checked, 0);
  });

  test("an organ with no file mapped is refused rather than skipped", async () => {
    const { organs } = await buildOrgans({ brain: "organs/reasoner.prompt.md" });
    const result = await verifyOrgans({ ...organs, memory: "a".repeat(64) }, {
      brain: "organs/reasoner.prompt.md",
    });

    assert.equal(result.ok, false);
    const finding = result.results.find((r) => r.role === "memory");
    assert.match(finding.reason, /no file is mapped/);
  });
});

describe("★ keys survive a round trip through JSON", () => {
  test("the KeyObject bug: a naive save drops the private key silently", () => {
    const key = generateKey("controller");
    const naive = JSON.parse(JSON.stringify({ controller: key }));

    // This is what Phase 1 wrote to disk. It looks almost right.
    assert.equal(naive.controller.keyId, key.keyId);
    assert.ok(naive.controller.publicPem);
    // And the one thing that matters is gone, with no error anywhere.
    assert.deepEqual(naive.controller.privateKey, {});
    assert.equal(keysAreUsable(naive), false);
  });

  test("serialised keys reload and still sign", () => {
    const keys = { controller: generateKey("controller"), entity: generateKey("entity") };
    const reloaded = deserialiseKeys(JSON.parse(JSON.stringify(serialiseKeys(keys))));

    assert.equal(reloaded.controller.keyId, keys.controller.keyId);

    const payload = hash({ some: "record" });
    const signature = sign(reloaded.controller, payload);
    assert.equal(verify(keys.controller.publicPem, payload, signature), true);
  });

  test("serialising a key with no private half is refused, not silently written", () => {
    const key = generateKey("controller");
    assert.throws(
      () => serialiseKeys({ controller: { ...key, privateKey: undefined } }),
      /looks complete and cannot sign/
    );
  });

  test("★ a tampered public half is rejected, since a keyId is derived and never asserted", () => {
    const keys = { controller: generateKey("controller") };
    const saved = serialiseKeys(keys);
    saved.controller.publicPem = generateKey("someone-else").publicPem;

    assert.throws(() => deserialiseKeys(saved), /does not match/);
  });

  test("a state file written by the old buggy path fails loudly on load", () => {
    const broken = { controller: { keyId: "abc", publicPem: "x", privateKey: {} } };
    assert.throws(() => deserialiseKeys(broken), /JSON.stringify\(KeyObject\) failure/);
  });
});

describe("★ the organ-swap record verifies before any fee is spent", () => {
  // Phase 1's bugs were found only by running it. This builds the exact
  // record shape `scripts/anchor-organs.js` submits and puts it through
  // the real verifier with an in-memory anchor store, so a structural
  // mistake costs nothing instead of costing a transaction.
  test("genesis then organ-swap: V1 through V6 pass on both", async () => {
    const { MemoryAnchorStore } = await import("../src/anchor.js");
    const { MemoryLog } = await import("../src/memory.js");
    const { AuthorityStore, createGenesisAuthority } = await import("../src/authority.js");
    const { CompositionStore, draftComposition } = await import("../src/composition.js");
    const { signRecord } = await import("../src/keys.js");
    const { verifyRecord } = await import("../src/verifier.js");

    const ROLES = ["entity", "controller", "steward", "recovery"];
    const keys = Object.fromEntries(ROLES.map((r) => [r, generateKey(r)]));
    const at = 1_770_000_000;

    const anchors = new MemoryAnchorStore();
    const authorities = new AuthorityStore();
    const compositions = new CompositionStore();
    const memory = new MemoryLog();

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
    const commitments = hash({ values: ["v"], constraints: ["c"] });
    const runtime = hash({ runtime: "local" });

    const genesis = signRecord(
      draftComposition({
        predecessor: null,
        authorityRef,
        organs: { brain: hash({ artefact: "placeholder" }) },
        runtime,
        commitments,
        memoryHead: memory.head,
        change: "genesis",
        reason: "placeholder organs",
        at,
      }),
      [keys.controller]
    );
    const genesisRef = compositions.put(genesis);
    anchors.anchor(genesisRef, at);

    // The swap: real files, everything else held constant.
    const { organs } = await buildOrgans({
      brain: "organs/reasoner.prompt.md",
      tools: "organs/tools.manifest.json",
    });
    memory.append({ event: "organ-swap" }, at + 1);

    const swap = signRecord(
      draftComposition({
        predecessor: genesisRef,
        authorityRef,
        organs,
        runtime,
        commitments, // unchanged: V4 refuses a commitment change under organ-swap
        memoryHead: memory.head,
        change: "organ-swap",
        reason: "organs are files that exist",
        at: at + 1,
      }),
      [keys.controller]
    );
    const swapRef = compositions.put(swap);
    anchors.anchor(swapRef, at + 1);

    const ctx = { compositions, authorities, anchors, memory };
    assert.equal(verifyRecord(ctx, genesisRef).ok, true);

    const result = verifyRecord(ctx, swapRef);
    assert.equal(result.ok, true, JSON.stringify(result.checks, null, 2));

    const rules = new Set(result.checks.map((c) => c.rule));
    assert.deepEqual([...rules].sort(), ["V1", "V2", "V3", "V4", "V5", "V6"]);

    // The ⭐ #3 qualifier must survive onto every record, not just genesis.
    const v3 = result.checks.find((c) => c.rule === "V3");
    assert.match(v3.note, /ALL HELD BY ONE DECLARED HOLDER/);

    // And the organs it pins are the files on disk, right now.
    const onDisk = await verifyOrgans(swap.organs, {
      brain: "organs/reasoner.prompt.md",
      tools: "organs/tools.manifest.json",
    });
    assert.equal(onDisk.ok, true);
  });
});
