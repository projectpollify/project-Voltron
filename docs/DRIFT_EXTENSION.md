# Drift Extension — does the entity still mean it?

**STATUS: DRAFT — an EXTENSION to `DRAFT_ORGANISM_AGENT_SPEC.md`.**

> **One of three documents.** The specification answers *what makes a
> composition the same continuing entity*. This extension answers a
> different question — *does the entity still mean what it said*. They
> were written together and are filed apart, because conflating them
> made both harder to judge.
>
> **Depends on:** the composition record (§4), the authority model (§5),
> memory (§6), and the verifier (§11) of the base specification. The
> `restore` change type is defined *there*, since the verifier must know
> it; everything else about drift is here.
>
> **Status of the problem:** real and demonstrated. The machinery is
> built and tested. It is deliberately **not** the next thing to build —
> a compass needs a ship, and the base specification is not yet running
> against real artefacts on a real chain.

---

## 1. The drift compass

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

---

## Appendix — status

Built and tested in this repository: `src/drift.js` (probes,
measurement, dispute, drift reports), the conscience-organ pin and the
`restore` rule in `src/verifier.js`, and their tests in
`test/drift.test.js`.

**Not yet done:** probes drawn from live operation rather than a
fixture, and a comparator richer than exact match — an evaluator organ,
itself versioned and anchored, which must never be the brain under test.
