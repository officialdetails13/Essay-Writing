import postgres from "postgres";
import { BRAND } from "./brand";

// Tables are created automatically on first use, so there's no migration step.
const SCHEMA = [
  `create table if not exists users (
    id serial primary key,
    nickname text not null,
    passcode_hash text not null,
    is_admin boolean not null default false,
    can_create boolean not null default false,
    balance integer not null default ${BRAND.startingBalance} check (balance >= 0),
    failed_attempts integer not null default 0,
    locked_until timestamptz,
    created_at timestamptz not null default now()
  )`,
  `create unique index if not exists users_nickname_lower on users (lower(nickname))`,
  `create table if not exists sessions (
    token_hash text primary key,
    user_id integer not null references users(id) on delete cascade,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists settings (
    key text primary key,
    value text not null
  )`,
  `create table if not exists events (
    id serial primary key,
    title text not null,
    description text not null default '',
    line double precision not null,
    resolution_source text not null default '',
    creator_id integer not null references users(id),
    lock_at timestamptz not null,
    status text not null default 'open' check (status in ('open', 'resolved', 'cancelled')),
    result double precision,
    created_at timestamptz not null default now(),
    resolved_at timestamptz
  )`,
  `create table if not exists bets (
    id serial primary key,
    event_id integer not null references events(id) on delete cascade,
    user_id integer not null references users(id),
    side text not null check (side in ('over', 'under')),
    amount integer not null check (amount > 0),
    payout integer,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists bets_event_id on bets (event_id)`,
  `create index if not exists bets_user_id on bets (user_id)`,
];

type Globals = { __sql?: postgres.Sql; __schema?: Promise<void> };
const g = globalThis as Globals;

function client(): postgres.Sql {
  if (!g.__sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. See README.md.");
    // prepare: false keeps it compatible with pooled connections (Supabase, Neon).
    g.__sql = postgres(url, { max: 5, prepare: false, idle_timeout: 20 });
  }
  return g.__sql;
}

export async function db(): Promise<postgres.Sql> {
  const sql = client();
  if (!g.__schema) {
    g.__schema = sql
      .begin(async (tx) => {
        await tx.unsafe("select pg_advisory_xact_lock(7461023)");
        for (const statement of SCHEMA) await tx.unsafe(statement);
      })
      .then(() => undefined)
      .catch((err) => {
        g.__schema = undefined;
        throw err;
      });
  }
  await g.__schema;
  return sql;
}

export type User = {
  id: number;
  nickname: string;
  is_admin: boolean;
  can_create: boolean;
  balance: number;
};

export type Side = "over" | "under";
export type EventStatus = "open" | "resolved" | "cancelled";
