# Project Voltron

**The Organism Agent** — an AI entity whose continuity is carried not by
any component but by an authorised, append-only, publicly anchored
record of its composition over time.

> This project defines a **verifiable continuity criterion** for an AI
> entity. It does **not** claim to discover metaphysical identity,
> consciousness, or moral worth.

## Three documents, three purposes

| Document | Answers | Is it the product? |
|---|---|---|
| **`docs/DRAFT_ORGANISM_AGENT_SPEC.md`** | What makes a composition the same continuing entity | **Yes. Read this first.** |
| `docs/DRIFT_EXTENSION.md` | Does the entity still *mean* what it said | An extension — real, built, deliberately not next |
| `docs/VOLTRON_STATIC.md` | How would we *measure* that | **No** — a laboratory protocol |

They were written together and are filed apart on purpose: conflating a
product, an extension, and a research protocol made all three harder to
judge. Nothing was deleted in the split and no rule changed.

## State, 2026-08-03

- **The specification is at v4.0** and unratified. Nine ⭐ calls await
  the owner (§14).
- **The verifier is implemented and passing** — V1–V6 plus the STATIC
  pins, 60 tests, zero dependencies (Node's built-in crypto and test
  runner only).
- **Nothing is real yet.** The anchor store is in-memory and every
  artefact is synthetic.

## The next step, and only this one

**Make the core real: one composition record, anchored to actual
Cardano preprod, over an artefact that actually exists.**

That is what converts this from a design into a thing. Not another
feature — the drift extension and the STATIC protocol are both complete
and both wait on this, because a compass needs a ship.

```bash
npm test        # 60 tests: V1–V6, the attacks they stop, drift, the apparatus
npm run demo    # the §13 scenario, narrated
```

## The code

| Module | Layer |
|---|---|
| `src/canonical.js` · `src/keys.js` · `src/anchor.js` | Primitives |
| `src/composition.js` · `src/authority.js` · `src/memory.js` | **The specification** |
| `src/verifier.js` · `src/lineage.js` · `src/self.js` | **The specification** — V1–V6, the five questions, the first-person relation |
| `src/drift.js` | The drift extension |
| `src/experiment.js` | The STATIC protocol |

## Relationship to AgoraNet

Voltron shares that platform's *engine* — verifiable identity,
append-only anchored records, provable lineage, independent attestation
— and **none of its codebase**. The two corpora are separate bodies of
law; nothing crosses between them without the owner saying so. Origin is
recorded in the AgoraNet queue, entries #35 and #36.
