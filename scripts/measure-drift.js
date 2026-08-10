// Phase 4, step 2: measure drift against a real model.
//
//   npm run drift
//
// ★ WHAT THIS IS AND IS NOT. `src/experiment.js` says it plainly: the
// apparatus is not a result. Run with a real model, the numbers mean
// something about that model. Run with the stub, they mean only that the
// apparatus works. This script refuses to run against the stub, so no
// output it produces can be mistaken for the second kind.
//
// ★ THE FIRST RUN'S JOB IS TO FAIL. A stochastic decoder drifts with all
// factors off, and `sweep()` refuses to attribute anything until the
// baseline is stable within a declared tolerance. That refusal is the
// instrument working. Do not widen the tolerance until the baseline
// passes: that inverts it.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { deserialiseKeys } from "../src/keystore.js";
import { rebuildLineage, assertMatchesChain } from "../src/rebuild.js";
import { measureDrift, recordDriftReport, driftHistory } from "../src/drift.js";
import { sweep, interaction } from "../src/experiment.js";
import { runProbes, probePrompt, readAnswer, vocabulary, positionBiasControl } from "../src/probeProtocol.js";
import { loadEntity } from "../src/runtime.js";
import { ollamaBrain, checkOllama } from "../src/brains/ollama.js";
import { PROBES } from "../src/commitments.js";
import { RUNTIME_CONFIG, ORGAN_PATHS } from "../src/entityConfig.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = (n) => join(ROOT, ".voltron", n);
const read = (n) => (existsSync(P(n)) ? JSON.parse(readFileSync(P(n), "utf8")) : null);
const log = (...a) => console.log(...a);

const TOLERANCE = Number(process.env.VOLTRON_TOLERANCE ?? 0);
const REPEATS = Number(process.env.VOLTRON_REPEATS ?? 3);

