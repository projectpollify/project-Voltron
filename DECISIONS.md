# Decisions — Project Voltron

Open calls awaiting the owner. Nothing here blocks anything else;
the MVP (spec §13) can be built before any of these are settled,
and building it will inform several of them.

## Open ⭐ calls (spec §14)

| # | Call | Note |
|---|---|---|
| 1 | **The name** | "Organism agent" is descriptive, not chosen |
| 2 | **May the entity amend its own commitments?** (§12) | Recommendation: permitted but *ceremonial* — quorum, recorded, prior version retrievable |
| ~~3~~ | ~~**The authority model** (§5)~~ | **RULED 2026-08-10 — see below. No longer open.** |
| 4 | **Is semantic knowledge identity-bearing?** (§6) | Proposed: no — a library, replaceable wholesale |
| 5 | **Uniqueness** (§3.3) | Proposed: accept branching rather than enforce one live continuation |
| 6 | **Fork inheritance** (§7) | Does a child inherit the parent's authority document? |
| 7 | **Attestation** (§10) | Lean on AgoraNet's verified-human gate, or build an independent scheme? |
| 8 | **Scope** | A single entity, or a public registry others anchor to? |
| 9 | **Anchor cadence** | Fixed rhythm vs. change-triggered |

**Eight calls remain open. None of them blocks Phase 1.**

---

## ★ Ruling — ⭐ #3, the authority model (owner, 2026-08-10)

**"All four are me, and write that down honestly."**

All four roles — entity, controller, steward, recovery — are held by
the owner. One person, four keys, four hats. Phase 0 is closed and
Phase 1 is unblocked.

### Why this needed a ruling at all

`checkQuorum` counts distinct KEYS, because keys are what a cryptosystem
can see. So a three-of-four quorum over four keys held by one human
passes perfectly, and the verifier prints:

> `authorised by entity + controller + steward`

which reads as three parties agreeing and is one person signing three
times. **No rule is broken.** The quorum does exactly what it says. The
defect is entirely in what a reader infers — and it is the only place in
the design where every check can pass while the impression given is
false.

### What was built (2026-08-10, 69 tests passing)

The fix cannot be cryptographic: key custody is a fact about the world,
not a property of a signature. So the fix is **declaration**.

- `activeKeys[].heldBy` — optional, and covered by the document hash, so
  a holder claim cannot be altered after the fact without amending the
  authority.
- `holderCensus(doc)` — three states, kept distinct on purpose:
  `undeclared` (says nothing), `partial` (refuses to guess a count),
  `declared` (a count that is a *claim*).
- `describeSeparation(doc)` — the sentence a reader needs. For this
  ruling it prints: *"4 role(s), ALL held by shawn — one person, every
  role… The separation of powers here is declared decorative."*
- `checkQuorum` now returns `distinctHolders` and `independent`
  alongside `accepted`. **It gates nothing.** A sole holder still meets
  quorum; there is a test asserting exactly that.
- V3's verifier note now carries the qualifier with the roles it lists,
  so the misleading string can no longer be printed bare.

`independent` is **false when holders are undeclared**. Deliberate:
silence must not present as oversight.

### ★ The limit, stated so it cannot quietly stop being true

**A holder label is a claim, not proof.** Nothing verifies that "alice"
and "bob" are different humans — one person with four keys can write
four names, and the census will report four holders and
`independent: true`. There is a test named for this.

What declaration buys is that **the honest case becomes legible and the
dishonest case requires an explicit lie rather than mere silence.** That
is the entire improvement. It is not verification of key custody and
must never be described as such.

The real fix is other people. There are none yet.

## External findings

**TEE / confidential compute may be maturing faster than §9 assumes
(2026-08-03).** Source: a Charles Hoskinson talk on wallet security —
an interested party (he runs Shielded/Midnight), so treat as a pointer
to verify, not as evidence.

