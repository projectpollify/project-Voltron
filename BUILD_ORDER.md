# Build Order: Project Voltron

**Status: written 2026-08-10. Not owner-ratified.** This is the plan as
it stood when the concept phase closed. It orders work; it decides
nothing. Every ⭐ call in `DECISIONS.md` is still the owner's.

---

## Where we actually are

Read this before planning anything, because the obvious next step is
already done and planning around it wastes a phase.

**Spec §13's MVP is built and passing.** All six items:

| §13 item | Where it lives | State |
|---|---|---|
| 1. Two organs as content-addressed artefacts | `src/canonical.js` | done |
| 2. Authority document, real keys, quorum rule | `src/authority.js` | done |
| 3. Canonical composition record, signed | `src/composition.js`, `src/keys.js` | done |
| 4. One memory advance; one brain replacement | `src/memory.js`, `test/verifier.test.js` | done |
| 5. A fork | `test/verifier.test.js` | done |
| 6. A verifier implementing V1–V6 | `src/verifier.js` | done, plus S1/S2/S3 |

60 tests pass (`npm test`). §13's own bar, *"if V1-V6 run cleanly over
that lineage, the continuity model has earned implementation"*, is met.

**So what is left is not the MVP. It is one interface.**

`src/anchor.js` is a `MemoryAnchorStore`. It was written deliberately as
an interface so that swapping it for a real chain would not change the
verifier. That swap is now the whole of Phase 1, and it is the only
thing standing between this repo and a claim that can be checked by
someone who doesn't trust us.

Everything above the anchor is real. The anchor is the pretend part.

---

## Phase 0: Ratify what blocks ✅ CLOSED 2026-08-10

**The owner ruled: "all four are me, and write that down honestly."**
Built the same day: `holderCensus`, `describeSeparation`, and the V3
qualifier; 69 tests passing. Full record in `DECISIONS.md`.

Eight ⭐ calls remain open. **None of them blocks Phase 1.** The
original reasoning is kept below because it explains why this one call
was different.

---

Nine ⭐ calls were open (`DECISIONS.md`). **Only one blocked Phase 1:**

> **#3, the authority model.** Who holds the entity key, the controller
> key, the steward keys, the recovery key. Quorum size and composition.
> May the entity sign its own memory advances?

It blocks because a real anchor writes a real authority document, and
that document is the thing the verifier checks quorum against. Anchoring
one we intend to replace means the first record on chain is already
wrong.

The other eight can be answered from experience later, and several will
answer themselves once something runs. Do not treat Phase 0 as "settle
all nine."

### ★ The honest note about #3, RULED AND BUILT

**If one person holds all four keys, the separation of powers is
decorative.** The verifier will check quorum perfectly against an
authority document in which every role resolves to the same key, and
report `authorised by entity + controller + steward`, which reads as
oversight and is not.

That may be entirely correct for a solo preprod project. It is not
correct to leave unmarked.

**The owner ruled it decorative and directed that it be recorded as
such.** The authority document now carries `heldBy` per key;
`holderCensus()` reports how many distinct holders there are;
`checkQuorum` returns `distinctHolders` and `independent`; and V3's note
can no longer print the roles without the qualifier. Undeclared reports
as *not* independent, so silence cannot pass as oversight.

**It gates nothing.** A sole holder still meets quorum, by design and
by test. And a holder label remains a claim, not proof: nothing verifies
that two names are two people. Declaration turns silence into an
explicit lie, which is the whole of the improvement.

This is the one place where the design could lie without any rule
failing. It is now recorded rather than fixed. The fix is other people,
and there are none yet.

---

## Phase 1: One real anchor ✅ CLOSED 2026-08-10

**The core is real.** Both records are resolvable by anyone on a public
explorer, which is the entire point of the phase:

