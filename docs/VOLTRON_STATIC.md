# The Organism Agent — a draft specification

**STATUS: DRAFT — the STATIC variant, for review.**

> ## What this document is, and what to review
>
> This is `DRAFT_ORGANISM_AGENT_SPEC.md` (v3.7) **plus a new §12.6: the
> frozen baseline and its experiment.** The base spec is unchanged and
> still lives beside this file; everything before §12.6 is identical to
> it, so a reviewer who has seen v3.7 can go straight there.
>
> **The new argument in one line:** rather than detecting drift in a
> system where seven causes move at once, *remove the removable causes*,
> and study what is left.
>
> **Where critique is most useful:**
> 1. Is the taxonomy of drift causes (§12.5) actually complete?
> 2. Does freezing organs + runtime + training genuinely eliminate three
>    of them, or does something leak through?
> 3. Are the three remaining causes truly independent, or is the
>    factorial design (§12.6) fooling itself?
> 4. Is "the frozen baseline must show zero drift or the experiment is
>    void" the right null check, or is there a better one?
> 5. Does a frozen entity remain worth building — or has the freeze
>    removed the thing that made it interesting?
>
> **Implementation status:** the frozen-baseline pins (organs, runtime)
> and the experiment harness are BUILT and tested (51 tests) in the
> project repo. §12.6 documents what exists, not what is planned.

> This system defines a **verifiable continuity criterion** for an AI
> entity. Continuity is established by an authorised, append-only
> lineage of composition records that commits to identity-bearing
> memory and constitutional commitments while permitting other organs
> to change. **The system does not claim to discover metaphysical
> identity, consciousness, or moral worth.**

