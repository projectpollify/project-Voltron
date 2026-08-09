// The five questions (spec §11) — what a verifier must be able to answer
// about any instance, mechanically, from the records alone.

import { verifyRecord, verifyLineage, isRoot } from "./verifier.js";

/** Q1: What is this descended from? */
export function ancestry(ctx, digest) {
  const path = [];
  let cursor = digest;
  const seen = new Set();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const record = ctx.compositions.get(cursor);
    if (!record) break;
    path.push({ digest: cursor, change: record.change, at: record.at, reason: record.reason });
    cursor = isRoot(record) ? null : record.predecessor;
  }
  return path.reverse();
}

/** Q2/Q3: Which identity-bearing state persisted, and what changed? */
export function changeLog(ctx, digest) {
  const path = ancestry(ctx, digest);
  return path.map((step, i) => {
    const record = ctx.compositions.get(step.digest);
    const prev = i > 0 ? ctx.compositions.get(path[i - 1].digest) : null;
    return {
      at: record.at,
      change: record.change,
      reason: record.reason,
      commitments: prev
        ? record.commitments === prev.commitments
          ? "persisted"
          : "AMENDED"
        : "declared",
      memory: prev
        ? record.memoryHead === prev.memoryHead
          ? "unchanged"
          : "extended"
        : "declared",
      organs: prev ? diffOrgans(prev.organs, record.organs) : Object.keys(record.organs).map((r) => `${r}: declared`),
    };
  });
}

function diffOrgans(before, after) {
  const roles = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out = [];
  for (const role of roles) {
    if (before[role] === after[role]) continue;
    if (!before[role]) out.push(`${role}: added`);
    else if (!after[role]) out.push(`${role}: removed`);
    else out.push(`${role}: replaced`);
  }
  return out.length ? out : ["unchanged"];
}

/** Q4: Who authorised each step, and were they entitled? */
export function authorisation(ctx, digest) {
  return ancestry(ctx, digest).map((step) => {
    const result = verifyRecord(ctx, step.digest);
    const v3 = result.checks.find((c) => c.rule === "V3");
    return {
      at: step.at,
      change: step.change,
      entitled: Boolean(v3?.ok),
      detail: v3?.ok ? v3.note : v3?.reason ?? "not evaluated",
    };
  });
}

/**
 * Q5: Are these two instances siblings, or the same continuation?
 * Answers one of: same, continuation, siblings, unrelated.
 */
export function relationship(ctx, digestA, digestB) {
  if (digestA === digestB) return { relation: "same", detail: "identical record" };

  const pathA = ancestry(ctx, digestA).map((s) => s.digest);
  const pathB = ancestry(ctx, digestB).map((s) => s.digest);

  if (pathA.includes(digestB)) {
    return { relation: "continuation", detail: `${digestA.slice(0, 12)} descends from ${digestB.slice(0, 12)}` };
  }
  if (pathB.includes(digestA)) {
    return { relation: "continuation", detail: `${digestB.slice(0, 12)} descends from ${digestA.slice(0, 12)}` };
  }

  let sharedPrefix = null;
  for (let i = 0; i < Math.min(pathA.length, pathB.length); i++) {
    if (pathA[i] === pathB[i]) sharedPrefix = pathA[i];
    else break;
  }

  if (sharedPrefix) {
    return {
      relation: "siblings",
      forkPoint: sharedPrefix,
      detail:
        "neither is the continuation of the other — they share history up to the fork point and diverge after it",
    };
  }
  return { relation: "unrelated", detail: "no shared ancestor" };
}

/** All five, for one instance. */
export function describe(ctx, digest) {
  const verification = verifyLineage(ctx, digest);
  return {
    verified: verification.ok,
    descendedFrom: ancestry(ctx, digest),
    changes: changeLog(ctx, digest),
    authorisation: authorisation(ctx, digest),
    failures: verification.records.filter((r) => !r.ok),
  };
}
