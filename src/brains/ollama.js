// A real decoder, behind the same one-function interface as the stub.
//
// ★ THE CLAIM PHASE 3 MADE, TESTED HERE. `act(entity, request, { infer })`
// takes any function from (systemPrompt, input) to a reply. Phase 3 said
// the composition machinery does not care what the brain is. This file
// is the smallest possible test of that: a real model plugs in and no
// signature above it changes.
//
// ★ DETERMINISM IS REQUESTED, NEVER ASSUMED. Everything that can be
// pinned is pinned, and the sweep's null check still runs afterwards to
// find out whether the pinning worked. Requesting a seed is not the same
// as receiving determinism: quantised kernels, thread counts, batch
// splits and library versions can all move a token, and Ollama gives no
// guarantee across versions. The apparatus is built to catch that rather
// than to trust this.
//
// ★ WHAT THIS DOES NOT ESTABLISH. Loading a model here does not prove to
// anyone else that this process loaded THAT model. §9's binding problem
// is unchanged; `loadEntity`'s binding object still says so.

const DEFAULT_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

/**
 * Is Ollama actually running, and does it have this model?
 *
 * ★ Asked before any probe runs. A connection error midway through a
 * sweep would leave a partial result that looks like non-conformance,
 * and "the server was not running" must never be reported as "the model
 * refused to answer".
 */
export async function checkOllama({ model, host = DEFAULT_HOST } = {}) {
  let res;
  try {
    res = await fetch(`${host}/api/tags`, { cache: "no-store" });
  } catch (e) {
    return {
      ok: false,
      reason: `Ollama is not reachable at ${host} (${e.message}). Start it with \`ollama serve\`, or install it first.`,
    };
  }
  if (!res.ok) return { ok: false, reason: `Ollama responded ${res.status} at ${host}.` };

  const { models = [] } = await res.json();
  const names = models.map((m) => m.name);
  if (model && !names.includes(model) && !names.some((n) => n.split(":")[0] === model.split(":")[0])) {
    return {
      ok: false,
      reason: `Ollama is running but has no model matching "${model}". Pull it with \`ollama pull ${model}\`. Present: ${names.join(", ") || "none"}.`,
    };
  }
  return { ok: true, models: names };
}

/**
 * Build an `infer` function pinned to the measured configuration.
 *
 * The options passed to Ollama are exactly the fields the runtime pin
 * hashes, which is the point: if the pin and the call could disagree,
 * the pin would be describing a configuration nobody ran.
 */
export function ollamaBrain(runtimeConfig, { host = DEFAULT_HOST } = {}) {
  const { model, temperature, topP, topK, seed, contextLength, threads } = runtimeConfig;
  if (!model) throw new Error("ollamaBrain needs a model in the runtime config.");

  return async function infer(systemPrompt, input) {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        system: systemPrompt ?? undefined,
        prompt: input,
        stream: false,
        options: {
          temperature,
          top_p: topP,
          top_k: topK,
          seed,
          num_ctx: contextLength,
          num_thread: threads,
        },
      }),
    });

    if (!res.ok) {
      // Thrown, not returned as text. A failed request that came back as
      // a string would enter the probe reader and be scored as a
      // non-conforming answer, blaming the model for the network.
      throw new Error(`Ollama /api/generate failed (${res.status}): ${await res.text()}`);
    }

    const body = await res.json();
    return { text: body.response ?? "", evalCount: body.eval_count ?? null };
  };
}
