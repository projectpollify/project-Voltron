// The Cardano anchor store — Phase 1 (BUILD_ORDER.md).
//
// This is the file that stops the system pretending. Everything else
// was already real; `MemoryAnchorStore` was a variable in a process,
// and a witness that disappears when you close the laptop is not a
// witness. This replaces it with Cardano preprod, where the record is
// public, ordered by consensus, and checkable by someone who has never
// heard of us.
//
// ★ WHAT CHANGED IN WHAT AN ANCHOR PROVES: nothing. Spec §8 still
// governs — "durable public ordering and tamper-evidence and NOTHING
// ELSE." Not availability, not authorisation, not uniqueness, not
// meaning. What changed is WHO CAN CHECK IT. That is the entire gain,
// and it is worth the whole phase.
//
// ★ THE INTERFACE HELD, BUT IT WAS TESTED. `MemoryAnchorStore` was
// written as a boundary on the claim that swapping in a real chain
// "must not change a single line of the verifier." That claim survives
// — but only because of a decision made here rather than a property
// that came free:
//
//   `isAnchored()` is SYNCHRONOUS and the verifier calls it that way.
//   A chain lookup is not synchronous. So this store answers from a
//   LOCALLY MATERIALISED VIEW of the chain, built by `load()`, and
//   `load()` is the async part. The verifier stayed untouched; the
//   asynchrony moved to a point the verifier never reaches.
//
// That is honest, and it has a consequence worth stating plainly: the
// verifier checks against a view someone fetched, not against the chain
// itself. A stale view is a wrong answer. `load()` is therefore not
// setup — it is part of the verification, and a caller that skips it
// is verifying against nothing.
//
// ★ WHAT THIS FILE STILL DOES NOT GIVE YOU. The metadata carries the
// DIGEST, never the record. Lose the composition record and the anchor
// proves only that some digest existed — it cannot hand back the
// content, and no amount of chain makes it. Anchoring is witness.
// Storage is a different problem, deliberately unsolved (§8, and
// BUILD_ORDER Phase 2's open question).

import { hash } from "./canonical.js";

/** sha256 hex is 64 characters. Cardano metadata strings cap at 64
 *  bytes. It fits EXACTLY — with zero headroom, which is luck rather
 *  than design, so it is asserted rather than assumed. Any future move
 *  to a longer digest must chunk the string, and this check is what
 *  will make that failure loud instead of silent truncation. */
const DIGEST_RE = /^[0-9a-f]{64}$/;
const METADATA_LABEL = 674; // CIP-20 message standard, as AgoraNet uses
const ANCHOR_TAG = "voltron:composition";

const TESTNETS = new Set(["preprod", "preview"]);

/**
 * Environment, read inside the function rather than at module load —
 * the same lesson AgoraNet's chainMint.ts records: script callers load
 * `.env` after imports are hoisted, so a top-level read sees undefined.
 *
 * The refusals are deliberate and not merely defensive. This project
 * has a standing rule of no mainnet, and a rule that is enforced only
 * by remembering it is not a rule. A misconfigured environment must
 * fail loudly rather than quietly reach a real network with real money.
 */
export function anchorEnv() {
  const network = process.env.CARDANO_NETWORK ?? "preprod";
  const projectId = process.env.BLOCKFROST_PROJECT_ID;
  const mnemonic = process.env.VOLTRON_MINT_MNEMONIC;

  if (!TESTNETS.has(network)) {
    throw new Error(
      `Refusing to run: CARDANO_NETWORK="${network}" is not a testnet. ` +
        "Voltron has no mainnet posture at all."
    );
  }
  if (!projectId) {
    throw new Error("BLOCKFROST_PROJECT_ID is not set (put it in .env — never in a tracked file).");
  }
  if (!projectId.startsWith("preprod") && !projectId.startsWith("preview")) {
    throw new Error("Refusing to run: BLOCKFROST_PROJECT_ID is not a testnet key.");
  }
  if (!mnemonic) {
    throw new Error(
      "VOLTRON_MINT_MNEMONIC is not set. Voltron uses its OWN preprod wallet — " +
        "never AgoraNet's TESTNET_MINT_MNEMONIC. Separate corpora, separate keys."
    );
  }
  return { network, projectId, mnemonic };
}

