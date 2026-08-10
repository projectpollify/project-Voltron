# Project Voltron — Build Law

This repository is the corpus for the **Organism Agent**. This file
tells every session what the project is, what the rules are, and where
the law lives.

## What this project is

A verifiable continuity criterion for an AI entity. An orchestrator
plus specialised organs, whose continuity is carried by an authorised,
append-only, publicly anchored lineage of composition records —
committing to identity-bearing memory and constitutional commitments
while permitting other organs to change.

**Read `docs/DRAFT_ORGANISM_AGENT_SPEC.md` before doing anything.** It
is the product.

**Then read `BUILD_ORDER.md`** — the phase sequence, what blocks what,
and the one ⭐ call the owner must rule on before Phase 1 can start. It
is a plan, not law: it orders work and decides nothing.

**Three documents, and do not confuse them:**
- `DRAFT_ORGANISM_AGENT_SPEC.md` — the continuity specification. THE
  PRODUCT.
- `DRIFT_EXTENSION.md` — behavioural fidelity. An extension; complete,
  and deliberately not the next thing to build.
- `VOLTRON_STATIC.md` — a research protocol. **NOT a product**, and not
  a deployment posture. It freezes the base system to measure it.

If a future session finds itself elaborating the extension or the
protocol while the specification is still running on an in-memory anchor
store and synthetic artefacts, it has taken a wrong turn.

## What this project is NOT

- **Not AgoraNet.** Voltron shares that platform's *engine* —
  verifiable identity, append-only anchored records, provable lineage,
  independent attestation — and none of its codebase. The two corpora
  are separate bodies of law. **Nothing crosses between them without
  the owner saying so**, in either direction.
- **Not a claim about consciousness.** The spec supplies persistence
  and self-reference, which is what theories of mind turn on. Supplying
  preconditions is not producing a mind, and no document here may blur
  that line.
- **Not a storage system.** Anchoring makes tampering *evident*; it
  does not make anything *available*. Never let those be conflated.

## The methodology (carried over from AgoraNet, deliberately)

1. **Build exactly what the spec says. Where it is silent, FLAG —
   never invent.**
2. **One slice, one checkpoint.** Every unit of work ends at a recorded
   checkpoint with its evidence written down.
3. **Honest limits ship with the feature.** Every claim states what it
   cannot show. The spec's §1 table is the model: what it establishes,
   and what it does not.
4. **Nothing is ratified until the owner has read it and can say
   "yes, that is what I mean."** ⭐ items are his calls alone.
5. **The owner schedules all work.** Sessions never self-start a build.

## Current state (2026-08-10)

- Spec **v4.0**, unratified. **Nine ⭐ calls open** — see spec §14.
  The two heaviest: may the entity amend its own commitments (§12,
  recommendation: ceremonial), and the authority key model (§5).
  **Only §5 blocks the next phase** — see `BUILD_ORDER.md` Phase 0.
- **Concept phase closed.** Do not expand the concept document further
  without the owner asking. The remaining uncertainty is empirical.
- **The verifier is BUILT** — V1–V6 plus the STATIC pins, 60 tests
  passing, zero dependencies.
- **★ THE NEXT STEP, AND ONLY THIS ONE: make the core real.** One
  composition record, anchored to actual Cardano preprod, over an
  artefact that actually exists. Everything else waits on it — a compass
  needs a ship.
- **Nothing is real yet:** the anchor store is in-memory, every artefact
  synthetic, and no experiment has ever met a real model.
- **Spec §13's MVP is DONE** — all six items, 60 tests. What remains is
  not the MVP; it is one interface (`src/anchor.js`). Everything above
  the anchor is real. The anchor is the pretend part.

## Conventions

- Cardano for anchoring (the owner's choice; AgoraNet already runs
  there). Anchoring is *witness*, never storage.
- Local-first: verification is only sound when the user loads the
  artefacts themselves. Hosted attestation waits for TEE/ZK maturity.
- Weights, memories and prompts are **never** on-chain — only
  commitments to them.
