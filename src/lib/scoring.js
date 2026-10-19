// Voting & mutual-priority math. Pure functions so they can be unit-tested.
import { MUTUAL_THRESHOLD } from './constants.js';

/**
 * Summarise votes for one item.
 * @param {Array<{user_id:string, stars:number}>} votes  votes for this item
 * @param {string} meId
 * @param {string|null} partnerId
 */
export function voteSummary(votes, meId, partnerId) {
  const mine = votes.find((v) => v.user_id === meId)?.stars ?? null;
  const theirs = partnerId ? votes.find((v) => v.user_id === partnerId)?.stars ?? null : null;
  const cast = [mine, theirs].filter((x) => x !== null);
  const avg = cast.length ? cast.reduce((a, b) => a + b, 0) / cast.length : null;
  const mutual = mine !== null && theirs !== null && mine >= MUTUAL_THRESHOLD && theirs >= MUTUAL_THRESHOLD;
  return { mine, theirs, avg, mutual, score: mutualScore(mine, theirs) };
}

/**
 * Combined "mutual priority" score, 0–100.
 * Rewards agreement: the lower vote counts more than the higher one, so a 5+5
 * beats a 5+3 even though both average high. Missing votes count as neutral (2.5)
 * with a small penalty so fully-voted items rank above half-voted ones.
 */
export function mutualScore(a, b) {
  if (a === null && b === null) return 0;
  const x = a ?? 2.5, y = b ?? 2.5;
  const lo = Math.min(x, y), hi = Math.max(x, y);
  const raw = (lo * 0.65 + hi * 0.35) / 5; // 0.2 .. 1
  const penalty = a === null || b === null ? 0.15 : 0;
  return Math.round(Math.max(0, raw - penalty) * 100);
}
