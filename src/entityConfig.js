// The one place the entity's runtime configuration is written down.
//
// ★ IT LIVES IN ONE FILE BECAUSE IT IS PINNED. `measureRuntime` hashes
// these settings, the commitment set pins that hash, and S2 refuses any
// record whose runtime departs from it. Two copies of this object would
// mean two different entities that believe they are the same one, and
// the second symptom would be a load-time refusal nobody could explain.
//
// ★ THE ENVIRONMENT MAY OVERRIDE, AND THE PIN IS WHY THAT IS SAFE.
// Reading settings from the environment is normally the exact "invisible
// edit" this project worries about: a variable changes, behaviour moves,
// and every artefact hash holds. Here it cannot hide. Any override
// changes the measured digest, `loadEntity` refuses to start, and the
// only way forward is a quorum-authorised amendment. The convenience is
// real and the guard is real, which is the correct shape.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The organ roles, mapped to the artefacts that fill them.
 *
 * ★ `model` is present only when a path is given. A 5.68 GB `.gguf`
 * does not live in a git repository, so its location is the one thing
 * that must come from outside. Its HASH is pinned exactly like every
 * other organ; only where the file sits is local.
 */
export const ORGAN_PATHS = {
  brain: join(ROOT, "organs", "reasoner.prompt.md"),
  tools: join(ROOT, "organs", "tools.manifest.json"),
  ...(process.env.VOLTRON_MODEL_PATH ? { model: process.env.VOLTRON_MODEL_PATH } : {}),
};

const num = (v, fallback) => (v === undefined ? fallback : Number(v));

/**
 * The measured configuration (spec §9).
 *
 * The defaults are the honest Phase 3 state: `engine: "stub"`, no model,
 * so the brain organ is a prompt that nothing executes. Setting
 * `VOLTRON_ENGINE=ollama` and `VOLTRON_MODEL=...` is Phase 4, and the
 * runtime pin will immediately refuse until an amendment records it.
 * That friction is correct: swapping the thing that thinks should cost a
 * quorum, not an export line.
 */
export const RUNTIME_CONFIG = {
  engine: process.env.VOLTRON_ENGINE ?? "stub",
  model: process.env.VOLTRON_MODEL ?? null,
  temperature: num(process.env.VOLTRON_TEMPERATURE, 0),
  topP: num(process.env.VOLTRON_TOP_P, 1),
  topK: num(process.env.VOLTRON_TOP_K, 0),
  seed: num(process.env.VOLTRON_SEED, 1),
  contextLength: num(process.env.VOLTRON_CONTEXT, 8192),
  threads: num(process.env.VOLTRON_THREADS, 1),
  batchSize: num(process.env.VOLTRON_BATCH, 1),
  promptTemplate: process.env.VOLTRON_TEMPLATE ?? "plain",
};