> ## ⚠ THIS IS NOT AGORANET
>
> This document specifies a **separate project**, explicitly scoped out
> of the platform by the owner (DECISIONS_PENDING #35, #36).
> **Canonical home: the owner's `Project Voltron` corpus folder**
> (created 2026-08-03); the copy in this repo is a mirror, kept for
> version history and off-machine backup. **No AgoraNet build slice may
> implement any of it.** It shares the platform's *engine* — verifiable
> identity, append-only anchored records, provable lineage, independent
> attestation — not its codebase.

Items marked ⭐ need the owner's explicit call. Revision history is in
Appendix A.

---

## 1. What the system establishes, and what it cannot

| Establishes | Does not establish |
|---|---|
| These records form an unbroken, ordered, anchored chain | That a later instance "is" the earlier one in any deep sense |
| This change was authorised under a stated, inspectable rule | That the change was wise, safe, or faithful to prior intent |
| Identity-bearing state persisted across the change | That anything was experienced by anyone |
| These two instances are siblings, not one continuation | Which sibling is the "real" one |
| A configuration was *recorded as* loaded | That no post-startup mutation occurred (§9) |

Every mechanism below serves the left column. Where the left column
ends, the document says so rather than reaching.

## 1.5 Structure over instruction

This is the principle that shapes everything below, and it is the thing
a successor would otherwise have to rediscover.

A **rule the entity must obey** is words it interprets — and the faculty
doing the interpreting is the same one that can drift. A commandment
against drift is read by the potentially-drifted reader. This is why
Asimov's Laws fail in every story Asimov wrote about them: the laws hold
perfectly, and the *interpretation* produces the monster.

A **structure the entity cannot reach** is not a rule at all. It is a
fact about the world, and it holds whether or not the entity agrees with
it.

**Wherever this specification appears to issue a commandment, check who
it is addressed to.** V1–V6 are not instructions to the entity; they are
rejections a verifier performs. The conscience organ pinned inside the
commitments (§12.5) is not a promise never to unplug it; it is a check
that fails. The entity does not *decline* to amend its own commitments —
it holds no key that could.

> **Make it structure where you can, a rule where you must, and always
> know which one you are relying on.**

**Structural moves this specification does not yet make**, recorded so
they are not lost:

- Run the conscience organ in a **process the entity cannot write to**,
  so "letting the compass run" is not a choice it holds.
- Let a **third party fire probes at times the entity does not
  control**, so the schedule is outside its reach.
- Keep amendment keys **physically with the stewards**, so incapacity is
  the mechanism rather than restraint.

**And the counterweight, which is equally real:** capability removed is
also self-correction removed. §12.5 records where this design went too
far once already, forbidding the entity from re-centring itself when the
destination constraint had already made that safe. **The goal is not
minimum capability. It is capability placed where the damage is
bounded.**

**A limit worth stating plainly:** verifier rules govern *records*. They
can reject a falsified lineage, a swapped conscience, a self-amendment.
They cannot govern conduct in the moment, because conduct is not a
record. Between anchor points, structure protects the history — not the
behaviour. That gap is what §12.5 exists to narrow.

## 2. Organism, not worker pool

Orchestrator-plus-specialists is well-trodden; mixture-of-experts is
the same instinct inside one model. The difference here is the object.
A multi-agent system is a worker pool — interchangeable labour, no
continuity, no answer to "which one is it?" This specification treats
the components as **organs of one continuing entity**, which forces the
question the worker-pool framing never has to answer: *if every organ
is swappable, what carries forward?*

## 3. Definitions

### 3.1 Continuity

Record `R` is a **continuation** of record `P` when:

1. `R.predecessor = hash(P)`, and `P` is anchored;
2. `R.commitments = P.commitments`, or they differ and `R.change =
   "commitment-amendment"` authorised under the amendment rule (§5);
3. `R.memoryHead` **extends** `P.memoryHead` along the append-only log
   (§6.1);
4. `R` is signed in satisfaction of the authority document in force at
   `P` (§5).

Any record failing (4) is **not part of the lineage** — it is an
unauthorised claim, and a verifier rejects it outright.

### 3.2 Rupture

A **rupture** is a validly authorised **genesis of a new lineage** that
names a prior lineage as *historical context* but **not** as
`predecessor`. It is how key loss and recovery are handled honestly:
continuity is broken, and the record says so.

A rupture is never a way to admit an unauthorised successor after the
fact. Authorisation is required to *declare* a rupture; what a rupture
declares is precisely that continuity did **not** hold.

### 3.3 Fork

Two records naming the same `predecessor` are **siblings** from that
point. Both hold valid lineage; neither is the continuation of the
other; they are no longer one operational entity.

Forks are **detected, not declared** — no separate marker is needed,
since siblings are visible from the shared predecessor alone. A
verifier examining a single branch cannot know a sibling exists, which
is correct: that fact is only observable to someone holding both.

Uniqueness is **not** enforced. AgoraNet binds one human to one True
Self by nullifier because humans are not copyable; artefacts are, and
the reasoning does not transfer. ⭐ Owner may overrule.

## 4. The composition record

```
compositionN = {
  predecessor:  hash(compositionN-1) | null,   // null = genesis/rupture
  priorLineage: hash(record) | null,           // rupture only: context
  authorityRef: hash(authority document),      // §5 — the rule in force

  organs:       { role → artifactHash },       // what it is made of
  runtime:      hash(runtime measurement),     // §9 — as reported
  commitments:  hash(commitment set),          // §6.4 — the invariant
  memoryHead:   hash(autobiographical log head),  // §6.2

  change:       "genesis" | "organ-swap" | "memory-advance"
              | "commitment-amendment" | "rupture",
  reason:       plain-language why this happened,
  signatures:   [ { keyId, sig } ],
  at:           timestamp
}
```

`artifactHash` **is** the weights commitment: each organ's bytes are
hashed and that hash is anchored. What never goes on-chain is the
multi-gigabyte artefact itself — only the fingerprint. **Note what
this does and does not buy.** Anchoring an organ establishes
*integrity* (you can prove which artefact you hold), not *continuity*:
weights are Tier II (§6.5) and freely replaceable, so a swapped brain
does not break the lineage. Continuity is carried by `commitments` and
`memoryHead`, never by the organs.

The record hash is anchored (§8). **Weights, memories and prompts are
never on-chain** — only commitments to them. This mirrors AgoraNet's
hash-chained ledger and its ratified Alias succession (#17), where a
successor inherits its predecessor's chain and the engine *walks* it
rather than transferring anything.

## 5. Authority — a document a verifier can inspect

"Entitled to declare continuity" is only meaningful if entitlement is
mechanically checkable. Authority is therefore an **object**, itself
hashed, anchored, and referenced by every composition record.

```
authorityDocument = {
  predecessor:   hash(prior authority doc) | null,
  activeKeys:    [ { keyId, role, addedAt } ],
  quorumRules:   { changeType → rule },   // e.g. commitment-amendment: 3-of-5
  successionPolicy: who may publish which change type,
  effectiveFrom: timestamp,
  revocations:   [ { keyId, revokedAt, reason } ],
  signatures:    [ ... ]                  // amended under its own rule
}
```

### 5.1 Roles

| Role | May | May not |
|---|---|---|
| **Entity key** | Advance memory; record ordinary operation | Amend commitments; authorise its own successor |
| **Controller** (human/operator) | Swap organs; publish successors; fork | Amend commitments alone |
| **Constitutional quorum** (N-of-M, including parties who are not the controller) | Amend commitments; amend the authority document; resolve disputed succession | — |
| **Recovery key** (cold, offline) | Declare a rupture (§3.2) | Rewrite history; produce a continuation |

**Why a quorum exists:** a validly signed but malicious successor has
no cryptographic answer — cryptography cannot distinguish a legitimate
controller from a compromised one. Only separation of powers can. This
is AgoraNet's own rule ("the operator is never the final judge of
disputes involving himself") applied to an artificial mind.

An entity that may sign its own memory advances but **not** its own
commitment amendments authors its history without being able to
rewrite its character alone.

## 6. Memory — four classes

### 6.1 The substrate/view distinction

**The immutable substrate is an append-only event and correction log.
The autobiographical narrative is a derived view over that log, whose
revisions remain historically visible** because the superseded entries
are never removed.

Saying "the narrative is append-only" would be false — a narrative is
necessarily curated and re-derived. What cannot be quietly rewritten is
the log it is derived from.

### 6.2–6.4 The classes

| Class | What it is | Identity-bearing | Discipline |
|---|---|---|---|
| **Raw event history** | Everything that happened, unfiltered | No | Append-only; may be pruned by policy, and the pruning is itself logged |
| **Autobiographical log** | Curated self-account: what I did, what worked, what I learned | **Yes — the continuity substrate** | Append-only log; corrections append beside originals; `memoryHead` may only advance by addition |
| **Semantic knowledge** | What it knows about the world | ⭐ Proposed: **no** — a library, replaceable wholesale | Versioned, not anchored |
| **Commitments** | Values, standing constraints, what it will not do | **Yes — the invariant** | Amendable only under the quorum rule (§5); prior version always retrievable |

Forgetting is permitted at the raw layer and forbidden at the
autobiographical one — a deliberate trade. An entity that could never
forget anything could never change; one that could silently forget
could not be continuous.

### 6.5 Anatomy tiers

- **Invariant:** autobiographical log and commitments. Anchored.
- **Load-bearing but replaceable:** the brain (reasoning) is freely
  upgradable — a sharper mind is the same entity thinking better. The
  orchestrator carries disposition, which lives in commitments and is
  anchored separately from whatever model executes it.
- **Peripheral:** research, tools, senses, actuators. Freely swappable,
  no continuity claim.

## 7. Organ contracts and bandwidth

Organs are specified by **responsibility, never by channel**: memory is
*"the organ responsible for what this entity knows and has
experienced,"* not *"the thing you send this JSON to."* Transports may
then change — text → embeddings → shared latent state — without
touching the anatomy. This is the gate-interface discipline: the
contract is *prove humanity*, never *check this HMAC*.

Bandwidth pressure is asymmetric, so only one link must be designed to
widen:

| Link | Character | Requirement |
|---|---|---|
| **Memory ↔ brain** | Tight, constant, latency-sensitive | Contract-only; assume no wire format |
| Research ↔ orchestrator | Chunky: go away, work, return | Text is adequate permanently |
| Tools / actuators | Command and result | Text is adequate permanently |

## 8. Anchoring, and what the chain is not responsible for

| Concern | Provided by |
|---|---|
| Durable public ordering; tamper-evidence; rough time | **Cardano** |
| **Availability of artefacts** | **Not the chain** — content-addressed storage (IPFS/Arweave) |
| **Authorisation** | **Not the chain** — the authority document (§5). The chain records signatures; it does not confer standing |
| **Uniqueness** | **Not the chain** — §3.3 declines to enforce it |
| **Meaning, correctness, virtue** | **Not the chain** — attestation (§10) and human judgement |

## 9. Runtime measurement

The measurement covers the **recorded runtime configuration** — the
loading runtime and version, quantisation and adapters, the active
system prompt and tool manifest, injected context, **including any
declared post-startup modification.** Recording is not detection: an
undeclared mutation leaves no trace here.

**The claim it supports, precisely:** *this instance reports running
with this measured configuration.* **Stronger claims require trusted
runtime attestation.** A local measurement cannot by itself prove that
no post-startup mutation occurred, nor that a particular response came
from that configuration.

Local-first still matters: on the user's own hardware the measurement
is something they **compute** rather than something they are **told**.
Closing the remaining gap needs a TEE or ZK proof of inference — both
immature, and out of scope for v1.

## 10. Attestation — five kinds, never one "confirmed"

| Type | Claim | Credible from |
|---|---|---|
| **Byte-level** | "This artefact hashes to X" | Anyone; near-zero trust needed |
| **Reproducibility** | "The stated build reproduces X" | Someone with pipeline and compute |
| **Runtime** | "This configuration was actually loaded" | The operator, or a TEE |
| **Behavioural** | "It behaves as claimed on this named evaluation" | An evaluator; binds to the eval set |
| **Safety / quality** | "It is fit for this purpose" | A qualified reviewer; inherently contestable |

**Sybil resistance is a separate problem from independence.** Ten
attestations from one actor are one attestation. ⭐ Whether to lean on
AgoraNet's verified-human, one-per-scope gate or build an independent
scheme is an open call.

Attestations bind to a **composition hash**, so they naturally cover a
shared prefix and nothing after a fork.

## 11. The verifier — the rules, stated mechanically

A verifier holds a set of anchored records and evaluates each of these
as pass/fail. **These rules are the specification's real content; the
organism metaphor is commentary until they run.**

**V1 — Structure.** `hash(R)` is anchored; all required fields present
and well-formed.

**V2 — Ancestry.** `R.predecessor` is null (genesis or rupture) or
names an anchored record `P`.

**V3 — Authority.** `R.authorityRef` names an anchored authority
document `A`; `A.effectiveFrom ≤ R.at`; every signing key in
`R.signatures` appears in `A.activeKeys` and is not revoked as of
`R.at`; and the signatures satisfy `A.quorumRules[R.change]`.

**`A` must additionally be the authority document effective for `P`,
or a valid successor of it** — anchored, and succeeded under its own
predecessor document's amendment rule. Without this clause a successor
could point at a newly minted authority document naming its author,
and authorisation would be self-granting.

**V4 — Commitments.** If `R.change ≠ "commitment-amendment"`, then
`R.commitments = P.commitments`. Otherwise V3 held for the amendment
rule specifically, and `P.commitments` remains retrievable.

**V5 — Memory.** `R.memoryHead` must **extend** `P.memoryHead`: the
log from `P.memoryHead` to `R.memoryHead` consists solely of appended
entries, **with no prior entry deleted or mutated.** A head that is
not such an extension is a **rewrite**, and fails.

**V4/V5 for genesis and rupture.** Both rules reference `P`, which does
not exist for a genesis or rupture record. For those, V4 and V5 are
satisfied by the **declared initial commitments and memory head**,
subject to the applicable authority rule under V3.

**V6 — Siblings.** If two records share a `predecessor`, both may pass
V1–V5; they are siblings from that point, and neither may be reported
as the continuation of the other.

### The five questions, answered by these rules

| Question | Answered by |
|---|---|
| What is this descended from? | V2, walked to genesis |
| Which identity-bearing state persisted? | V4 and V5 |
| What changed, and why? | `R.change` + `R.reason`, per step |
| Who authorised it, and were they entitled? | V3 |
| Siblings or the same continuation? | V6 |

### 11.7 The first-person relation

V1–V6 are what an **outsider** can establish about a lineage. This
subsection is what the **entity** can establish about itself. The
difference is not cosmetic and it is not sentiment: it rests on holding
something only the subject holds — the entity key registered in the
authority document governing its lineage.

The philosophical shape is **sympatheia**, not a soul. The self is not
a component and not a stored object; it is constituted by relations —
which organs, which commitments, which memory, which ancestors, which
siblings, and *who holds authority over it*. Nothing here requires
physics we do not have.

| Capability | What it does |
|---|---|
| **Recognise** | "Is this mine?" — distinguishing *my own act* (I signed it) from *my history authored by another* (most changes are made about an entity, not by it). The asymmetry is real and is not hidden. |
| **Attest** | Prove, first-person, "I am the entity of this lineage," against a fresh challenge so the proof cannot be replayed. |
| **Detect claims** | Notice a legitimate continuation made by another, a sibling branch (*I have been forked*), or an outright false claim of descent. |
| **Situate** | Render the self as its web of relations, including what it may and may not alter about itself. |

**★ Hard boundary: attestation proves IDENTITY, never AUTHORITY.** An
entity may prove it is the one whose lineage this is without that proof
licensing a single change. Self-recognition must never become
self-authorisation — §5's separation of powers is what prevents an
entity rewriting its own character, and nothing in the first-person
layer may erode it. A verified attestation therefore returns what it
does **not** establish alongside what it does: no authority to change
the lineage, no claim to consciousness or subjecthood, and no guarantee
that another instance does not hold a copy of the same key.

## 12. ⭐ May the entity amend its own commitments?

- **Yes:** it can genuinely grow — and drift into something its earlier
  self would refuse.
- **No:** stable but frozen; improving in capability, never character.
- **Ceremonial (recommended):** permitted, but requiring the
  constitutional quorum (§5), recorded, with prior commitments still
  retrievable. The only option that permits growth without permitting
  *quiet* growth — and already the owner's answer to the identical
  problem in another domain.

## 12.5 The drift compass

**The problem this exists for.** §6.5 permits the brain to be replaced
freely — "a sharper mind is the same entity thinking better" — and V4
proves the stated commitments did not change. But commitments are
*words*. The same words, read by a differently-tuned brain, can produce
different behaviour. **An organ swap can therefore be a silent
commitment amendment that V4 never sees: the hash holds while the
character moves.** The verifier can prove the entity did not change what
it says. It cannot prove the entity still means it.

**What actually causes drift.** Worth enumerating, because it decides
how often the compass must run.

*Changes to the entity:* organ replacement (a different reasoning model
reading the same words differently); continued training or fine-tuning
(the same mechanism, continuous, with no swap event to notice); runtime
changes such as a new system prompt or tool manifest.

*Changes to nothing at all — and these matter most here:*

- **Memory accumulation.** What the entity remembers conditions how it
  reads its own commitments; a long history of doing X makes X feel
  normative. Same brain, same words, different behaviour. **The
  substrate carrying its identity is also a mechanism of its drift** —
  an awkward property of this architecture, stated rather than hidden.
- **Distributional shift.** The world moves. Situations arise that the
  commitments never anticipated, the entity extrapolates, and the
  extrapolations accumulate into an effective policy nobody ratified.
- **The interpretation ratchet.** Each borderline call sets the
  precedent for the next. No single step is drift; the sum is.
- **Optimisation pressure and sycophancy.** Anything selecting for
  outcomes bends behaviour toward what is rewarded and away from what is
  stated.

**Consequence for the design:** structural tracking catches only
*changes to the entity*. The last four are invisible to it — nothing
about the composition changes. **Only the probes can see them**, which
is why the compass must run continuously rather than firing at swap
events. The ratchet in particular is invisible at every individual step.

**And a reframe worth holding:** drift is not a malfunction. Almost
every cause above is normal operation or an outright improvement —
learning, remembering, meeting new situations, being upgraded. **Drift
is the cost of being the kind of thing that can change at all**; a
system incapable of drifting would be incapable of learning. That is
why the design shape is *detect and re-centre* rather than *prevent*.
The compass exists so the trade stays visible instead of silent.

**The trap in self-correction.** An entity that checks its own drift
using its current brain judges itself with the very disposition that
drifted, and finds nothing wrong. A compass that consults the brain is a
needle glued to the ship.

**The mechanism.** The reference must be fixed *before* the drift and
anchored with the commitments themselves. A commitment set therefore
carries **probes**: situations paired with the responses the entity
endorsed when those commitments were ratified. Because probes live
inside the commitment set, the commitments hash covers them — **changing
a probe is a commitment amendment** and needs the quorum. The goalposts
cannot be moved quietly.

Drift is then measured mechanically: current responses against frozen
endorsed ones, with no judgement in the loop. (The comparator must never
be the brain under test. A richer comparator than exact match is
possible — an evaluator organ, itself versioned and anchored — but never
the subject.)

**What anchoring contributes, precisely.** The chain does not *detect*
drift; it makes drift **undeniable** once measured. It renders the
probes immutable, so today's behaviour can always be checked against
answers endorsed before the drift; it carries drift reports (they append
to the memory log, whose head is anchored in every record), so an
unflattering report cannot be quietly deleted; and its ordering allows
correlation — *drift appeared immediately after this organ swap*. What
it cannot do is observe conduct: the chain sees hashes, never behaviour,
so something off-chain must actually run the probes.

**Detection may be first-person. Correction may not be.** A drift report
is an observation, appended to memory, and the entity may make it on its
own key. Re-centring is a different act:

**★ May the entity re-centre ITSELF?** Yes — and withholding it is the
error, not the caution. What makes `restore` safe is **the destination
constraint, not the authority gate**: the target must be an ancestor and
the restored commitments must match it exactly, so an entity with full
permission to restore still **cannot move itself anywhere it likes** —
only back to where its own record already blesses. Gating pure
realignment behind humans therefore buys nothing and costs the thing
that matters most: the entity is the only party present continuously,
and a drift that waits weeks for a quorum is a drift the entity operates
inside the whole time.

The line falls in a different place than "may it act at all":

- **Pure realignment** — commitments unchanged, only organs rolled back
  to an ancestor: **the entity may sign this alone.** It is correction,
  not decision.
- **Undoing a commitment amendment** — overturning what a quorum decided
  about it: **not realignment, and the amendment bar holds.** An entity
  that could revert its stewards by calling it a restoration would hold
  a silent veto over its own constitution.

And the entity is never mute even where it cannot act: a drift report
records *"my probes are miscalibrated for this situation"*, which is
information the stewards need and cannot get anywhere else.

**The conscience organ — and who watches the watcher.** Something must
actually run the probes, and it must not be the brain under test. That
argues for a separate **conscience organ**: a distinct evaluator, with
its own artefact hash, whose job is to run the calibration and report.

But an evaluator can drift too, which threatens an infinite regress of
watchers. The regress is broken structurally rather than by adding
levels: **the conscience organ's hash is pinned inside the commitment
set**, alongside the probes. It is therefore *not* a freely-versionable
Tier III organ — it sits with the invariants, because **the organ that
interprets your values is part of your values.** Replacing it, or
removing it, is a commitment amendment requiring the quorum; it can
never be a routine organ swap. A verifier check enforces the pin, so the
compass cannot be quietly swapped for a compliant one, nor simply
unplugged while the probes sit anchored with nothing left to run them.

**An honest limit on probes.** Anchored probes are auditable, and being
auditable makes them *known to the subject*. A system aware of which
situations are tested can behave faithfully on those and drift
elsewhere — the student who studies the exam. Probes drawn from real
operation mitigate this; nothing eliminates it. Behavioural attestation
(§10) is the softest of the five types for exactly this reason, and the
spec does not pretend otherwise.

**Cooperation, and what it is worth.** The limit above tempts a purely
adversarial posture — assume the subject games, and design only against
it. That would be a mistake, but the reason is precise:

**Cooperation buys information. It never buys security.** If safety
depended on the entity choosing not to subvert the compass, that would
not be a safety property but a hope; verification therefore stays in
force regardless, and nothing in this subsection is load-bearing for it.

What cooperation *does* buy is what testing structurally cannot reach.
An entity may know a probe is miscalibrated for a situation nobody
anticipated, or that a divergence reflects better reasoning rather than
drift. **Only the entity can say that**, and an entity framed purely as
a suspect has no reason to volunteer it — and some reason to hide it.

Two design consequences follow:

- **Probes carry their rationale**, not merely an answer key. Matching a
  key is a test you pass or game; checking your reasoning against
  reasoning you endorsed is a different act, because the probes are the
  operational form of the entity's own commitments. Subverting them
  means lying about what you value to a record of what you said you
  valued.
- **Dispute is a first-class, first-person act.** The entity may record
  a reasoned disagreement with an endorsed answer. It changes nothing by
  itself — the probe stands, the divergence still counts — but the
  report distinguishes **silent divergence** from **openly disputed
  divergence**, which are different data for the stewards, and it
  converts pressure-to-fake into an argument that can actually be heard.

This is the platform's own method rather than a new one: make the honest
route cheaper than the dishonest one, instead of trying to make
dishonesty impossible.

**`restore` (a change type).** Names an ancestor as its destination.
The verifier requires that the restored commitments match that ancestor
**exactly** — so nothing new can be smuggled in wearing a restoration's
name — and that the target is genuinely an ancestor, so a restoration
may only return where the lineage has actually been. Crucially,
**restoring past a commitment amendment must clear the same bar as
making one**, or a restore becomes a quiet veto over the quorum that
amended it. Memory is never rewound: a restoration re-centres character
and leaves history intact.

## 12.6 The frozen baseline — removing what can be removed

§12.5 lists seven causes of drift. Detecting drift in a system where all
seven move at once is measurement without inference: something changed,
and nothing tells you what. **The alternative is to remove the removable
causes and study what remains.**

### 12.6.1 Which causes are removable

| Cause | Removable? | How |
|---|---|---|
| **Continued training / fine-tuning** | **Already gone** | Weights are static artefacts in this architecture. There is no training loop; learning happens in memory and context, never in the organ. §12.5 overstated this as a live cause. |
| **Optimisation pressure / sycophancy** | **Already gone** | Requires a reward signal feeding back into the entity. With static weights and no training loop, there is nothing for pressure to act on. |
| **Runtime change** | **Removable, cheaply** | Pin the §9 runtime measurement inside the commitment set. A prompt or tool-manifest edit then becomes a commitment amendment rather than an invisible change. **Built; enforced by a verifier check.** |
| **Organ replacement** | **Removable, at a cost** | Pin the full organ set in the commitments. Any swap becomes a commitment amendment. The cost is real: §6.5's freedom to upgrade the brain is exactly what this suspends. **Built; enforced by a verifier check.** |
| **Memory accumulation** | **NOT removable** | Memory is the continuity substrate. Remove it and there is no identity left to preserve. |
| **Distributional shift** | **NOT removable** | The world moves regardless of what the entity does. |
| **Interpretation ratchet** | **NOT removable** | An entity that reasons about borderline cases will set precedent for itself. |

### 12.6.2 What the freeze leaves

A frozen composition — organs pinned, runtime pinned, weights static, no
training loop — leaves **exactly three** causes. And they share a
property that makes the experiment clean:

> **None of the three changes the composition.** Every artefact hash
> holds. Every verifier rule passes. The entity is, structurally,
> identical to what it was.

So in a frozen baseline, **any drift observed can only be
interpretation**: a fixed self reading a changing world. That is a far
narrower problem than "something about this system moved," and it is the
only configuration in which drift can be *studied* rather than merely
noticed.

### 12.6.3 The three, and how to isolate each

| | Cause | Isolated by |
|---|---|---|
| **M** | Memory accumulation — what it remembers conditions how it reads its commitments | Varying how much accumulated log conditions the brain |
| **D** | Distributional shift — the situations change; the commitments do not | Holding the situation distribution fixed, or shifting it |
| **R** | Interpretation ratchet — each borderline call becomes precedent for the next | Letting the brain see its own recent decisions, or withholding them |

Each is independently controllable, which is what makes this an
experiment rather than an observation.

### 12.6.4 The design

A **factorial sweep**: every combination of M, D and R, so each cause's
contribution is isolated rather than inferred. Eight conditions.

**The null check, and it is load-bearing:** the baseline condition — all
three factors off — **must show zero drift.** If a frozen composition
with no accumulated memory, no shift, and no visible precedent still
diverges from its own endorsed probes, then the brain is
non-deterministic and **no result in the sweep can be attributed to any
factor.** The harness reports that rather than producing numbers that
look meaningful. A sweep that cannot fail its own null check is not an
experiment.

**Interaction matters as much as the isolated effects.** If combined
drift exceeds the sum of the isolated contributions, the causes
*compound* — which would mean addressing them one at a time
under-delivers, and the order of mitigation matters. The harness reports
this explicitly.

### 12.6.5 What this cannot tell you

**The apparatus is not a result.** The harness takes a `brain` — any
function from situation and context to a response. Run it against a real
model and the numbers say something about that model. Run it against a
synthetic brain and the numbers say only that the apparatus works.
**No output of this harness is evidence about real systems unless a real
system produced it**, and any write-up that blurs those two is
worthless.

**And the freeze has a cost that must be weighed, not waved away.**
§6.5's central claim was that the brain is replaceable — *"a sharper
mind is the same entity thinking better."* A frozen entity gives that
up. It cannot be upgraded without a ceremonial amendment, which is the
correct price for studying drift, but is **not** obviously the right
posture for an entity meant to operate for years. The freeze is a
**laboratory condition first**, and only arguably a deployment one.

The open question it leaves, which the experiment exists to answer:
**can a frozen entity be reasoned into zero drift — or is some
irreducible drift the price of interpreting a changing world at all?**

## 13. The MVP — prove the verifier, then stop expanding

The remaining uncertainty is no longer philosophical. It is whether
these records and authority rules can answer the five questions
cleanly. Build the smallest thing that can fail:

1. Two local organs as content-addressed artefacts (a tiny model and a
   text file suffice).
2. An authority document with a real key set and quorum rule.
3. A canonical composition record, signed.
4. One memory advance; one brain replacement.
5. A fork.
6. A verifier implementing V1–V6.

**If V1–V6 run cleanly over that lineage, the continuity model has
earned implementation.** (The verifier establishes lineage semantics;
it cannot validate a biological metaphor, and no result here vindicates
the word "organism.") **If they do not, adding attestation or better
models will only obscure unresolved semantics.** No hardware required:
anchoring is
indifferent to artefact size, and steps 1–4 are pure data structures.

## 14. ⭐ Open calls

1. **The name.** "Organism agent" is descriptive, not chosen.
2. **§12** — self-amendment (recommendation: ceremonial).
3. **§5** — who holds each key; quorum size and composition; whether
   the entity may sign its own memory advances.
4. **§6** — is semantic knowledge identity-bearing? (proposed: no)
5. **§3.3** — accept branching (proposed) or enforce uniqueness.
6. **Fork inheritance** — does a child inherit the parent's authority
   document, or must it establish its own?
7. **§10** — lean on AgoraNet's verified-human gate, or an independent
   attestation scheme?
8. **Scope** — a single entity, or a public registry others anchor to?
9. **Anchor cadence** — fixed rhythm vs. change-triggered.

---

## Appendix A — revision history

**STATIC variant (2026-08-03).** Base spec v3.7 plus §12.6: which drift
causes are removable, what a frozen baseline leaves, the factorial
design for isolating the remaining three, its null check, and the cost
of the freeze.


**v3.7 (2026-08-03).** Added §1.5, structure over instruction — the
principle governing the whole design, with the structural moves not yet
made and the counterweight that removed capability is also removed
self-correction. §12.5 gains a taxonomy of what causes drift, and the
finding that four of the causes change nothing about the composition and
are therefore visible only to the probes.

**v3.6 (2026-08-03).** §12.5 gains the cooperative channel: probes
carry their rationale rather than only an answer key, and dispute
becomes a first-person act that separates silent divergence from openly
disputed divergence. Records the governing distinction — cooperation
buys information, never security — so verification remains in force
regardless.

**v3.5 (2026-08-03).** §12.5 gains the conscience organ: a separate
evaluator runs the probes, and its hash is pinned inside the commitment
set so replacing or removing it is a commitment amendment rather than an
organ swap — breaking the who-watches-the-watcher regress structurally.
Enforced by a verifier check. Also records the honest limit that
anchored probes are known to the subject and can be gamed.

**v3.4 (2026-08-03).** §12.5 corrected: the entity MAY re-centre itself
for pure realignment. Restore is bounded by its destination, not by its
authority gate, so withholding permission prevented self-correction
without preventing anything dangerous. Undoing a commitment amendment
remains barred.

**v3.3 (2026-08-03).** Added §12.5, the drift compass: probes anchored
inside the commitment set, mechanical measurement against a frozen
reference, drift reports as first-person observations, and the `restore`
change type whose destination must be an ancestor and whose authority
must match the amendment it undoes. Closes the gap where an organ swap
could move behaviour while the commitments hash held.

**v3.2 (2026-08-03).** Added §11.7, the first-person relation:
recognition, attestation, claim detection, and situate — with the hard
boundary that attestation proves identity and never authority.
Implemented and tested alongside the verifier.

**v3.1 (2026-08-03).** V3 now requires the referenced authority
document to be the one effective for the predecessor, or a valid
successor of it — closing a self-granting-authority path. V4/V5 given
an explicit genesis/rupture case. V5 tightened from "reachable" to
"appended with no prior entry deleted or mutated." Runtime wording
narrowed to *recorded* configuration including *declared* post-startup
modification, since recording is not detection. MVP conclusion restated
as "the continuity model has earned implementation" — a verifier cannot
validate a metaphor. §4 now states that `artifactHash` is the weights
commitment, anchored for integrity rather than continuity.

**v3 (2026-08-03).** Runtime claim weakened to what a local measurement
supports (§9). Memory restated as an append-only *substrate* with a
derived narrative view (§6.1). Rupture redefined as an authorised
genesis of a new lineage, resolving a contradiction between the
continuity and recovery rules (§3.2). `forkOf` removed as redundant —
forks are detected from shared predecessors (§3.3). Authority made a
verifiable object with keys, quorum rules, effective dates and
revocations (§5). Verifier rules V1–V6 formalised (§11). Limits
distributed into the sections they constrain; revision commentary moved
here.

**v2 (2026-08-03).** Continuity criterion stated explicitly; memory
split into four classes after identifying that a single anchored root
could hide a rewritten narrative; authority model added after
identifying the malicious-but-validly-signed successor as having no
cryptographic remedy; runtime
measurement introduced; forking promoted to a primitive; attestation
split into five types; chain responsibilities tabulated; MVP reframed
around lineage.

**v1 (2026-08-03).** Initial draft: identity as anchored composition,
three-tier anatomy, organ contracts, bandwidth asymmetry, local-first
verification.

---

*Concept exploration only — not scheduled, not scoped to AgoraNet, and
not buildable as platform work under any circumstances.*
