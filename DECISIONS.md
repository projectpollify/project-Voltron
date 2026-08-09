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

## Settled

- **Cardano**, not Bitcoin (owner, 2026-08-02).
- **Local-first**; hosted attestation deferred until TEE/ZK matures.
- **Anchor the memory and the commitments; version everything else.**
- **Concept phase closed** (2026-08-03) — next step is the §13 MVP.