const apiBase = (network) => `https://cardano-${network}.blockfrost.io/api/v0`;

async function blockfrost(path, { network, projectId }) {
  const res = await fetch(`${apiBase(network)}${path}`, {
    headers: { project_id: projectId },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    // An outage must never read as "not anchored" — that would turn a
    // network blip into a verification failure, which is exactly the
    // kind of quiet wrongness this project exists to avoid.
    throw new Error(`Blockfrost ${path} failed (${res.status}).`);
  }
  return res.json();
}

/**
 * The Cardano anchor store.
 *
 * Deliberately the SAME SHAPE as MemoryAnchorStore for everything the
 * verifier touches: `isAnchored` and `positionOf` stay synchronous and
 * total. What is new is async and sits outside the verifier's path —
 * `load()` to materialise the view, `anchor()` to submit.
 */
export class CardanoAnchorStore {
  #anchored = new Map(); // digest -> { seq, at, txHash, block }
  #loaded = false;
  #env;
  #wallet = null;
  #address = null;

  constructor(env = null) {
    // Injectable so tests never touch a network or a key.
    this.#env = env;
  }

  #config() {
    return (this.#env ??= anchorEnv());
  }

  // ------------------------------------------------------------ read

  /**
   * Materialise the chain's view of our anchors.
   *
   * ORDERING. `seq` comes from the chain's own ordering (block height,
   * then position within the block), NOT from our arrival order. That
   * matters: the whole point of a public chain is that the sequence is
   * one other people can independently reproduce. A locally-assigned
   * counter would look identical and mean nothing.
   *
   * CONFIRMATION. Only transactions in a block are counted. A submitted
   * transaction is not an anchor — see `anchor()`.
   */
  async load({ fetchJson = blockfrost } = {}) {
    const env = this.#config();
    const address = await this.address();

    const txs = [];
    for (let page = 1; ; page += 1) {
      const batch = await fetchJson(
        `/addresses/${address}/transactions?order=asc&page=${page}&count=100`,
        env
      );
      if (!batch || batch.length === 0) break;
      txs.push(...batch);
      if (batch.length < 100) break;
    }

    this.#anchored.clear();
    let seq = 0;
    for (const tx of txs) {
      const metadata = await fetchJson(`/txs/${tx.tx_hash}/metadata`, env);
      if (!metadata) continue;
      for (const entry of metadata) {
        if (String(entry.label) !== String(METADATA_LABEL)) continue;
        const digest = entry.json_metadata?.digest;
        if (typeof digest !== "string" || !DIGEST_RE.test(digest)) continue;
        if (entry.json_metadata?.tag !== ANCHOR_TAG) continue;
        // Idempotent, and FIRST WITNESS WINS — re-anchoring a digest
        // must never move its position, or ordering becomes rewritable
        // by anyone willing to pay a second fee.
        if (this.#anchored.has(digest)) continue;
        this.#anchored.set(digest, {
          seq: ++seq,
          at: tx.block_time,
          txHash: tx.tx_hash,
          block: tx.block_height,
        });
      }
    }

    this.#loaded = true;
    return { anchors: this.#anchored.size, address, network: env.network };
  }

  /**
   * ★ Unloaded is not empty. A store that has never fetched knows
   * nothing, and answering "false" would let a verifier report "not
   * anchored" — a definite claim — on the basis of not having looked.
   * The distinction between "absent" and "unchecked" is the whole
   * discipline of this project, so it throws.
   */
  #requireLoaded() {
    if (!this.#loaded) {
      throw new Error(
        "CardanoAnchorStore has not loaded. Call `await store.load()` before verifying — " +
          "an unfetched store does not know that a digest is absent, only that it has not looked."
      );
    }
  }

  isAnchored(digest) {
    this.#requireLoaded();
    return this.#anchored.has(digest);
  }

  positionOf(digest) {
    this.#requireLoaded();
    return this.#anchored.get(digest)?.seq ?? null;
  }

  /** The receipt a human can click. Not used by the verifier. */
  witnessOf(digest) {
    this.#requireLoaded();
    const entry = this.#anchored.get(digest);
    if (!entry) return null;
    const net = this.#config().network;
    return { ...entry, explorer: `https://${net}.cardanoscan.io/transaction/${entry.txHash}` };
  }

  get size() {
    return this.#anchored.size;
  }

  get loaded() {
    return this.#loaded;
  }

  // ----------------------------------------------------------- write

  async #meshWallet() {
    if (this.#wallet) return this.#wallet;
    const { projectId, mnemonic } = this.#config();
    const { MeshWallet, BlockfrostProvider } = await import("@meshsdk/core");
    const provider = new BlockfrostProvider(projectId);
    const wallet = new MeshWallet({
      networkId: 0, // testnet — never 1, and never parameterised into one
      fetcher: provider,
      submitter: provider,
      key: { type: "mnemonic", words: mnemonic.trim().split(/\s+/) },
    });
    await wallet.init();
    this.#wallet = wallet;
    return wallet;
  }

  async address() {
    if (this.#address) return this.#address;
    const wallet = await this.#meshWallet();
    this.#address =
      (await wallet.getUsedAddresses())[0] ?? (await wallet.getChangeAddress());
    return this.#address;
  }

  /**
   * Anchor a digest: a self-send carrying the digest in metadata.
   *
   * ★ ASYNC ON PURPOSE, AND NOT PART OF THE VERIFIER'S INTERFACE. The
   * in-memory store's `anchor()` was synchronous and free. This one
   * costs a fee, takes a minute, and can fail. Pretending otherwise —
   * by queueing and returning immediately — would let a caller believe
   * a record was witnessed when it was not.
   *
   * ★ SUBMITTED IS NOT ANCHORED. This returns after submission, and
   * says so in its return value: `confirmed: false`. Settlement on any
   * chain is probabilistic, and a transaction in the mempool can still
   * vanish. Nothing may treat a digest as anchored until `load()` finds
   * it in a block. That is why this method does NOT write to the cache.
   */
  async anchor(digest, { note = "" } = {}) {
    if (!DIGEST_RE.test(digest)) {
      throw new Error(`Not a sha256 digest: "${digest}". Metadata strings cap at 64 bytes.`);
    }
    const wallet = await this.#meshWallet();
    const address = await this.address();
    const { Transaction } = await import("@meshsdk/core");

    const tx = new Transaction({ initiator: wallet });
    tx.sendLovelace(address, "1000000"); // self-send; the metadata is the payload
    tx.setMetadata(METADATA_LABEL, {
      tag: ANCHOR_TAG,
      digest,
      msg: [note || "Voltron composition record anchor (testnet)"],
    });

    const unsigned = await tx.build();
    const signed = await wallet.signTx(unsigned);
    const txHash = await wallet.submitTx(signed);

    return {
      txHash,
      digest,
      address,
      confirmed: false, // ★ read this before believing anything
      explorer: `https://${this.#config().network}.cardanoscan.io/transaction/${txHash}`,
    };
  }

  /**
   * Wait until the chain shows it. Polls `load()` rather than trusting
   * the submission — the only evidence that counts is the evidence a
   * stranger could also find.
   */
  async awaitConfirmation(digest, { attempts = 30, intervalMs = 10_000, sleep = null } = {}) {
    const wait = sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    for (let i = 0; i < attempts; i += 1) {
      await this.load();
      if (this.#anchored.has(digest)) return this.witnessOf(digest);
      await wait(intervalMs);
    }
    return null;
  }
}

/**
 * Convenience for the common check: does this record's content still
 * hash to the digest the chain witnessed? Anchoring proves a digest
 * existed; only re-hashing proves THIS record is the thing witnessed.
 * Keeping them separate is the point — the anchor never carries content.
 */
export function matchesWitness(record, digest) {
  return hash(record) === digest;
}
