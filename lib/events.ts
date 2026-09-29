import { db, type EventStatus, type Side } from "./db";

export type EventSnapshot = {
  id: number;
  title: string;
  description: string;
  line: number;
  resolution_source: string;
  creator_id: number;
  creator: string;
  lock_at: string;
  status: EventStatus;
  result: number | null;
  resolved_at: string | null;
  pools: { over: number; under: number };
  bets: {
    id: number;
    user_id: number;
    nickname: string;
    side: Side;
    amount: number;
    payout: number | null;
    created_at: string;
  }[];
};

export async function getEventSnapshot(id: number): Promise<EventSnapshot | null> {
  if (!Number.isInteger(id)) return null;
  const sql = await db();
  const [event] = await sql`
    select e.*, u.nickname as creator
    from events e join users u on u.id = e.creator_id
    where e.id = ${id}`;
  if (!event) return null;
  const bets = await sql`
    select b.id, b.user_id, u.nickname, b.side, b.amount, b.payout, b.created_at
    from bets b join users u on u.id = b.user_id
    where b.event_id = ${id}
    order by b.created_at desc`;
  const pools = { over: 0, under: 0 };
  for (const b of bets) pools[b.side as Side] += b.amount;
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    line: event.line,
    resolution_source: event.resolution_source,
    creator_id: event.creator_id,
    creator: event.creator,
    lock_at: new Date(event.lock_at).toISOString(),
    status: event.status,
    result: event.result,
    resolved_at: event.resolved_at ? new Date(event.resolved_at).toISOString() : null,
    pools,
    bets: bets.map((b) => ({
      id: b.id,
      user_id: b.user_id,
      nickname: b.nickname,
      side: b.side,
      amount: b.amount,
      payout: b.payout,
      created_at: new Date(b.created_at).toISOString(),
    })),
  };
}

export type EventSummary = {
  id: number;
  title: string;
  line: number;
  creator: string;
  lock_at: string;
  status: EventStatus;
  result: number | null;
  over_pool: number;
  under_pool: number;
  bettors: number;
};

export async function listEvents(): Promise<EventSummary[]> {
  const sql = await db();
  const rows = await sql`
    select e.id, e.title, e.line, e.lock_at, e.status, e.result, u.nickname as creator,
      coalesce(sum(b.amount) filter (where b.side = 'over'), 0)::int as over_pool,
      coalesce(sum(b.amount) filter (where b.side = 'under'), 0)::int as under_pool,
      count(distinct b.user_id)::int as bettors
    from events e
    join users u on u.id = e.creator_id
    left join bets b on b.event_id = e.id
    group by e.id, u.nickname
    order by e.lock_at asc`;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    line: r.line,
    creator: r.creator,
    lock_at: new Date(r.lock_at).toISOString(),
    status: r.status,
    result: r.result,
    over_pool: r.over_pool,
    under_pool: r.under_pool,
    bettors: r.bettors,
  }));
}
