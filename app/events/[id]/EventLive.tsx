"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState } from "react";
import { cancelEvent, placeBet, resolveEvent } from "@/app/actions";
import { LocalTime } from "@/components/LocalTime";
import { PoolBar } from "@/components/PoolBar";
import type { Side } from "@/lib/db";
import type { EventSnapshot } from "@/lib/events";
import { formatMultiplier, previewPayout, winningSide } from "@/lib/odds";

const POLL_MS = 3000;

export function EventLive({
  initial,
  me,
  canManage,
  isAdmin,
}: {
  initial: EventSnapshot;
  me: { id: number; balance: number };
  canManage: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [ev, setEv] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [side, setSide] = useState<Side>("over");
  const [amount, setAmount] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/events/${initial.id}`, { cache: "no-store" });
    if (res.ok) setEv(await res.json());
  }, [initial.id]);

  // Live odds: poll while the event is still open.
  useEffect(() => {
    if (ev.status !== "open") return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
      setNow(Date.now());
    }, POLL_MS);
    return () => clearInterval(t);
  }, [ev.status, refresh]);

  const afterAction = useCallback(() => {
    refresh();
    router.refresh(); // updates the balance in the header
  }, [refresh, router]);

  const [betState, betAction, betPending] = useActionState(placeBet, undefined);
  const [resolveState, resolveAction, resolvePending] = useActionState(resolveEvent, undefined);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelEvent, undefined);
  useEffect(() => {
    if (betState?.ok) setAmount("");
    if (betState || resolveState || cancelState) afterAction();
  }, [betState, resolveState, cancelState, afterAction]);

  const locked = new Date(ev.lock_at).getTime() <= now;
  const bettingOpen = ev.status === "open" && !locked;
  const amt = Number(amount);
  const validAmt = Number.isInteger(amt) && amt > 0;
  const payout = validAmt ? previewPayout(side, amt, ev.pools) : 0;
  const winner = ev.status === "resolved" && ev.result !== null ? winningSide(ev.line, ev.result) : null;

  const myBets = ev.bets.filter((b) => b.user_id === me.id);
  const myStake = myBets.reduce((s, b) => s + b.amount, 0);
  const total = ev.pools.over + ev.pools.under;
  const myIfWins = (s: Side) =>
    ev.pools[s] ? Math.floor((myBets.filter((b) => b.side === s).reduce((a, b) => a + b.amount, 0) * total) / ev.pools[s]) : 0;

  return (
    <div className="event-page">
      <Link href="/" className="back">
        ← All events
      </Link>
      <div className="event-hero card">
        <div className="event-card-head">
          <h1>{ev.title}</h1>
          <span className="line-chip big">O/U {ev.line}</span>
        </div>
        {ev.description && <p className="desc">{ev.description}</p>}
        <dl className="meta">
          <div>
            <dt>Created by</dt>
            <dd>{ev.creator}</dd>
          </div>
          <div>
            <dt>{locked || ev.status !== "open" ? "Betting closed" : "Betting closes"}</dt>
            <dd>
              <LocalTime iso={ev.lock_at} />
              {bettingOpen && (
                <span className="muted">
                  {" "}
                  (<LocalTime iso={ev.lock_at} mode="relative" />)
                </span>
              )}
            </dd>
          </div>
          {ev.resolution_source && (
            <div>
              <dt>Settled by</dt>
              <dd>{ev.resolution_source}</dd>
            </div>
          )}
        </dl>

        {ev.status === "resolved" && (
          <div className={`result-banner ${winner ?? "push"}`}>
            Result: <strong>{ev.result}</strong> —{" "}
            {winner ? `${winner.toUpperCase()} wins!` : "Push. Everyone was refunded."}
          </div>
        )}
        {ev.status === "cancelled" && <div className="result-banner push">Cancelled. All bets were refunded.</div>}
        {ev.status === "open" && locked && (
          <div className="result-banner push">Betting is closed. Waiting for {ev.creator} to enter the result.</div>
        )}

        <PoolBar pools={ev.pools} />
        {ev.status === "open" && (
          <p className="muted small">
            Odds update live. The winning side splits the whole {total.toLocaleString()}-point pot based on how much each
            person put in.
          </p>
        )}
      </div>

      {bettingOpen && (
        <form action={betAction} className="card stack bet-form">
          <h2>Place a bet</h2>
          <input type="hidden" name="event_id" value={ev.id} />
          <input type="hidden" name="side" value={side} />
          <div className="side-toggle">
            <button type="button" className={side === "over" ? "over active" : "over"} onClick={() => setSide("over")}>
              Over {ev.line}
            </button>
            <button type="button" className={side === "under" ? "under active" : "under"} onClick={() => setSide("under")}>
              Under {ev.line}
            </button>
          </div>
          <label>
            Points <span className="muted">(you have {me.balance.toLocaleString()})</span>
            <input
              name="amount"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              max={me.balance}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <div className="quick-amounts">
            {[50, 100, 250].map((n) => (
              <button key={n} type="button" onClick={() => setAmount(String(Math.min(n, me.balance)))}>
                {n}
              </button>
            ))}
            <button type="button" onClick={() => setAmount(String(me.balance))}>
              All in
            </button>
          </div>
          {validAmt && (
            <p className="preview">
              If {side.toUpperCase()} wins you&apos;d get <strong>{payout.toLocaleString()}</strong> pts back (
              {formatMultiplier(payout / amt)}) at current odds.
              {ev.pools[side === "over" ? "under" : "over"] === 0 && (
                <span className="muted"> Nobody&apos;s on the other side yet, so it pays 1.00x for now.</span>
              )}
            </p>
          )}
          <button type="submit" className={`primary ${side}-bg`} disabled={betPending || !validAmt}>
            {betPending ? "Placing…" : `Bet ${validAmt ? amt.toLocaleString() : ""} on ${side.toUpperCase()}`}
          </button>
          {betState?.error && <p className="msg error">{betState.error}</p>}
          {betState?.ok && <p className="msg ok">{betState.ok}</p>}
          <p className="muted small">Bets are final. Odds can still move until betting closes.</p>
        </form>
      )}

      {myBets.length > 0 && (
        <div className="card">
          <h2>Your position</h2>
          <p>
            {myStake.toLocaleString()} pts in.{" "}
            {ev.status === "open" ? (
              <>
                If OVER wins: <strong className="over-text">{myIfWins("over").toLocaleString()}</strong> · If UNDER wins:{" "}
                <strong className="under-text">{myIfWins("under").toLocaleString()}</strong>
              </>
            ) : (
              <>
                You got back <strong>{myBets.reduce((s, b) => s + (b.payout ?? 0), 0).toLocaleString()}</strong> pts.
              </>
            )}
          </p>
        </div>
      )}

      <div className="card">
        <h2>
          Bets <span className="count">{ev.bets.length}</span>
        </h2>
        {ev.bets.length === 0 ? (
          <p className="muted">No bets yet. Be the first.</p>
        ) : (
          <ul className="bet-list">
            {ev.bets.map((b) => (
              <li key={b.id}>
                <Link href={`/users/${b.user_id}`}>{b.nickname}</Link>
                {b.user_id === ev.creator_id && <span className="badge muted-badge tiny">creator</span>}
                <span className={`side-pill ${b.side}`}>{b.side.toUpperCase()}</span>
                <span className="amt">{b.amount.toLocaleString()}</span>
                {b.payout !== null && (
                  <span className={b.payout > b.amount ? "won" : b.payout === b.amount ? "muted" : "lost"}>
                    → {b.payout.toLocaleString()}
                  </span>
                )}
                <span className="muted small when">
                  <LocalTime iso={b.created_at} mode="relative" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManage && ev.status === "open" && (
        <div className="card stack manage">
          <h2>Settle this event</h2>
          {locked || isAdmin ? (
            <form action={resolveAction} className="row">
              <input type="hidden" name="event_id" value={ev.id} />
              <input name="result" type="number" step="any" inputMode="decimal" placeholder="Actual result" required />
              <button type="submit" className="primary" disabled={resolvePending}>
                Enter result &amp; pay out
              </button>
            </form>
          ) : (
            <p className="muted">You can enter the result once betting closes.</p>
          )}
          {resolveState?.error && <p className="msg error">{resolveState.error}</p>}
          <form
            action={cancelAction}
            onSubmit={(e) => {
              if (!window.confirm("Cancel this event and refund every bet?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="event_id" value={ev.id} />
            <button type="submit" className="danger" disabled={cancelPending}>
              Cancel event &amp; refund everyone
            </button>
          </form>
          {cancelState?.error && <p className="msg error">{cancelState.error}</p>}
        </div>
      )}
      {(resolveState?.ok || cancelState?.ok) && <p className="msg ok">{resolveState?.ok ?? cancelState?.ok}</p>}
    </div>
  );
}