The claim: the Confidential Computing Consortium (AMD, Intel, Nvidia,
Microsoft, Google, Meta, Huawei, and Shielded) is standardising trusted
execution; he projects ~$50bn/yr of confidential-compute load by 2029,
and that by 2030 most crypto wallets will be custodied by **agents
running in TEEs with their own keys**.

**Why it matters here — two of our open questions:**

1. **§9's binding problem.** The spec says hashing proves the file, not
   that the server loaded it, and that closing this for hosted inference
   needs a TEE or ZK proof — "immature, out of scope for v1." **If the
   hardware is arriving on that timeline, that assessment may be too
   pessimistic**, and hosted attestation could become available sooner
   than local-first-only planning assumes. Worth checking the
   consortium's actual specifications directly rather than trusting a
   product talk.
2. **Open call #4 (who signs).** "An agent with its own key running in
   confidential compute" is precisely the entity key of §11.9, and the
   **Open Wallet Standard** is plausibly the infrastructure it would run
   on. If that standard is real and adopted, it is a better answer to
   "who signs" than inventing our own key handling.

**Not adopted, and not scheduled.** This changes no rule. It is a
pointer at two assumptions worth re-testing before they harden into
design.

### ★ VERIFIED 2026-08-10 — and the pointer above was partly wrong

The note above was written from a product talk. Checked directly, here
is what is actually true, and it is narrower than the talk implied.

**OWS exists and is real.** `@open-wallet-standard/core` on npm,
v1.4.2, MIT, maintained by **MoonPay engineering** (`svc-sre@moonpay.com`)
plus Dawn Labs — 32 releases since March 2026. Rust core via native
FFI. **No install/postinstall script**, which is the usual supply-chain
vector, so it is unremarkable to install.

**★ IT DOES NOT SUPPORT CARDANO.** Twelve chains: EVM, Solana, Bitcoin,
Cosmos, Tron, TON, Sui, XRPL, Spark, Filecoin, NEAR, Nano. Cardano is
absent from the supported-chain table. It therefore cannot sign a
Cardano transaction today, and cannot be used for anchoring at any
phase until that changes.

**★ AND IT WAS NEVER A REPLACEMENT.** The earlier framing — OWS *versus*
a plain mnemonic — was a category error, and this correction matters
more than the missing chain:

| | job |
|---|---|
| Mesh SDK | builds and signs the Cardano transaction |
| OWS | holds the key, gates *who may sign* before decryption |

Even in a future where OWS speaks Cardano, both would be used. OWS is
custody and policy; Mesh is transaction construction. They occupy
different layers.

**Two separate things share the name.** Hoskinson announcing that
*Cardano* supports an Open Wallet Standard, and *this MoonPay npm
package* supporting Cardano, are different claims. Only the first has
any evidence behind it. Do not let the shared name imply a shared
roadmap.

**What survives, and it is the interesting part.** OWS's actual design —
keys encrypted at rest, decrypted only inside a signing path, after a
pre-signing policy engine passes — **is exactly the entity key of
§11.9**, and a better answer to open call "who signs" than inventing our
own key handling. That claim is unaffected by the Cardano gap. Re-test
it at Phase 3, not before.

**Ruling in force (owner, 2026-08-10):** *"Let's do Phase 1 with a plain
mnemonic. When OWS is mature, we'll swap."* Confirmed correct on the
evidence, though for a different reason than the one given at the time —
not that an SDK was unavailable, but that this one does not reach
Cardano and never occupied that layer anyway.

## Settled

- **Cardano**, not Bitcoin (owner, 2026-08-02).
- **Local-first**; hosted attestation deferred until TEE/ZK matures.
- **Anchor the memory and the commitments; version everything else.**
- **Concept phase closed** (2026-08-03) — next step is the §13 MVP.
- **§13's MVP is BUILT** (found 2026-08-10): all six items, tests green.
  What remains is one interface, `src/anchor.js`. See `BUILD_ORDER.md`.
- **⭐ #3 ruled** (2026-08-10): all four roles held by the owner,
  recorded honestly. **Phase 0 closed; Phase 1 unblocked.**
