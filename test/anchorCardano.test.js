// The Cardano anchor store — Phase 1.
//
// Every test here runs offline. The env is injected and Blockfrost is a
// stub, because a test that needs a funded wallet is not a test, it is
// a demo. What is being checked is the BEHAVIOUR AT THE BOUNDARY: that
// the verifier's interface survived contact with a real chain, and that
// the new failure modes a chain introduces are handled rather than
// assumed away.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { CardanoAnchorStore, matchesWitness, anchorEnv } from "../src/anchorCardano.js";
import { MemoryAnchorStore } from "../src/anchor.js";
import { hash } from "../src/canonical.js";

const ENV = { network: "preprod", projectId: "preprodTEST", mnemonic: "test words" };
const D1 = "a".repeat(64);
const D2 = "b".repeat(64);

/** A stubbed chain: transactions in block order, each with metadata. */
function stubChain(txs) {
  return async (path) => {
    if (path.includes("/transactions")) {
      const page = Number(path.match(/page=(\d+)/)?.[1] ?? 1);
      return page === 1 ? txs.map(({ metadata, ...tx }) => tx) : [];
    }
    const txHash = path.match(/\/txs\/([^/]+)\/metadata/)?.[1];
    return txs.find((t) => t.tx_hash === txHash)?.metadata ?? null;
  };
}

const anchorTx = (tx_hash, digest, height, time) => ({
  tx_hash,
  block_height: height,
  block_time: time,
  metadata: [{ label: "674", json_metadata: { tag: "voltron:composition", digest } }],
});

/** A store with a stubbed address, so no wallet or key is ever built. */
function storeWith(txs) {
  const store = new CardanoAnchorStore(ENV);
  store.address = async () => "addr_test1_stub";
  return { store, fetchJson: stubChain(txs) };
}

describe("the interface the verifier depends on", () => {
  test("★ isAnchored and positionOf stay synchronous, exactly as in memory", async () => {
    const { store, fetchJson } = storeWith([anchorTx("tx1", D1, 100, 1_000)]);
    await store.load({ fetchJson });

    // No await on these two. That is the whole claim the boundary made.
    assert.equal(store.isAnchored(D1), true);
    assert.equal(store.isAnchored(D2), false);
    assert.equal(store.positionOf(D1), 1);
    assert.equal(store.positionOf(D2), null);

    // And the shape matches the store it replaces.
    const memory = new MemoryAnchorStore();
    for (const method of ["isAnchored", "positionOf"]) {
      assert.equal(typeof store[method], "function");
      assert.equal(typeof memory[method], "function");
    }
  });

  test("★ an unloaded store THROWS rather than answering false", () => {
    const store = new CardanoAnchorStore(ENV);
    // The load-bearing distinction: "absent" and "unchecked" are not
    // the same answer, and a verifier must never be handed the second
    // dressed as the first.
    assert.throws(() => store.isAnchored(D1), /has not loaded/);
    assert.throws(() => store.positionOf(D1), /has not loaded/);
    assert.equal(store.loaded, false);
  });
});

describe("ordering comes from the chain, not from us", () => {
  test("sequence follows block order", async () => {
    const { store, fetchJson } = storeWith([
      anchorTx("tx1", D1, 100, 1_000),
      anchorTx("tx2", D2, 105, 2_000),
    ]);
    await store.load({ fetchJson });

    assert.equal(store.positionOf(D1), 1);
    assert.equal(store.positionOf(D2), 2);
    assert.equal(store.witnessOf(D1).block, 100);
  });

  test("★ re-anchoring never moves a position — first witness wins", async () => {
    const { store, fetchJson } = storeWith([
      anchorTx("tx1", D1, 100, 1_000),
      anchorTx("tx2", D2, 101, 1_500),
      anchorTx("tx3", D1, 200, 9_999), // the same digest, anchored again later
    ]);
    await store.load({ fetchJson });

    // If a second payment could re-position a digest, ordering would be
    // purchasable, and the chain's only real contribution would be gone.
    assert.equal(store.positionOf(D1), 1);
    assert.equal(store.witnessOf(D1).txHash, "tx1");
    assert.equal(store.size, 2);
  });
});

