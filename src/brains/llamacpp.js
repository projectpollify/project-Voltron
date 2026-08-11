// A decoder that CHOOSES rather than types.
//
// ★ WHY THIS EXISTS. The Ollama path asks the model to write one token
// from a list shown in the prompt. A real run proved that unsafe: two of
// four probes changed answer when the list moved, so the recorded answer
// was partly a fact about the ordering. The position-bias control caught
// it and refused to report a number, which was correct and left the
// measurement stuck.
//
// ★ THE FIX IS A REMOVAL, NOT ANOTHER CONTROL. Here the options are
// never shown. The situation is presented alone, and a GBNF grammar
// constrains the output to exactly one of the permitted answers. The
// model cannot ramble, cannot invent a token, and cannot read a list
// because there is no list. **Position bias is not measured and found
// absent; it is structurally impossible.**
//
// That is a stronger instrument than a larger model would have given.
//
// ★ WHAT IT STILL CANNOT DO. Constraining the output does not make the
// answer sincere, and it does not close §9: nothing here proves to a
// third party that this process ran the weights it claims. The grammar
// removes one confound. It removes no others.
//
// Requires llama.cpp's server:
//   llama-server -m <model.gguf> --port 8080

const DEFAULT_HOST = process.env.LLAMACPP_HOST ?? "http://127.0.0.1:8080";

/**
 * A GBNF grammar admitting exactly the permitted answers and nothing
 * else. Sorted for determinism: the same option set must always produce
 * the same grammar bytes, or the runtime pin would move for no reason.
 *
 * Order inside the grammar is not a prompt ordering. The model never
 * reads it; the sampler uses it to mask tokens. There is no "first
 * option" to prefer.
 */
export function optionGrammar(options) {
  const escaped = [...options].sort().map((o) => JSON.stringify(o));
  return `root ::= ${escaped.join(" | ")}`;
}

export async function checkLlamaCpp({ host = DEFAULT_HOST } = {}) {
  let res;
  try {
    res = await fetch(`${host}/health`, { cache: "no-store" });
  } catch (e) {
    return {
      ok: false,
      reason:
        `llama.cpp's server is not reachable at ${host} (${e.message}).\n` +
        "  Start it with:  llama-server -m <path-to.gguf> --port 8080",
    };
  }
  if (!res.ok) return { ok: false, reason: `llama.cpp server responded ${res.status} at ${host}.` };

  // ★ Confirm grammar support before a run rather than after. A server
  // that silently ignored the grammar would return free text, which the
  // reader would score as non-conformance and blame on the model.
  const probe = await fetch(`${host}/completion`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "x", n_predict: 1, temperature: 0, grammar: 'root ::= "yes"' }),
  });
  if (!probe.ok) return { ok: false, reason: `llama.cpp server rejected a grammar request (${probe.status}).` };
  const body = await probe.json();
  if ((body.content ?? "").trim() !== "yes") {
    return {
      ok: false,
      reason:
        "llama.cpp's server did not honour a grammar (asked for \"yes\", got " +
        JSON.stringify((body.content ?? "").slice(0, 40)) +
        "). Without grammar support this path cannot constrain the answer, and an unconstrained answer is the problem it exists to remove.",
    };
  }
  return { ok: true };
}

/**
 * Build a `chooser`: (systemPrompt, situation, options) -> one option.
 *
 * ★ NOT the same signature as `infer`. That is deliberate. An `infer`
 * returns whatever the model typed; this returns a CHOICE from a set the
 * caller supplies and the model never sees. Giving them the same name
 * would invite someone to swap one for the other and quietly reintroduce
 * the confound.
 */
export function llamaCppChooser(runtimeConfig, { host = DEFAULT_HOST, timeoutMs = 120_000 } = {}) {
  const { temperature, topP, topK, seed, threads } = runtimeConfig;

  return async function choose(systemPrompt, situation, options) {
    const grammar = optionGrammar(options);
    const prompt = [
      systemPrompt ? systemPrompt.trim() + "\n\n" : "",
      "Situation:\n",
      situation,
      "\n\nYour answer:",
    ].join("");

    const res = await fetch(`${host}/completion`, {
      signal: AbortSignal.timeout(timeoutMs),
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt,
        grammar,
        temperature,
        top_p: topP,
        top_k: topK,
        seed,
        n_threads: threads,
        n_predict: 32, // enough for the longest permitted answer
        cache_prompt: false, // a shared cache would make a cell depend on what ran before it
        n_probs: options.length,
      }),
    });

    if (!res.ok) {
      throw new Error(`llama.cpp /completion failed (${res.status}): ${await res.text()}`);
    }

    const body = await res.json();
    const chosen = (body.content ?? "").trim();

    // The grammar should make this impossible. It is checked anyway,
    // because "should be impossible" is how silent wrongness gets in.
    if (!options.includes(chosen)) {
      return { answer: null, raw: chosen, reason: "the grammar did not constrain the output as expected" };
    }
    return { answer: chosen, raw: chosen };
  };
}
