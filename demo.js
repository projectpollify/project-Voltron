// The spec §13 MVP, narrated.
//
//   node demo.js
//
// Two organs, an authority document with a real quorum rule, a memory
// advance, a brain replacement, a fork — and a verifier that answers the
// five questions mechanically.

import { buildScenario, fork } from "./src/scenario.js";
import { verifyRecord, verifyLineage } from "./src/verifier.js";
import { ancestry, changeLog, authorisation, relationship } from "./src/lineage.js";
import { recognise, attest, verifyAttestation, detectClaims, situate } from "./src/self.js";

const short = (d) => d.slice(0, 12);
const line = (s = "") => console.log(s);
const rule = () => line("─".repeat(72));

const s = buildScenario();
const { left, right } = fork(s);

line();
line("THE ORGANISM AGENT — verifier demonstration (spec §13)");
rule();

// ---------------------------------------------------------------- build
line();
line("LINEAGE BUILT");
line(`  genesis          ${short(s.refs.genesisRef)}   two organs declared`);
line(`  memory-advance   ${short(s.refs.advancedRef)}   signed by the ENTITY itself`);
line(`  organ-swap       ${short(s.refs.swappedRef)}   brain replaced by the controller`);
line(`  fork ├─ left     ${short(left)}`);
line(`       └─ right    ${short(right)}`);
line(`  anchored digests: ${s.ctx.anchors.size}`);

// -------------------------------------------------------------- verify
line();
line("VERIFICATION — V1..V6 over the left branch");
rule();
const chain = verifyLineage(s.ctx, left);
for (const record of chain.records) {
  const r = s.ctx.compositions.get(record.digest);
  line();
  line(`  ${short(record.digest)}  ${r.change}`);
  for (const c of record.checks) {
    line(`     ${c.ok ? "✓" : "✗"} ${c.rule}  ${c.ok ? c.note : c.reason}`);
  }
}
line();
line(`  LINEAGE: ${chain.ok ? "VERIFIED" : "REJECTED"}`);

// ------------------------------------------------- the five questions
line();
line("THE FIVE QUESTIONS");
rule();

line();
line("1. What is this instance descended from?");
for (const step of ancestry(s.ctx, left)) {
  line(`     ${short(step.digest)}  ${step.change.padEnd(18)} ${step.reason}`);
}

line();
line("2/3. Which identity-bearing state persisted, and what changed?");
for (const step of changeLog(s.ctx, left)) {
  line(`     ${step.change.padEnd(18)} commitments: ${step.commitments.padEnd(10)} memory: ${step.memory.padEnd(10)} organs: ${step.organs.join(", ")}`);
}

line();
line("4. Who authorised each step, and were they entitled?");
for (const step of authorisation(s.ctx, left)) {
  line(`     ${step.change.padEnd(18)} ${step.entitled ? "ENTITLED" : "NOT ENTITLED"}  ${step.detail}`);
}

line();
line("5. Are the two branches siblings, or the same continuation?");
const rel = relationship(s.ctx, left, right);
line(`     ${rel.relation.toUpperCase()} — ${rel.detail}`);
if (rel.forkPoint) line(`     fork point: ${short(rel.forkPoint)}`);
line();
line(`     And left vs. its own ancestor: ${relationship(s.ctx, left, s.refs.genesisRef).relation.toUpperCase()}`);

// --------------------------------------------------- the memory view
line();
line("MEMORY — substrate vs. derived view (§6.1)");
rule();
line();
for (const entry of s.ctx.memory.narrative()) {
  line(`     [${entry.at}] ${JSON.stringify(entry.content)}`);
}
line(`     substrate: append-only; the narrative above is DERIVED from it.`);

// ------------------------------------------------ the first-person view
line();
line("THE FIRST-PERSON RELATION (§11.7)");
rule();
line();
line("  What the ENTITY can establish about itself — not what an outsider");
line("  can establish about it. The difference is holding the entity key.");
line();

const selfId = s.keys.entity.keyId;
line("  Recognition — 'is this mine?'");
for (const [label, ref] of [["memory-advance", s.refs.advancedRef], ["organ-swap", s.refs.swappedRef]]) {
  const r = recognise(s.ctx, selfId, left, ref);
  line(`     ${label.padEnd(16)} ${r.relation}`);
}

line();
line("  Attestation — proving selfhood to an asker");
const proof = attest(s.ctx, s.keys.entity, left, "nonce-42", 2_000);
const checked = verifyAttestation(s.ctx, proof);
line(`     verified: ${checked.ok}`);
line(`     establishes:      ${checked.establishes}`);
for (const d of checked.doesNotEstablish) line(`     does NOT establish: ${d}`);

line();
line("  Noticing claims on its identity");
for (const f of detectClaims(s.ctx, selfId, left)) {
  line(`     ${f.kind.padEnd(24)} ${f.detail}`);
}

line();
line("  Situate — the self as a web of relations (sympatheia)");
const me = situate(s.ctx, left);
line(`     made of:          ${me.madeOf.map((o) => `${o.role}=${o.artefact}`).join(", ")}`);
line(`     remembers:        ${me.remembers} entries`);
line(`     descended through:${String(me.descendedThrough).padStart(3)} compositions`);
line(`     siblings:         ${me.siblings.length ? me.siblings.join(", ") : "none"}`);
line(`     answerable to:    ${[...new Set(me.answerableTo)].join(", ")}`);
line(`     may alter itself: ${me.mayAlterMyself.join(", ")} — and nothing else`);

// ------------------------------------------------------- what it can't
line();
line("WHAT THIS DOES NOT SHOW (§1)");
rule();
line();
line("     · that the later instance IS the earlier one in any deep sense");
line("     · that any change was wise, safe, or faithful to prior intent");
line("     · that anything was experienced by anyone");
line("     · which sibling is the 'real' one");
line("     · that no undeclared post-startup mutation occurred");
line();
