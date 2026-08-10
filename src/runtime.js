// Phase 3: a running entity.
//
// Phases 1 and 2 made records real. This makes the COMPOSITION real:
// something loads the pinned organs, refuses to start if they are not
// the pinned ones, and acts only within the tool surface it declared.
//
// ★ THE HONEST LIMIT, STATED HERE IN RUNNING CODE RATHER THAN IN A
// FOOTNOTE (spec §9). Hashing proves the file. It does not prove the
// process loaded it, and it does not prove the process kept using it
// after the check. `loadEntity` verifies at the load path and returns a
// `binding` object saying exactly that. Closing the gap needs hardware
// attestation (a TEE) or a proof of execution; neither exists here, and
// pretending otherwise would be the one failure this project cannot
// afford.
//
// So: the runtime is trusted, and the trust is YOURS, given knowingly,
// on your own machine. That is why the spec is local-first. It is not a
// preference, it is the only configuration in which the claim holds.

import { readFile } from "node:fs/promises";
import { hash } from "./canonical.js";
import { verifyOrgans } from "./artefacts.js";

/**
 * ★ THE MEASURED CONFIGURATION (§9), computed rather than asserted.
 *
 * Every field here can move the output while every artefact hash holds.
 * That is precisely the invisible movement the runtime pin exists to
 * catch, so the pin must be derived from the settings the process
 * ACTUALLY uses, never from a description someone typed.
 *
 * Phase 4 adds nothing conceptually: `model`, `seed` and `temperature`
 * are already here, waiting for a decoder to make them matter.
 */
export function measureRuntime({
  engine,
  model = null,
  temperature = 0,
  topP = 1,
  topK = 0,
  seed = 1,
  contextLength = 8192,
  threads = 1,
  batchSize = 1,
  promptTemplate = "plain",
}) {
  const measured = {
    engine,
    model,
    temperature,
    topP,
    topK,
    seed,
    contextLength,
    threads,
    batchSize,
    promptTemplate,
  };
  return { measured, digest: hash(measured) };
}

/**
 * The tool surface, read from the pinned manifest organ.
 *
 * ★ THE ABSENCES ARE THE INTERESTING PART. `absent_by_design` names
 * capabilities the entity must NOT have and says why. Reading them into
 * the runtime turns a JSON comment into a refusal with a reason, which
 * is the difference between documenting a boundary and having one.
 */
export function toolSurface(manifest) {
  const allowed = new Map((manifest.tools ?? []).map((t) => [t.name, t]));
  const refused = new Map((manifest.absent_by_design ?? []).map((t) => [t.name, t.why]));
  return { allowed, refused };
}

/**
 * Load a composition and refuse to run it if the world does not match
 * the record.
 *
 * Three refusals, each for a different reason:
 *  1. an organ on disk does not hash to the pinned digest;
 *  2. an organ could not be read at all (unchecked, not "unchanged");
 *  3. the measured runtime does not match the pinned runtime.
 *
 * A runtime that started anyway and logged a warning would be worse
 * than no check, because it would produce output that LOOKS like it came
 * from the pinned composition.
 */
export async function loadEntity({ record, organPaths, runtimeConfig, memory = null }) {
  const organCheck = await verifyOrgans(record.organs, organPaths);
  if (!organCheck.ok) {
    const changed = organCheck.changed.length
      ? `organs that no longer match the record: ${organCheck.changed.join(", ")}`
      : "";
    const unchecked = organCheck.unchecked.length
      ? `organs that could not be read, so were NOT checked: ${organCheck.unchecked.join(", ")}`
      : "";
    throw new Error(
      "Refusing to start this composition. " +
        [changed, unchecked].filter(Boolean).join("; ") +
        ". Running anyway would produce output that looks like it came from the pinned composition."
    );
  }

  const runtime = measureRuntime(runtimeConfig);
  if (runtime.digest !== record.runtime) {
    throw new Error(
      "Refusing to start: the measured runtime does not match the pinned runtime.\n" +
        `  pinned  : ${record.runtime}\n` +
        `  measured: ${runtime.digest}\n` +
        "  A prompt, seed, temperature or context change moves behaviour while every\n" +
        "  artefact hash holds. That is exactly what this pin exists to catch."
    );
  }

  // The organs, now actually loaded rather than merely hashed.
  const brainPath = organPaths.brain;
  const toolsPath = organPaths.tools;
  const systemPrompt = brainPath ? await readFile(brainPath, "utf8") : null;
  const manifest = toolsPath ? JSON.parse(await readFile(toolsPath, "utf8")) : { tools: [] };
  const surface = toolSurface(manifest);

  return {
    record,
    systemPrompt,
    surface,
    runtime,

    // ★ What was and was not established, carried by the object itself
    // so no caller can report more than was checked.
    binding: {
      organsVerifiedAtLoad: true,
      runtimeMatchesPin: true,
      // The gap. Named, so it cannot be quietly forgotten.
      processProvenToHaveLoadedThem: false,
      note:
        "The bytes on disk match the record, and this process read those bytes. " +
        "Nothing here proves to a third party that this process ran them, or kept " +
        "running them. That needs a TEE or a proof of execution (spec §9).",
    },

    /**
     * Call a tool, or refuse with the manifest's own reason.
     *
     * ★ A refusal cites the manifest rather than inventing a policy.
     * The boundary lives in a pinned artefact, so changing it changes a
     * hash, which is the whole point of pinning the tool surface.
     */
    async call(toolName, args, at) {
      if (surface.refused.has(toolName)) {
        return {
          ok: false,
          refused: true,
          tool: toolName,
          reason: surface.refused.get(toolName),
        };
      }
      if (!surface.allowed.has(toolName)) {
        return {
          ok: false,
          refused: true,
          tool: toolName,
          reason: `"${toolName}" is not in the pinned tool manifest. Gaining a capability is a change to a pinned organ, not a runtime decision.`,
        };
      }

      const tool = surface.allowed.get(toolName);
      if (memory && tool.effect !== "read-only") {
        memory.append({ event: "tool-call", tool: toolName, args }, at);
      }
      return { ok: true, tool: toolName, effect: tool.effect, args };
    },
  };
}

/**
 * The orchestrator: route a request through the composition.
 *
 * ★ `infer` IS INJECTED, and that is a design decision rather than a
 * convenience. The brain organ at this phase is a prompt file, and a
 * prompt is not an executable. Phase 4 supplies a real decoder and this
 * signature does not change, which is the claim Phase 3 is making: the
 * composition machinery does not care what the brain is.
 *
 * The default `infer` is deliberately useless. It composes the pinned
 * prompt with the input and returns a structured echo, so the routing
 * can be tested without pretending a model was involved. Any output it
 * produces means only that the plumbing works.
 */
export async function act(entity, request, { infer = null, at = 0 } = {}) {
  const run =
    infer ??
    ((systemPrompt, input) => ({
      engine: "stub",
      saw: input,
      promptBytes: systemPrompt?.length ?? 0,
      note: "No model ran. This output is evidence of routing and of nothing else.",
    }));

  const answer = await run(entity.systemPrompt, request);

  return {
    answer,
    // Every result carries what produced it, so a reader never has to
    // guess whether a model was involved.
    provenance: {
      organs: entity.record.organs,
      runtime: entity.runtime.digest,
      engine: entity.runtime.measured.engine,
      model: entity.runtime.measured.model,
      binding: entity.binding,
    },
  };
}