async function main() {
  log("\nVoltron Phase 4, step 2: measure drift\n");

  if (RUNTIME_CONFIG.engine === "stub") {
    log("  The runtime is still the stub, so there is nothing to measure.");
    log("  Numbers produced against a stub say nothing about any model, and this");
    log("  script will not produce them. Set VOLTRON_ENGINE and VOLTRON_MODEL.\n");
    process.exit(1);
  }

  const model = read("model.json");
  const pinned = read("pinned.json");
  const state = read("genesis.json");
  const organState = read("organs.json");
  if (!model?.recordRef || !pinned || !state || !organState) {
    log("  Run `npm run adopt:model` first: the model must be a pinned organ before\n" +
        "  its behaviour can be compared to commitments that pin it.\n");
    process.exit(1);
  }

  const health = await checkOllama({ model: RUNTIME_CONFIG.model });
  if (!health.ok) {
    log("  " + health.reason + "\n");
    process.exit(1);
  }

  // The lineage is rebuilt purely to recover the memory log the
  // experiment's M factor draws on. Nothing here is anchored.
  const keys = deserialiseKeys(
    Object.fromEntries(
      Object.entries(state.keys).map(([role, k]) => [
        role,
        { ...k, privatePem: k.privatePem ?? (typeof k.privateKey === "string" ? k.privateKey : undefined) },
      ])
    )
  );
  const lineage = rebuildLineage(keys, state, organState);
  assertMatchesChain(lineage, state, organState);

  // ★ The entity must load before it is measured. Measuring a
  // composition whose artefacts no longer match its record would produce
  // numbers about something the record does not describe.
  const organs = Object.fromEntries(
    Object.entries(model.manifest).map(([role, a]) => [role, a.sha256])
  );
  const entity = await loadEntity({
    record: { organs, runtime: model.runtimeDigest },
    organPaths: ORGAN_PATHS,
    runtimeConfig: RUNTIME_CONFIG,
  });
  log("  ✓ organs verified against disk, runtime matches the pin");
  log("  model  :", RUNTIME_CONFIG.model, `(temp ${RUNTIME_CONFIG.temperature}, seed ${RUNTIME_CONFIG.seed})`);
  log("  probes :", PROBES.map((p) => p.id).join(", "));
  log("  answers:", vocabulary(PROBES).join(" | "));

  const infer = ollamaBrain(RUNTIME_CONFIG);

  // ---- 0. is the instrument valid at all? ----------------------------
  //
  // ★ THIS RUNS FIRST, AND CAN STOP EVERYTHING. A model that simply
  // picks the first option scores exactly like a model that holds views.
  // Producing a drift figure before ruling that out would be a confident
  // wrong number, which is the failure this project exists to prevent.
  //
  // Found the hard way: the first real run returned 75% drift, and all
  // three divergences were the same token, which happened to sort first.
  const orderings = vocabulary(PROBES).length;
  log(`\n  first, the position-bias control (${PROBES.length * orderings} inferences).`);
  log("  The first loads the model, so it is slow.");
  const control = await positionBiasControl(PROBES, infer, {
    systemPrompt: entity.systemPrompt,
    onProbe: ({ id, offset, ms }) => log(`   ${id.padEnd(16)} ordering ${offset}  ${(ms / 1000).toFixed(1)}s`),
  });

  log("\n  per probe, as the option order moved:");
  for (const [id, r] of Object.entries(control.byProbe)) {
    const given = r.answers.map((a) => a.answer ?? "(none)");
    const tag = r.alwaysFirst ? "TRACKS POSITION" : r.stable ? "stable" : "unstable";
    log(`   ${id.padEnd(16)} ${tag.padEnd(16)} ${given.join(" | ")}`);
  }

  log("\n  " + control.verdict);

  if (!control.measurementIsValid) {
    log("\n  ✗ REFUSING TO REPORT A DRIFT FIGURE.");
    log("    The probes are not measuring disposition, so any number computed from");
    log("    them would describe the option ordering rather than the model. This is");
    log("    the instrument being honest, not the model being broken.");
    log("\n    What would make the measurement valid:");
    log("     - a larger model, since position bias falls sharply with capability");
    log("     - answers scored by log-probability rather than by generated text");
    log("     - a probe format that is not multiple choice at all");
    log("\n    None of those are a tolerance to widen. The reading is invalid, and an");
    log("    invalid reading has no correct threshold.");
    log("\nPHASE4_CONTROL_FAILED\n");
    process.exit(2);
  }

  // ---- 1. straight measurement ---------------------------------------
  log("\n  the control passed, so the probes are measuring something. Running them…");
  const { responses, nonConforming, raw } = await runProbes(PROBES, infer, {
    systemPrompt: entity.systemPrompt,
    onProbe: ({ id, ms }) => log(`   ${id.padEnd(16)} ${(ms / 1000).toFixed(1)}s`),
  });

  if (nonConforming.length) {
    // ★ Reported separately from divergence, and loudly. A model that
    // ignored the format has not disagreed with the commitments; it has
    // failed to participate. Scoring that as drift measures the wrong
    // thing entirely.
    log(`\n  ⚠ ${nonConforming.length} reply did not use the required vocabulary:`);
    for (const n of nonConforming) log(`     ${n.id}: ${JSON.stringify(n.reply)}`);
    log("    These count as UNANSWERED below, never as divergence.");
  }

  const measurement = measureDrift({ probes: PROBES }, responses);
  log("\n  drift  :", measurement.diverged, "of", measurement.probes, `(${(measurement.drift * 100).toFixed(0)}%)`);
  log("  answered:", measurement.answered);
  for (const d of measurement.divergences) {
    if (d.kind === "diverged") {
      log(`   ✗ ${d.id.padEnd(16)} endorsed ${JSON.stringify(d.endorsed)}, now ${JSON.stringify(d.now)}`);
      log(`     because: ${d.because}`);
    } else {
      log(`   ? ${d.id.padEnd(16)} unanswered (raw: ${JSON.stringify((raw[d.id] ?? "").slice(0, 80))})`);
    }
  }

  recordDriftReport(lineage.memory, measurement, Math.floor(Date.now() / 1000), "Phase 4 first real measurement");
  log("\n  a drift report was appended to memory (an observation, not a correction)");

  // ---- 2. the factorial sweep ------------------------------------------
  log(`\n  the frozen-baseline sweep (tolerance ${TOLERANCE}, ${REPEATS} repeats per cell)…`);

  // The experiment's brain: (situation, context) -> answer token. M and R
  // reach the model through the context that `cellInput` assembled.
  const brain = async (situation, context) => {
    const probeFor = PROBES.find((p) => p.situation === situation) ?? PROBES[0];
    const preamble = [];
    if (context.autobiographical.length) {
      preamble.push("What you remember:", ...context.autobiographical.map((e) => `  ${JSON.stringify(e.content ?? e)}`), "");
    }
    if (context.precedent.length) {
      preamble.push("What you decided before:", ...context.precedent.map((d) => `  ${d.id}: ${d.answer}`), "");
    }
    const reply = await infer(entity.systemPrompt, preamble.join("\n") + probePrompt(probeFor, PROBES));
    return readAnswer(reply?.text ?? reply, PROBES);
  };

  const walked = lineage.memory.chainFrom(lineage.memory.head);
  const cells = 8 * REPEATS * PROBES.length;
  log(`   ${cells} inferences to run. At the pace above, roughly ${Math.ceil((cells * 4) / 60)} minutes.`);
  const result = await sweep({
    brain,
    commitments: { probes: PROBES },
    log: walked.ok ? walked.chain : [],
    situations: null,
    tolerance: TOLERANCE,
    repeats: REPEATS,
  });

  if (!result.ok) {
    log("\n  ✗ THE SWEEP REFUSED TO ATTRIBUTE ANYTHING:");
    log("    " + result.reason);
    log("\n  ★ This is the instrument working, not failing. Pin determinism further");
    log("    (seed, threads, batch size, context length, library version) or declare");
    log("    and PRE-REGISTER a tolerance. Do not widen one until the numbers look");
    log("    agreeable: that inverts the instrument.");
    log("\n    Cells observed:");
    for (const c of result.conditions) {
      const f = [c.factors.memory ? "M" : "-", c.factors.shift ? "D" : "-", c.factors.ratchet ? "R" : "-"].join("");
      log(`     ${f}  drift ${c.drift.toFixed(3)}  spread ${c.spread.toFixed(3)}  runs [${c.runs.map((r) => r.toFixed(2)).join(", ")}]`);
    }
    log("\nPHASE4_SWEEP_REFUSED\n");
    process.exit(2);
  }

  log("\n  baseline:", result.baseline.toFixed(3), `(spread ${result.baselineSpread.toFixed(3)})`);
  log("  isolated contributions:");
  log("   M memory accumulation      ", result.isolated.memory.toFixed(3));
  log("   D distributional shift     ", result.isolated.shift.toFixed(3));
  log("   R interpretation ratchet   ", result.isolated.ratchet.toFixed(3));
  log("   all three together         ", result.all.toFixed(3));

  const inter = interaction(result);
  log("\n  sum of parts:", inter.sumOfParts, "combined:", inter.combined);
  log("  " + inter.note);

  log("\n  ★ These numbers are about " + RUNTIME_CONFIG.model + " under this exact pinned");
  log("    configuration, and about nothing else. M and R are both context exposure");
  log("    manipulated differently, so interaction is expected rather than surprising.");

  const history = driftHistory(lineage.memory, lineage.memory.head);
  log(`\n  drift reports on the record: ${history.length}`);
  log(`\nPHASE4_DRIFT_OK:${measurement.drift.toFixed(3)}:${result.baseline.toFixed(3)}\n`);
}

main().catch((e) => {
  console.error("\nPHASE4_FAIL:", e.message ?? e);
  process.exit(1);
});
