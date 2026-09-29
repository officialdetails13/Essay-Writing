import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function LeaderboardPage() {
  const me = await requireUser();
  const sql = await db();
  const rows = await sql`
    select u.id, u.nickname, u.balance,
      coalesce(sum(b.amount) filter (where e.status = 'open'), 0)::int as in_play,
      count(b.id) filter (where e.status = 'resolved' and b.payout > b.amount)::int as wins,
      count(b.id) filter (where e.status = 'resolved' and b.payout < b.amount)::int as losses
    from users u
    left join bets b on b.user_id = u.id
    left join events e on e.id = b.event_id
    group by u.id
    order by u.balance + coalesce(sum(b.amount) filter (where e.status = 'open'), 0) desc, u.nickname`;

  return (
    <>
      <h1>Leaderboard</h1>
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th className="num">Points</th>
              <th className="num">In play</th>
              <th className="num">W–L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={r.id === me.id ? "me-row" : undefined}>
                <td>{i === 0 ? "👑" : i + 1}</td>
                <td>
                  <Link href={`/users/${r.id}`}>{r.nickname}</Link>
                </td>
                <td className="num">
                  <strong>{r.balance.toLocaleString()}</strong>
                </td>
                <td className="num muted">{r.in_play ? r.in_play.toLocaleString() : "—"}</td>
                <td className="num">
                  {r.wins}–{r.losses}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Ranked by points plus points currently riding on open events.</p>
    </>
  );
}
