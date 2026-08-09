// The autobiographical log — the continuity substrate (spec §6).
//
// §6.1's distinction is the whole design: the IMMUTABLE SUBSTRATE is an
// append-only event and correction log; the NARRATIVE is a derived view
// over it. Saying "the narrative is append-only" would be false — a
// narrative is curated and re-derived. What cannot be quietly rewritten
// is the log it is derived from.
//
// Every entry commits to its predecessor, so mutating any past entry
// changes its digest, orphans everything after it, and breaks the walk in
// verifyExtension(). That structural property IS V5.

import { hash } from "./canonical.js";

export class MemoryLog {
  #entries = new Map(); // digest -> entry
  #head = null;

  get head() {
    return this.#head;
  }

  /** Append an event. Returns the new head digest. */
  append(content, at) {
    return this.#push({ kind: "event", prev: this.#head, content, at });
  }

  /**
   * Correct an earlier entry. The original is NEVER removed — the
   * correction appends beside it and the derived view prefers the
   * correction. This is AgoraNet's ratified correction discipline: the
   * original remains visible beside the later update.
   */
  correct(targetDigest, content, at, reason = "") {
    if (!this.#entries.has(targetDigest)) {
      throw new Error("cannot correct an entry that is not in the log");
    }
    return this.#push({
      kind: "correction",
      prev: this.#head,
      corrects: targetDigest,
      content,
      reason,
      at,
    });
  }

  #push(entry) {
    const digest = hash(entry);
    this.#entries.set(digest, entry);
    this.#head = digest;
    return digest;
  }

  entry(digest) {
    return this.#entries.get(digest) ?? null;
  }

  /** Walk back from a head to genesis, newest first. */
  chainFrom(headDigest) {
    const out = [];
    let cursor = headDigest;
    while (cursor) {
      const entry = this.#entries.get(cursor);
      if (!entry) return { ok: false, reason: `missing log entry ${cursor.slice(0, 12)}`, chain: out };
      out.push({ digest: cursor, ...entry });
      cursor = entry.prev;
    }
    return { ok: true, chain: out };
  }

  /**
   * V5's core question: does `head` extend `ancestorHead` by APPENDING
   * only, with no prior entry deleted or mutated?
   *
   * Walking back from `head` must reach `ancestorHead`. A mutated or
   * removed entry breaks the walk, because each entry's digest covers its
   * predecessor.
   */
  verifyExtension(head, ancestorHead) {
    if (ancestorHead === null) {
      // Nothing to extend from: any well-formed chain qualifies.
      const walked = this.chainFrom(head);
      return walked.ok
        ? { ok: true, appended: walked.chain.length }
        : { ok: false, reason: walked.reason };
    }
    if (head === ancestorHead) return { ok: true, appended: 0 };

    const walked = this.chainFrom(head);
    if (!walked.ok) return { ok: false, reason: walked.reason };

    const index = walked.chain.findIndex((e) => e.digest === ancestorHead);
    if (index === -1) {
      return {
        ok: false,
        reason: "head does not descend from the predecessor's head — this is a rewrite, not an extension",
      };
    }
    return { ok: true, appended: index };
  }

  /**
   * The DERIVED VIEW (§6.1). Corrections supersede what they correct;
   * the superseded entries remain in the substrate and are reported, so
   * a revision is historically visible rather than erased.
   */
  narrative(head = this.#head) {
    const walked = this.chainFrom(head);
    if (!walked.ok) throw new Error(walked.reason);
    const ordered = [...walked.chain].reverse();
    const corrected = new Map();
    for (const e of ordered) if (e.kind === "correction") corrected.set(e.corrects, e);

    return ordered
      .filter((e) => e.kind === "event")
      .map((e) => {
        const fix = corrected.get(e.digest);
        return fix
          ? { at: e.at, content: fix.content, supersedes: e.content, correctedBecause: fix.reason }
          : { at: e.at, content: e.content };
      });
  }
}