describe("what it refuses to count", () => {
  test("metadata under another label, tag, or shape is ignored", async () => {
    const { store, fetchJson } = storeWith([
      { tx_hash: "t1", block_height: 1, block_time: 1, metadata: [{ label: "721", json_metadata: { tag: "voltron:composition", digest: D1 } }] },
      { tx_hash: "t2", block_height: 2, block_time: 2, metadata: [{ label: "674", json_metadata: { tag: "someone-else", digest: D2 } }] },
      { tx_hash: "t3", block_height: 3, block_time: 3, metadata: [{ label: "674", json_metadata: { tag: "voltron:composition", digest: "not-a-digest" } }] },
      { tx_hash: "t4", block_height: 4, block_time: 4, metadata: null },
    ]);
    await store.load({ fetchJson });

    assert.equal(store.size, 0);
    assert.equal(store.isAnchored(D1), false);
  });

  test("★ a Blockfrost outage throws — it must never read as 'not anchored'", async () => {
    const store = new CardanoAnchorStore(ENV);
    store.address = async () => "addr_test1_stub";
    const failing = async () => {
      throw new Error("Blockfrost /addresses failed (500).");
    };
    await assert.rejects(() => store.load({ fetchJson: failing }), /500/);
    // And having failed, it is still unloaded — not silently empty.
    assert.equal(store.loaded, false);
    assert.throws(() => store.isAnchored(D1), /has not loaded/);
  });
});

describe("the environment refuses to reach real money", () => {
  const withEnv = (vars, fn) => {
    const saved = { ...process.env };
    Object.assign(process.env, vars);
    try {
      fn();
    } finally {
      process.env = saved;
    }
  };

  test("★ mainnet is refused outright", () => {
    withEnv({ CARDANO_NETWORK: "mainnet", BLOCKFROST_PROJECT_ID: "mainnetX", VOLTRON_MINT_MNEMONIC: "w" }, () => {
      assert.throws(anchorEnv, /not a testnet/);
    });
  });

  test("a mainnet project key is refused even on a testnet network", () => {
    withEnv({ CARDANO_NETWORK: "preprod", BLOCKFROST_PROJECT_ID: "mainnetABC", VOLTRON_MINT_MNEMONIC: "w" }, () => {
      assert.throws(anchorEnv, /not a testnet key/);
    });
  });

  test("★ the missing-mnemonic message names the separation it protects", () => {
    withEnv({ CARDANO_NETWORK: "preprod", BLOCKFROST_PROJECT_ID: "preprodABC", VOLTRON_MINT_MNEMONIC: "" }, () => {
      assert.throws(anchorEnv, /never AgoraNet's TESTNET_MINT_MNEMONIC/);
    });
  });
});

describe("submission is not anchoring", () => {
  test("★ a digest that is not sha256 is refused before any fee is spent", async () => {
    const { store } = storeWith([]);
    await assert.rejects(() => store.anchor("short"), /Not a sha256 digest/);
    // 64 chars exactly — metadata strings cap there, with no headroom.
    assert.equal(D1.length, 64);
  });

  test("awaitConfirmation returns null rather than claiming success", async () => {
    const { store, fetchJson } = storeWith([]); // nothing on chain
    store.load = async () => ({ anchors: 0 });
    const witness = await store.awaitConfirmation(D1, { attempts: 2, sleep: async () => {} });
    assert.equal(witness, null);
  });
});

describe("the anchor still carries no content", () => {
  test("★ only re-hashing proves THIS record is the witnessed thing", async () => {
    const record = { change: "genesis", reason: "the first one" };
    const digest = hash(record);
    const { store, fetchJson } = storeWith([anchorTx("tx1", digest, 1, 1)]);
    await store.load({ fetchJson });

    assert.equal(store.isAnchored(digest), true);
    assert.equal(matchesWitness(record, digest), true);
    // The chain witnessed a digest. It cannot hand the record back, and
    // a tampered record no longer matches the thing that was witnessed.
    assert.equal(matchesWitness({ ...record, reason: "altered" }, digest), false);
  });
});
