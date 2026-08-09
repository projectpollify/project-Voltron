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
is the whole project.

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

## Current state (2026-08-03)

- Spec **v3.1**, unratified. **Nine ⭐ calls open** — see spec §14.
  The two heaviest: may the entity amend its own commitments (§12,
  recommendation: ceremonial), and the authority key model (§5).
- **Concept phase closed.** Do not expand the concept document further
  without the owner asking. The remaining uncertainty is empirical.
- **Next step: the MVP in spec §13** — implement verifier rules V1–V6
  over a toy lineage. Two organs as content-addressed artefacts, an
  authority document with a real quorum rule, one memory advance, one
  brain replacement, one fork, and a verifier that answers the five
  questions. No hardware required.
- **No code exists yet.**

## Conventions

- Cardano for anchoring (the owner's choice; AgoraNet already runs
  there). Anchoring is *witness*, never storage.
- Local-first: verification is only sound when the user loads the
  artefacts themselves. Hosted attestation waits for TEE/ZK maturity.
- Weights, memories and prompts are **never** on-chain — only
  commitments to them.
