// The one place the entity's runtime configuration is written down.
//
// ★ IT LIVES IN ONE FILE BECAUSE IT IS PINNED. `measureRuntime` hashes
// these settings, the commitment set pins that hash, and S2 refuses any
// record whose runtime departs from it. Two copies of this object would
// mean two different entities that believe they are the same one, and
// the second symptom would be a load-time refusal nobody could explain.
//
// Changing anything here is a COMMITMENT AMENDMENT once the pin is live.
// That is deliberate: temperature, seed, context length and prompt
// template all move behaviour while every artefact hash holds, which is
// exactly the invisible movement the pin exists to catch.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The organ roles, mapped to the artefacts that fill them. */
export const ORGAN_PATHS = {
  brain: join(ROOT, "organs", "reasoner.prompt.md"),
  tools: join(ROOT, "organs", "tools.manifest.json"),
};

/**
 * The measured configuration (spec §9).
 *
 * `engine: "stub"` is the honest current state: no decoder is loaded, so
 * the brain organ is a prompt that nothing executes yet. Phase 4 changes
 * `engine` and `model` here, which will require an amendment, which is
 * the correct amount of friction for swapping the thing that thinks.
 */
export const RUNTIME_CONFIG = {
  engine: "stub",
  model: null,
  temperature: 0,
  topP: 1,
  topK: 0,
  seed: 1,
  contextLength: 8192,
  threads: 1,
  batchSize: 1,
  promptTemplate: "plain",
};
