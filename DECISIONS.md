# Decisions — Project Voltron

Open calls awaiting the owner. Nothing here blocks anything else;
the MVP (spec §13) can be built before any of these are settled,
and building it will inform several of them.

## Open ⭐ calls (spec §14)

| # | Call | Note |
|---|---|---|
| 1 | **The name** | "Organism agent" is descriptive, not chosen |
| 2 | **May the entity amend its own commitments?** (§12) | Recommendation: permitted but *ceremonial* — quorum, recorded, prior version retrievable |
| 3 | **The authority model** (§5) | Who holds each key; quorum size and composition; may the entity sign its own memory advances? |
| 4 | **Is semantic knowledge identity-bearing?** (§6) | Proposed: no — a library, replaceable wholesale |
| 5 | **Uniqueness** (§3.3) | Proposed: accept branching rather than enforce one live continuation |
| 6 | **Fork inheritance** (§7) | Does a child inherit the parent's authority document? |
| 7 | **Attestation** (§10) | Lean on AgoraNet's verified-human gate, or build an independent scheme? |
| 8 | **Scope** | A single entity, or a public registry others anchor to? |
| 9 | **Anchor cadence** | Fixed rhythm vs. change-triggered |

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

## Settled

- **Cardano**, not Bitcoin (owner, 2026-08-02).
- **Local-first**; hosted attestation deferred until TEE/ZK matures.
- **Anchor the memory and the commitments; version everything else.**
- **Concept phase closed** (2026-08-03) — next step is the §13 MVP.
