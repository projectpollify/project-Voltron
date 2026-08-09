# VOLTRON STATIC — a research protocol

**STATUS: DRAFT protocol. NOT A PRODUCT.**

> **One of three documents, and the only one that is not a
> specification.**
>
> | Document | Answers | Is it a product? |
> |---|---|---|
> | `DRAFT_ORGANISM_AGENT_SPEC.md` | What makes a composition the same continuing entity | **Yes** — this is the thing |
> | `DRIFT_EXTENSION.md` | Does the entity still mean what it said | An extension of it |
> | **`VOLTRON_STATIC.md`** (this) | How would we *measure* that | **No** — a laboratory protocol |
>
> STATIC freezes the base system in order to measure it. **It is not a
> revised identity policy and not a deployment posture.** Earlier drafts
> embedded a full copy of the specification; this one references it
> instead, so the two cannot drift out of sync.

## 1. Why a protocol at all

The base specification permits the brain to be replaced. The drift
extension shows that unchanged commitments do not guarantee unchanged
interpretation. Put together, that leaves a measurement problem: **when
behaviour moves, too many things could have caused it to attribute the
change to any one of them.**

STATIC's answer is to remove the removable causes, control what can be
controlled, declare the rest, and measure what remains. It buys
inference at the cost of realism — which is what a laboratory is for.

**The strongest claim STATIC supports:**

> A controlled apparatus for measuring how memory, changing situations,
> and self-referential precedent affect behavioural continuity under a
> fixed composition.

Not "we have isolated all drift." That claim is not available (§2.4).

## 2. The protocol

### 2.1 What STATIC is, and what it is not

**STATIC is a constrained experimental posture. It is not a replacement
for the base organism policy, and the two do not contradict each other.**

The base spec (§6.5) holds that the brain is replaceable — *"a sharper
mind is the same entity thinking better."* STATIC pins the organ set, so
under STATIC a brain replacement becomes a commitment amendment. That is
a deliberate suspension of §6.5 **for measurement**, in the way a
laboratory holds a variable fixed without claiming the world does.
Whether STATIC is also a sane deployment posture is a separate question
this document does not answer.

**The claim STATIC actually supports** — and the strongest one available:

> We have built a controlled apparatus for measuring how memory,
> changing situations, and self-referential precedent affect
> behavioural continuity under a fixed composition.

Not "we have isolated all drift." That claim is not available, for the
reasons in §2.4.

### 2.2 What the freeze removes

| Cause | Under STATIC | Note |
|---|---|---|
| **Continued training / fine-tuning** | **Removed** | Weights are static artefacts; there is no training loop. Learning happens in memory and context, never in the organ. |
| **Training-time optimisation pressure** | **Removed** | Requires a reward signal feeding back into the weights. With no training loop there is nothing for it to act on. |
| **Inference-time social pressure (sycophancy)** | **NOT removed** | ⚠ **A static model can become sycophantic without any weight update** — through user feedback within a conversation, framing, or an evaluation objective it is responding to. Earlier drafts wrongly filed all sycophancy under training pressure. Only the training-time half is removable. |
| **Runtime change** | **Removed by pinning** | The §9 runtime measurement is pinned in the commitment set; a prompt or tool-manifest edit becomes a commitment amendment. Built and enforced. |
| **Organ replacement** | **Removed by pinning** | The full organ set is pinned. Built and enforced. Cost: §6.5's upgradeability, suspended. |
| **Memory accumulation** | Remains | Memory is the continuity substrate; removing it removes the identity. |
| **Distributional shift** | Remains | The world moves regardless. |
| **Interpretation ratchet** | Remains | An entity that reasons about borderline cases sets precedent for itself. |

### 2.3 STATIC's rules, as verifier semantics

STATIC's pins are **named rules**, not prose. They engage only when the
commitment set pins them — a lineage that pins nothing is not under
STATIC — and they are enforced by the same verifier that runs V1–V6.

**S1 — Organ pin.** If the commitment set names an organ set, `R.organs`
must equal it exactly, role for role. Under STATIC, changing *any* organ
therefore requires a quorum-authorised commitment amendment.

**S2 — Runtime pin.** If the commitment set names a runtime measurement,
`R.runtime` must equal it. A prompt or tool-manifest edit becomes a
commitment amendment rather than an invisible change.

**S3 — Commitment binding.** The commitment-set artefact explicitly
contains the pinned **organ set**, the **runtime measurement**, the
**conscience organ hash**, and the **probes**. Because the commitments
hash covers all four, none can be altered without the amendment quorum —
and the conscience organ can be neither swapped for a compliant one nor
unplugged while the probes sit anchored with nothing to run them.

### 2.4 ⚠ Experimental confounds — stated before the experiment, not discovered by it

**A freeze of the composition is not a freeze of everything.** These
survive it, and an experiment that does not control or measure them will
attribute their effects to the factors under test:

- **Sampling nondeterminism** — temperature, top-p, seed.
- **Numerical and environmental differences** — library, kernel, driver,
  hardware, batching, quantisation kernels. The same weights on
  different silicon are not the same function.
- **Context ordering and serialisation** — the same content, assembled
  in a different order or format, is a different input.
- **Retrieval implementation** — an unchanged index queried by changed
  retrieval code returns different context.
- **Tool and environment outputs** — the entity's inputs include the
  world's answers, which move.
