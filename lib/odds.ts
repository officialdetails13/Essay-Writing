import type { Side } from "./db";

// Shared-pot (pari-mutuel) odds: everyone's points go into one pot per side,
// and the winning side splits the entire pot in proportion to their stakes.

export type Pools = { over: number; under: number };

/** Payout per 1 point staked on each side, or null if nobody is on that side yet. */
export function multipliers(pools: Pools): { over: number | null; under: number | null } {
  const total = pools.over + pools.under;
  return {
    over: pools.over > 0 ? total / pools.over : null,
    under: pools.under > 0 ? total / pools.under : null,
  };
}

/** What a bet would pay if it won, given it's added to the current pools. */
export function previewPayout(side: Side, amount: number, pools: Pools): number {
  if (!(amount > 0)) return 0;
  const next = { ...pools, [side]: pools[side] + amount };
  return Math.floor((amount * (next.over + next.under)) / next[side]);
}

export function winningSide(line: number, result: number): Side | null {
  if (result > line) return "over";
  if (result < line) return "under";
  return null; // exactly on the line: push, everyone is refunded
}

export function formatMultiplier(m: number | null): string {
  return m === null ? "—" : `${m.toFixed(2)}x`;
}