| | tx | block |
|---|---|---|
| Genesis composition record | [`85a67783…f6ca91`](https://preprod.cardanoscan.io/transaction/85a67783a799460f77f3db3320d856a31806f225ee1dbd36728ecd3de9f6ca91) | 5040296 |
| Authority document (what V3 checks quorum against) | [`5410029f…1d286f`](https://preprod.cardanoscan.io/transaction/5410029f890b86400aef6bad27d2dab832283f9da8497401c19874cf5c1d286f) | 5040293 |

The verifier ran **against the live chain, not the in-memory store**,
and passed V1 through V6, with V3 printing the decorative-quorum
qualifier that ⭐ #3 requires. 81 offline tests still green.

**What this proves:** anchoring is indifferent to what is anchored, the
verifier's `ok` means something a stranger can independently confirm,
and the interface boundary held.
**What it does not prove:** anything about organs, models or drift. The
organs are placeholder hashes by design. It is a plumbing proof and
claims nothing more.

### ★ Two real bugs, found only by running it

Both were in `scripts/anchor-genesis.js`, and both were invisible to 81
passing tests because every one of those tests is offline.

**1. The keys did not survive a resume, while a comment promised they
would.** `generateKey` returns a Node `KeyObject`, and `JSON.stringify`
flattens that to `{}`, so the state file looked correct and silently
contained no private key, and any re-run failed to sign. The comment
three lines above it explained why persistence mattered: regenerating
keys would "silently create a DIFFERENT entity that happens to look the
same." **A file documenting a guarantee it did not provide is exactly
the defect this project exists to catch.** Now stored as PKCS8 PEM and
rehydrated on load.

**2. A UTxO race between the two anchors.** Both were submitted back to
back, so the second reused an input the first had just spent.
Wait-for-confirmation now sits between them.

**Still open, flagged rather than silently patched:** the store caches a
single wallet instance, so one process still cannot chain two
submissions against fresh UTxOs. The resume path covers it, which is
why the run completed. A true one-shot needs a wallet refresh in
`src/anchorCardano.js`.

**One honest artifact.** An earlier attempt anchored an authority
document (`ae19…`) whose private keys were lost to bug 1 before it was
found. That transaction is a real, permanent orphan on preprod: an
anchored authority document belonging to no lineage. Harmless, testnet,
a trivial fee, and recorded here rather than quietly omitted. Anyone
auditing the address will find it, and this is the explanation.

### The lesson worth carrying to Phase 2

Every offline test passed while both bugs sat in the path. That is not
an argument against offline tests, which caught real things and cost
nothing. It is a reminder that **they test the parts, and only a run
tests the seams.** Budget for the first real run of every phase to fail
on something the suite could not have seen.

### ★ Three findings from making it real

**1. The sync interface held, but by a decision, not for free.**
`isAnchored()` is synchronous and the verifier calls it that way; a
chain lookup is not. The store answers from a **locally materialised
view**, built by `await load()`. The verifier is untouched, and the
asynchrony moved to a place it never reaches. The consequence, stated
rather than buried: *the verifier checks a view someone fetched, not
the chain.* `load()` is part of verification, not setup.

**2. Unloaded is not empty.** A store that has never fetched returns
`throw`, not `false`. Otherwise "I did not look" would be reported as
"it is not there." Same for a Blockfrost outage: it throws, because an
API 500 must never read as *not anchored*.

**3. Submitted is not anchored.** `anchor()` returns
`confirmed: false` and deliberately does **not** write to the cache.
Only `load()` finding it in a block counts, because the only evidence
worth having is evidence a stranger could also find.

### ★ The dependency, declared rather than slipped in

Voltron had **zero dependencies**, and that was a real property. Phase 1
adds **`@meshsdk/core`** (210 transitive packages). It is not avoidable,
since building and signing a Cardano transaction cannot be done with
Node's standard library. But the cost is honest: the verifier, the authority
model, the lineage and the drift apparatus all still run on zero
dependencies. Only the anchor store reaches for one, which is exactly
the boundary the interface was drawn at.

---

**Goal:** a single composition record anchored to real Cardano preprod.

**Deliverable:** a transaction hash resolvable on a public explorer,
plus a verifier run that passes with the real anchor store in place of
`MemoryAnchorStore`.

**Work:** implement a `CardanoAnchorStore` behind the existing interface
(`isAnchored`, and whatever `put` becomes when it costs money and takes
time). AgoraNet's `lib/chain.ts` and `scripts/chain/anchor-ledger.ts`
are a working reference for Blockfrost submission and metadata writing:
read them, port deliberately, do not import.

**Needs from the owner:**
- A Blockfrost preprod project ID **of Voltron's own**. AgoraNet's key
  currently exists and works, and sharing it for early experiments is an
  acceptable compromise, but separate corpora want separate blast radius.
- A **fresh preprod wallet**, funded from the faucet. Never AgoraNet's
  `TESTNET_MINT_MNEMONIC`.
- Both in a gitignored `.env`. The mnemonic never goes anywhere else:
  not into chat, not into a file that is tracked, not into a screenshot.

**What Phase 1 proves that Phase 0 cannot:** that anchoring is
indifferent to what is anchored, that the verifier's `ok` means
something a stranger can independently confirm, and that the interface
boundary held.

**What it does not prove:** anything about organs, models, or drift. It
is a plumbing proof and should be described as one.

---

## Phase 2: Real artefacts ✅ CLOSED 2026-08-10

**The organs are files you can open.**

| | |
|---|---|
| Record | `27a9a985…843bc2` (organ-swap, predecessor `03378d69…`) |
| Transaction | [`33f2bf02…d7e37d`](https://preprod.cardanoscan.io/transaction/33f2bf024fa02b77f6f312296fa7281770eb25be2b55f870322a7a4789d7e37d) |
| Block | 5040513, position 4 |
| `brain` | `organs/reasoner.prompt.md`, 1201 bytes, `d980dcf9…` |
| `tools` | `organs/tools.manifest.json`, 1769 bytes, `330956c3…` |

V1 through V6 passed against the live chain. V5 confirmed the memory
extended by one entry, so the entity's own history records that its
organs were replaced. 95 tests green.

### ★ The design decision this phase forced

Genesis is anchored and cannot be edited. So Phase 2 could not *correct*
the placeholders; it had to **continue the lineage** with an
`organ-swap` record naming genesis as predecessor.

That is the more honest shape anyway. "The organs used to be
placeholders and are now files" is a fact about this entity's history,
and a lineage is precisely the thing that carries such facts. It is also
**the first time permanence cost us something**, which is worth marking:
until a record is expensive to have been wrong about, its immutability
is a claim rather than a constraint.

A related consequence, commented at the site in
`scripts/anchor-organs.js`: genesis's `reason` string contains an em
dash, which the owner's writing rule would otherwise remove. Those exact
bytes are hashed into `85a67783…`. **The text is evidence now, not
prose**, and editing it would break the rebuild check and orphan the
lineage.

### It ran clean the first time, and that was not luck

Phase 1 found two bugs by spending transactions. Phase 2 added a
**pre-flight test** that puts the exact record shape through the real
verifier with an in-memory anchor store, plus `src/keystore.js` to hold
the key-serialisation defect in one tested place.

The lesson generalises and should govern Phase 3: **when a run finds a
bug, move the check back into the suite rather than only fixing the
bug.** Tests cover the parts and only a run covers the seams, so every
seam a run exposes is a test that was missing.

### Still open from this phase

**Retrievability, unchanged.** A hash proves what a file *was*; it does
not make the file *available*. The organs here happen to be in the git
repo, which is a distribution channel and not a guarantee, and a `.gguf`
at Phase 4 will not fit in one. Decide when artefacts must be publicly
fetchable, not before.

---

**Goal:** the pinned organs are real files, hashed and retrievable,
rather than test fixtures.

**★ The first organ does not have to be a model.** A system prompt file,
a tool manifest, a retrieval configuration. Each hashes and pins
identically, and S1/S2 enforce them identically. This is deliberate: it
takes hardware off the critical path entirely. The composition machinery
can be proven end-to-end on a machine that cannot run a single open
weight.

**Open question this phase surfaces:** retrievability. A hash proves
what a file *was*; it does not make the file *available*. Blockfrost's
IPFS storage tier is where that gap shows up as a line item on a pricing
page. Decide when artefacts must be publicly fetchable, not before.

---

## Phase 3: A running entity

**Goal:** the organs execute. The orchestrator routes. The runtime pin
means something because there is a runtime to pin.

This is where the spec's central claim stops being a data structure and
starts being a system, and where §9's binding problem becomes concrete:
**hashing proves the file, not that the process loaded it.** The spec
already concedes this and defers it to TEE/ZK maturity. Phase 3 should
state the gap in running code (a comment at the load path, not a
footnote in a document) because it is the honest limit of the whole
design.

---

## Phase 4: Drift measurement against a real model

**Goal:** run `src/experiment.js`'s factorial sweep with a real brain in
the loop.

**This is the phase that genuinely needs hardware, and it is last for
that reason.** Nothing before it is blocked on a GPU.

The apparatus is built and tested (`test/experiment.test.js`,
`test/drift.test.js`). Its own stated boundary governs:

> Run it with a real model and the numbers mean something about that
> model. Run it with the synthetic brain in the demo and the numbers
> mean only that the apparatus works.

The first real run's job is to fail the baseline. A stochastic decoder
will drift with all factors off, and `sweep()` will refuse to attribute
anything until determinism is pinned or a tolerance is pre-registered.
**That refusal is the apparatus working.** Do not tune the tolerance
until the baseline passes; that inverts the instrument.

### ★ The model, and the hardware constraint that turned out not to bind

**Pick on verifiability, not capability.** The whole design pins organs
by hash, and you can only hash a file you possess. That sorts the
options before any benchmark does:

| | can the brain organ be pinned? |
|---|---|
| Open weights, run locally | **Yes.** One file, one hash, S1 works as written |
| Open weights, hosted | Only asserted. You know what it *should* hash to and cannot check what they loaded |
| Closed API (Claude, GPT) | **No.** There is no file. `"claude-opus-5"` is a name, and the provider may change what stands behind it while every hash in the lineage still verifies |

That last row is the one that matters: a closed model makes the exact
silent substitution the drift compass exists to catch, and makes it
invisible to the verifier as well. **A weaker model that can be hashed
is worth more here than a stronger one that cannot.** Unusual trade,
correct for this project.

**Hardware, checked 2026-08-10.** The owner's Mac has 16 GB, which is
enough. Recommended starting point: **Qwen3.5 9B at Q4_K_M, one 5.68 GB
`.gguf` file** ([unsloth](https://huggingface.co/unsloth/Qwen3.5-9B-GGUF),
[bartowski](https://huggingface.co/bartowski/Qwen_Qwen3.5-9B-GGUF)).
Budget: ~4 GB macOS, 5.7 GB model, 1 to 2 GB context, leaving headroom.
A 14B at Q4 (Phi-4, ~8.5 GB) also runs but squeezes the context window
on 16 GB.

Nine billion parameters is ample, because **the probes need consistency,
not brilliance.** They test whether answers stay the same, not whether
they are clever.

The single-file format is a bonus rather than an accident: one `.gguf`
is one hash, which is precisely the shape S1's organ pin wants.

### ★ What will actually break first, and it is not the model

`sweep()`'s null check will fail on the first real run, and the cause
will be decoding settings rather than anything conceptual. **Everything
below changes output while every artefact hash holds**, which is the
same class of invisible movement the runtime pin exists for:

- temperature (must be 0) and top_p / top_k
- the RNG seed
- thread count and batch size (llama.cpp results can shift with both)
- context length and any truncation or eviction policy
- the prompt template and BOS/EOS handling

**Pin all of them in the runtime hash, not in a config file nobody
records.** That is not extra work introduced by Phase 4; it is what
§9's measured configuration always meant, made concrete by contact with
a real decoder.

If the baseline still will not settle after pinning, **declare a
tolerance and pre-register it** rather than quietly widening one until
the numbers look good. `sweep()` already reports the tolerance it was
given, so a widened one is visible in the result. Keep it that way.

---

## Rules that carry over from AgoraNet

These are not Voltron's inventions. They are the working practice that
produced a platform whose 32 verify checks pass, and they apply here
unchanged.

1. **One slice, one checkpoint.** Every phase ends at a recorded
   checkpoint with evidence: tests green, the demo run, the claim
   stated in terms of what was actually proven.
2. **Build what the spec says. Where it is silent, FLAG, never invent.**
3. **No feature bypasses the verifier**, even when bypassing would be
   easy and the lineage is one record long.
4. **Secrets live only in gitignored `.env`.** No key, mnemonic, or
   project ID in any tracked file, ever.
5. **Testnet only.** No mainnet, no real funds, no custody.
6. **Honest disclosures ship with their features.** The binding problem,
   the decorative-quorum note, the synthetic-brain boundary. Each
   travels with the thing it limits.

---

## The wrong turn to avoid

This repo already made one, and `DECISIONS.md` records it: the drift
work grew until it was a different product, and had to be split back
apart into a product (`DRAFT_ORGANISM_AGENT_SPEC.md`), an extension
(`DRIFT_EXTENSION.md`), and a protocol (`VOLTRON_STATIC.md`).

The pattern to watch for: **solving a hard problem so thoroughly that
the solution stops being about the original thing.** Drift is real and
the compass is good work. It is still an extension. The product is the
answer to one question, what makes a composition the same continuing
entity, and phases that do not advance that question should be
recognised as extensions and named as such.
