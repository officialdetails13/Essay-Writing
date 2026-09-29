import { formatMultiplier, multipliers, type Pools } from "@/lib/odds";

export function PoolBar({ pools, compact = false }: { pools: Pools; compact?: boolean }) {
  const total = pools.over + pools.under;
  const overPct = total ? (pools.over / total) * 100 : 50;
  const m = multipliers(pools);
  return (
    <div className={compact ? "pool compact" : "pool"}>
      <div className="pool-labels">
        <span className="over-text">
          OVER {formatMultiplier(m.over)} <small>({pools.over.toLocaleString()} pts)</small>
        </span>
        <span className="under-text">
          <small>({pools.under.toLocaleString()} pts)</small> {formatMultiplier(m.under)} UNDER
        </span>
      </div>
      <div className="pool-bar" aria-hidden>
        <div className="pool-over" style={{ width: `${overPct}%` }} />
        <div className="pool-under" style={{ width: `${100 - overPct}%` }} />
      </div>
    </div>
  );
}
