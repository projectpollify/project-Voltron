# Build Order — Project Voltron

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

60 tests pass (`npm test`). §13's own bar — *"if V1–V6 run cleanly over
that lineage, the continuity model has earned implementation"* — is met.

**So what is left is not the MVP. It is one interface.**

`src/anchor.js` is a `MemoryAnchorStore`. It was written deliberately as
an interface so that swapping it for a real chain would not change the
verifier. That swap is now the whole of Phase 1, and it is the only
thing standing between this repo and a claim that can be checked by
someone who doesn't trust us.

Everything above the anchor is real. The anchor is the pretend part.

---

## Phase 0 — Ratify what blocks ✅ CLOSED 2026-08-10

**The owner ruled: "all four are me, and write that down honestly."**
Built the same day — `holderCensus`, `describeSeparation`, and the V3
qualifier; 69 tests passing. Full record in `DECISIONS.md`.

Eight ⭐ calls remain open. **None of them blocks Phase 1.** The
original reasoning is kept below because it explains why this one call
was different.

---

Nine ⭐ calls were open (`DECISIONS.md`). **Only one blocked Phase 1:**

> **#3 — the authority model.** Who holds the entity key, the controller
> key, the steward keys, the recovery key. Quorum size and composition.
> May the entity sign its own memory advances?

It blocks because a real anchor writes a real authority document, and
that document is the thing the verifier checks quorum against. Anchoring
one we intend to replace means the first record on chain is already
wrong.

The other eight can be answered from experience later, and several will
answer themselves once something runs. Do not treat Phase 0 as "settle
all nine."

### ★ The honest note about #3 — RULED AND BUILT

**If one person holds all four keys, the separation of powers is
decorative.** The verifier will check quorum perfectly against an
authority document in which every role resolves to the same key, and
report `authorised by entity + controller + steward` — which reads as
oversight and is not.

That may be entirely correct for a solo preprod project. It is not
correct to leave unmarked.

**The owner ruled it decorative and directed that it be recorded as
such.** The authority document now carries `heldBy` per key;
`holderCensus()` reports how many distinct holders there are;
`checkQuorum` returns `distinctHolders` and `independent`; and V3's note
can no longer print the roles without the qualifier. Undeclared reports
as *not* independent, so silence cannot pass as oversight.

**It gates nothing** — a sole holder still meets quorum, by design and
by test. And a holder label remains a claim, not proof: nothing verifies
that two names are two people. Declaration turns silence into an
explicit lie, which is the whole of the improvement.

This is the one place where the design could lie without any rule
failing. It is now recorded rather than fixed — the fix is other people,
and there are none yet.

---

## Phase 1 — One real anchor

**Goal:** a single composition record anchored to real Cardano preprod.

**Deliverable:** a transaction hash resolvable on a public explorer,
plus a verifier run that passes with the real anchor store in place of
`MemoryAnchorStore`.

**Work:** implement a `CardanoAnchorStore` behind the existing interface
(`isAnchored`, and whatever `put` becomes when it costs money and takes
time). AgoraNet's `lib/chain.ts` and `scripts/chain/anchor-ledger.ts`
are a working reference for Blockfrost submission and metadata writing —
read them, port deliberately, do not import.

**Needs from the owner:**
- A Blockfrost preprod project ID **of Voltron's own** — AgoraNet's key
  currently exists and works, and sharing it for early experiments is an
  acceptable compromise, but separate corpora want separate blast radius.
- A **fresh preprod wallet**, funded from the faucet. Never AgoraNet's
  `TESTNET_MINT_MNEMONIC`.
- Both in a gitignored `.env`. The mnemonic never goes anywhere else —
  not into chat, not into a file that is tracked, not into a screenshot.

**What Phase 1 proves that Phase 0 cannot:** that anchoring is
indifferent to what is anchored, that the verifier's `ok` means
something a stranger can independently confirm, and that the interface
boundary held.

**What it does not prove:** anything about organs, models, or drift. It
is a plumbing proof and should be described as one.

---

## Phase 2 — Real artefacts

**Goal:** the pinned organs are real files, hashed and retrievable,
rather than test fixtures.

**★ The first organ does not have to be a model.** A system prompt file,
a tool manifest, a retrieval configuration — each hashes and pins
identically, and S1/S2 enforce them identically. This is deliberate: it
takes hardware off the critical path entirely. The composition machinery
can be proven end-to-end on a machine that cannot run a single open
weight.

**Open question this phase surfaces:** retrievability. A hash proves
what a file *was*; it does not make the file *available*. Blockfrost's
IPFS storage tier is where that gap shows up as a line item on a pricing
page. Decide when artefacts must be publicly fetchable, not before.

---

## Phase 3 — A running entity

**Goal:** the organs execute. The orchestrator routes. The runtime pin
means something because there is a runtime to pin.

This is where the spec's central claim stops being a data structure and
starts being a system, and where §9's binding problem becomes concrete:
**hashing proves the file, not that the process loaded it.** The spec
already concedes this and defers it to TEE/ZK maturity. Phase 3 should
state the gap in running code — a comment at the load path, not a
footnote in a document — because it is the honest limit of the whole
design.

---

## Phase 4 — Drift measurement against a real model

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

---

## Rules that carry over from AgoraNet

These are not Voltron's inventions. They are the working practice that
produced a platform whose 32 verify checks pass, and they apply here
unchanged.

1. **One slice, one checkpoint.** Every phase ends at a recorded
   checkpoint with evidence — tests green, the demo run, the claim
   stated in terms of what was actually proven.
2. **Build what the spec says. Where it is silent, FLAG — never invent.**
3. **No feature bypasses the verifier**, even when bypassing would be
   easy and the lineage is one record long.
4. **Secrets live only in gitignored `.env`.** No key, mnemonic, or
   project ID in any tracked file, ever.
5. **Testnet only.** No mainnet, no real funds, no custody.
6. **Honest disclosures ship with their features.** The binding problem,
   the decorative-quorum note, the synthetic-brain boundary — each
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
answer to one question — what makes a composition the same continuing
entity — and phases that do not advance that question should be
recognised as extensions and named as such.
