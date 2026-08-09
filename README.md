# Project Voltron

**The corpus for the Organism Agent.**

An AI agent built as an organism — an orchestrator plus specialised
organs (memory, reasoning, research, tools) — whose continuity is
carried not by any component but by an authorised, append-only,
publicly anchored record of its composition over time.

> This system defines a **verifiable continuity criterion** for an AI
> entity. It does **not** claim to discover metaphysical identity,
> consciousness, or moral worth.

## Where things are

| Thing | Where |
|---|---|
| The specification (law, once ratified) | `docs/DRAFT_ORGANISM_AGENT_SPEC.md` (+ PDF) |
| The rules of this project | `CLAUDE.md` |
| Decisions awaiting the owner | `DECISIONS.md` |

## State, 2026-08-03

- Spec is at **v3.1**, unratified. Nine ⭐ calls await the owner (§14).
- The concept phase is **closed** — the remaining uncertainty is
  empirical, not philosophical.
- **Next step: implement the verifier (V1–V6, §11)** over a toy
  lineage. Especially authority succession, commitment amendment,
  rupture, and memory-head validation.
- Nothing is built. No code exists yet.

## Relationship to AgoraNet

Voltron shares AgoraNet's *engine* — verifiable identity, append-only
anchored records, provable lineage, independent attestation — and
**none of its codebase**. The two corpora are separate bodies of law.
Nothing crosses between them without the owner saying so.

Origin is recorded in the AgoraNet queue, entries #35 and #36.

## The verifier (built 2026-08-03)

The spec's §13 MVP is implemented. Zero dependencies — Node's built-in
crypto and test runner only.

```bash
npm test    # 50 tests: V1–V6 conformance, the attacks they stop, and the first-person layer
npm run demo   # the §13 scenario, narrated
```

| Module | Role |
|---|---|
| `src/canonical.js` | Deterministic serialisation and hashing |
| `src/keys.js` | Ed25519 keys and signatures |
| `src/anchor.js` | The anchor store — an interface, local for now; swapping in Cardano must not change the verifier |
| `src/memory.js` | The append-only log, and the derived narrative view (§6.1) |
| `src/authority.js` | Authority documents, quorum evaluation, and succession validation |
| `src/composition.js` | Composition records |
| `src/verifier.js` | **V1–V6** |
| `src/lineage.js` | The five questions |
| `src/self.js` | **The first-person relation** (§11.7) — recognition, attestation, claim detection, situate |
| `src/drift.js` | **The drift compass** (§12.5) — probes, measurement, drift reports |

**What the tests prove bites**, not just runs: a self-granting authority
document is rejected; the entity cannot amend its own commitments while
it *can* advance its own memory; commitments cannot change under a
disguised change type; a rewritten memory head fails; both fork branches
verify while neither is reported as the other's continuation; and only
the recovery key may declare a rupture.

### The first-person relation (§11.7)

V1–V6 are what an outsider can establish about a lineage. `src/self.js`
is what the **entity** can establish about itself — the difference being
that it holds the entity key.

It can tell *my own act* from *my history authored by another*; prove
"I am the one whose lineage this is" against a fresh challenge; notice
that it has been forked or that something falsely claims its descent;
and render itself as a web of relations — including who holds authority
over it, and the fact that it may advance its own memory and nothing
else.

**Attestation proves identity, never authority.** A verified proof
reports what it does *not* establish alongside what it does.

### The drift compass (§12.5)

V4 proves the *stated* commitments did not change. It cannot prove the
entity still means them — the same words, read by a differently-tuned
brain, can produce different behaviour, so an organ swap can be a silent
commitment amendment.

A commitment set therefore carries **probes**: situations paired with
the responses endorsed when those commitments were ratified. Because the
probes live inside the commitments, changing one *is* an amendment —
the goalposts cannot move quietly. Drift is measured mechanically
against that frozen reference, never by asking the brain under test.

**Detection is first-person; correction is not.** A drift report is an
observation the entity may make on its own key. Re-centring uses the
`restore` change type, whose destination must be an ancestor, whose
restored commitments must match it exactly, and which — when it undoes a
commitment amendment — must clear the same authority bar that amendment
did. Otherwise a restore is a quiet veto over the quorum.