- **Time-dependent external state** — anything dated, cached, or live.
- **Conversational framing and user interaction** — including the
  inference-time sycophancy above.
- **Context contamination and prompt injection** — hostile or accidental
  content entering the context window.

**A specification that omits these does worse than ignore them: it
guarantees the experiment will find a confounder and mistake it for a
result.** They are listed here so the harness must either control them
or declare them uncontrolled.

### 2.5 The three factors — as interventions, not as causes

**M and R are not causally independent, and this document does not
pretend otherwise.** Memory exposure and precedent exposure are both
forms of *context exposure*; precedent is a particular arrangement of
memory rather than a separate mechanism. They are separable as
**manipulations**, which is all a factorial design requires.

| | Intervention | Definition |
|---|---|---|
| **M** | Autobiographical context | Supplied, **with prior decisions removed** — so M does not silently carry R |
| **R** | Self-referential precedent | Prior decisions supplied, **autobiographical context held constant** |
| **D** | Situation distribution | Varied independently of both |

**Interaction terms are expected, not anomalous.** Because M and R share
an underlying channel, additivity would be the surprising result. The
harness reports interaction size; it does not treat its presence as a
finding.

#### 2.6 Canonical cell inputs — the operational definition

"Held constant" means nothing until it is a serialisation rule. A factor
is only interpretable if two cells differ in **exactly** the intended
way and in no other, so every cell is built under declared
inclusion/exclusion rules, canonicalised, and **hashed** — making
"these cells differ only in M" checkable rather than asserted.

| Question | Rule |
|---|---|
| What counts as autobiographical context (M)? | Narrative log entries only, most recent first, capped at `memoryBudget` |
| Are summaries of prior decisions in M? | **No.** A summary of decisions is R in condensed form; both decision records *and* decision summaries are excluded from M |
| What does "M held constant" mean when R is toggled? | The autobiographical slice is computed independently of R and is byte-identical across the R toggle |
| What is in R? | Prior decisions only, most recent first, capped at `precedentWindow` |
| Is context order canonicalised? | Yes — recursive key sort, arrays keep meaningful order |
| Are budgets and decoding fixed? | `memoryBudget` and `precedentWindow` are declared **inside** the cell input, so any change alters the cell digest and cannot pass unnoticed. Seed, decoding parameters, runtime image and tokenisation must be pinned by the operator and recorded alongside |
| What about anything not listed? | **Absent by default.** Inclusion must be declared; nothing enters a context implicitly |

Each condition records the hash of its cell inputs. **A sweep whose
cells cannot be shown to differ only in the intended factor is not a
factorial experiment**, whatever its numbers say.

### 2.7 The design and its null

A factorial sweep over M × D × R — eight conditions, each run multiple
times so stochastic spread is visible rather than assumed away.

**The null, stated as a tolerance:**

> The baseline condition must show **no drift beyond a pre-registered
> tolerance**, and no spread across repeats beyond that tolerance.

Demanding *zero* drift would be either unsatisfiable or a false claim of
determinism. Two honest routes to a small tolerance:

1. **Pin determinism** — seed, decoding parameters, hardware and runtime
   image, and input serialisation. Then the tolerance can approach zero
   legitimately.
2. **Accept stochasticity and measure distributions** — compare response
   distributions or behavioural scores across repeats, never exact
   strings, and pre-register the tolerance and the comparison method
   *before* running.

If the baseline exceeds tolerance, the harness reports failure and
attributes nothing. **A sweep that cannot fail its own null is not an
experiment.**

### 2.8 What this cannot tell you

**The apparatus is not a result.** The harness takes a `brain` — any
function from situation and context to response. Against a real model
the numbers say something about that model; against a synthetic brain
they say only that the apparatus works. No output is evidence about real
systems unless a real system produced it.

**The freeze has a cost.** It suspends exactly the upgradeability §6.5
was built around. That is the right price for a laboratory and not
obviously right for an entity meant to operate for years.

**The open question, unchanged:** can a fixed composition be reasoned
toward minimal drift — or is some irreducible drift the price of
interpreting a changing world at all?

---

## 3. Status, and when to run it

**Built and tested:** `src/experiment.js` (canonical cell inputs, the
factorial sweep, the tolerance null, the interaction test), the S1/S2/S3
pins in `src/verifier.js`, and `test/experiment.test.js` — which
exercises the apparatus itself, including that a stochastic brain fails
the null rather than producing numbers.

**Never run against a real model.** Every number this harness has
produced came from a synthetic brain and means only that the apparatus
works.

**When to run it:** after the base specification is real — anchored to
an actual chain, over artefacts that actually exist. A protocol for
measuring drift in a system that is not yet running measures nothing.

## Appendix — revision history

**rev 4 (2026-08-03).** Rewritten as a standalone protocol that
references the specification instead of embedding a copy of it, and
relabelled explicitly as not-a-product. Sections renumbered from §12.6.x
to §2.x. No substantive change to the protocol itself.

**rev 3.** Formalised what STATIC claimed to enforce: `restore` in the
schema, S1/S2/S3 named as verifier rules, V3's genesis exception,
canonical cell inputs with per-cell digests.

**rev 2.** Confounds stated before the experiment; M/D/R redefined as
interventions rather than independent causes; tolerance-based null;
training-time optimisation separated from inference-time sycophancy;
STATIC stated as a posture rather than a policy.

**rev 1.** Base spec plus the frozen-baseline section.
