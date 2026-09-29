import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sql = await db();
  const [user] = await sql`select id, nickname, balance, is_admin, created_at from users where id = ${id}`;
  if (!user) notFound();
  const bets = await sql`
    select b.id, b.side, b.amount, b.payout, b.created_at, e.id as event_id, e.title, e.line, e.status
    from bets b join events e on e.id = b.event_id
    where b.user_id = ${id}
    order by b.created_at desc
    limit 100`;
  const settled = bets.filter((b) => b.status !== "open");
  const net = settled.reduce((s, b) => s + (b.payout ?? 0) - b.amount, 0);

  return (
    <>
      <div className="page-head">
        <h1>
          {user.nickname} {user.is_admin && <span className="badge muted-badge">admin</span>}
        </h1>
      </div>
      <div className="stats">
        <div className="card stat">
          <span className="muted">Points</span>
          <strong>{user.balance.toLocaleString()}</strong>
        </div>
        <div className="card stat">
          <span className="muted">Net from settled bets</span>
          <strong className={net > 0 ? "won" : net < 0 ? "lost" : undefined}>
            {net > 0 ? "+" : ""}
            {net.toLocaleString()}
          </strong>
        </div>
        <div className="card stat">
          <span className="muted">Bets placed</span>
          <strong>{bets.length}</strong>
        </div>
      </div>
      <div className="card">
        <h2>Bet history</h2>
        {bets.length === 0 ? (
          <p className="muted">No bets yet.</p>
        ) : (
          <ul className="bet-list">
            {bets.map((b) => (
              <li key={b.id}>
                <Link href={`/events/${b.event_id}`} className="grow">
                  {b.title}
                </Link>
                <span className={`side-pill ${b.side}`}>
                  {b.side.toUpperCase()} {b.line}
                </span>
                <span className="amt">{b.amount.toLocaleString()}</span>
                {b.payout !== null ? (
                  <span className={b.payout > b.amount ? "won" : b.payout === b.amount ? "muted" : "lost"}>
                    → {b.payout.toLocaleString()}
                  </span>
                ) : (
                  <span className="muted small">pending</span>
                )}
                <span className="muted small when">
                  <LocalTime iso={new Date(b.created_at).toISOString()} mode="relative" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
