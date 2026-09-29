"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, requireAdmin, requireUser, startSession } from "@/lib/auth";
import { db, type Side } from "@/lib/db";
import { winningSide } from "@/lib/odds";

export type FormState = { error?: string; ok?: string } | undefined;

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 10;

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function validNickname(n: string) {
  return /^[A-Za-z0-9_.\- ]{2,20}$/.test(n);
}

function validPasscode(p: string) {
  return p.length >= 4 && p.length <= 32;
}

// ---------- Accounts ----------

export async function signup(_prev: FormState, fd: FormData): Promise<FormState> {
  const nickname = str(fd, "nickname");
  const passcode = str(fd, "passcode");
  const invite = str(fd, "invite");
  if (!validNickname(nickname)) return { error: "Nickname must be 2–20 letters, numbers, spaces, _ . or -" };
  if (!validPasscode(passcode)) return { error: "Passcode must be at least 4 characters." };

  const hash = await bcrypt.hash(passcode, 10);
  const sql = await db();
  const outcome = await sql.begin(async (tx) => {
    // Serialize signups so "first user becomes admin" can't race.
    await tx.unsafe("select pg_advisory_xact_lock(7461024)");
    const [{ count }] = await tx.unsafe<{ count: number }[]>("select count(*)::int as count from users");
    const isFirst = count === 0;
    if (!isFirst) {
      const [setting] = await tx.unsafe<{ value: string }[]>(
        "select value from settings where key = 'invite_code'",
      );
      if (!setting) return { error: "Signups are closed. Ask the admin for an invite code." };
      if (setting.value.toLowerCase() !== invite.toLowerCase()) return { error: "That invite code isn't right." };
    }
    const taken = await tx.unsafe("select 1 from users where lower(nickname) = lower($1)", [nickname]);
    if (taken.length) return { error: "That nickname is taken." };
    const [user] = await tx.unsafe<{ id: number }[]>(
      "insert into users (nickname, passcode_hash, is_admin, can_create) values ($1, $2, $3, $3) returning id",
      [nickname, hash, isFirst],
    );
    return { id: user.id };
  });

  if ("error" in outcome) return { error: outcome.error };
  await startSession(outcome.id);
  redirect("/");
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const nickname = str(fd, "nickname");
  const passcode = str(fd, "passcode");
  const sql = await db();
  const [user] = await sql`
    select id, passcode_hash, failed_attempts, locked_until
    from users where lower(nickname) = lower(${nickname})`;
  const wrong = { error: "Wrong nickname or passcode." };
  if (!user) return wrong;

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    return { error: `Too many wrong tries. Try again in ${mins} min.` };
  }

  if (!(await bcrypt.compare(passcode, user.passcode_hash))) {
    const attempts = user.failed_attempts + 1;
    if (attempts >= MAX_FAILED_LOGINS) {
      await sql`update users set failed_attempts = 0,
        locked_until = now() + ${LOCKOUT_MINUTES + " minutes"}::interval where id = ${user.id}`;
      return { error: `Too many wrong tries. Locked for ${LOCKOUT_MINUTES} min.` };
    }
    await sql`update users set failed_attempts = ${attempts} where id = ${user.id}`;
    return wrong;
  }

  await sql`update users set failed_attempts = 0, locked_until = null where id = ${user.id}`;
  await startSession(user.id);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

// ---------- Events ----------

export async function createEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.can_create && !user.is_admin) return { error: "The admin hasn't let you create events yet." };

  const title = str(fd, "title");
  const description = str(fd, "description");
  const source = str(fd, "resolution_source");
  const line = Number(str(fd, "line"));
  const localLock = str(fd, "lock_at"); // "YYYY-MM-DDTHH:mm" in the creator's timezone
  const tzOffset = Number(str(fd, "tz_offset") || "0"); // minutes, from getTimezoneOffset()

  if (title.length < 3 || title.length > 120) return { error: "Title must be 3–120 characters." };
  if (description.length > 1000) return { error: "Description is too long." };
  if (source.length > 200) return { error: "Resolution source is too long." };
  if (!str(fd, "line") || !Number.isFinite(line)) return { error: "The line must be a number, like 42.5" };
  const lockMs = Date.parse(`${localLock}Z`) + tzOffset * 60_000;
  if (!Number.isFinite(lockMs)) return { error: "Pick when betting closes." };
  if (lockMs <= Date.now()) return { error: "Betting close time must be in the future." };

  const sql = await db();
  const [event] = await sql`
    insert into events (title, description, line, resolution_source, creator_id, lock_at)
    values (${title}, ${description}, ${line}, ${source}, ${user.id}, ${new Date(lockMs)})
    returning id`;
  revalidatePath("/");
  redirect(`/events/${event.id}`);
}

export async function placeBet(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const eventId = Number(str(fd, "event_id"));
  const side = str(fd, "side") as Side;
  const amount = Number(str(fd, "amount"));
  if (side !== "over" && side !== "under") return { error: "Pick Over or Under." };
  if (!Number.isInteger(amount) || amount <= 0) return { error: "Bet a whole number of points." };

  const sql = await db();
  const outcome = await sql.begin(async (tx) => {
    const [event] = await tx.unsafe("select status, lock_at from events where id = $1 for update", [eventId]);
    if (!event) return { error: "Event not found." };
    if (event.status !== "open" || new Date(event.lock_at) <= new Date()) return { error: "Betting is closed." };
    const debited = await tx.unsafe(
      "update users set balance = balance - $1 where id = $2 and balance >= $1 returning balance",
      [amount, user.id],
    );
    if (!debited.length) return { error: "You don't have enough points." };
    await tx.unsafe("insert into bets (event_id, user_id, side, amount) values ($1, $2, $3, $4)", [
      eventId,
      user.id,
      side,
      amount,
    ]);
    return { ok: `Bet ${amount} on ${side.toUpperCase()}. Good luck!` };
  });

  revalidatePath(`/events/${eventId}`);
  return outcome;
}

async function loadManageable(eventId: number) {
  const user = await requireUser();
  const sql = await db();
  const [event] = await sql`select id, creator_id, status, lock_at, line from events where id = ${eventId}`;
  if (!event) return { error: "Event not found." } as const;
  if (event.creator_id !== user.id && !user.is_admin) return { error: "Only the creator or admin can do that." } as const;
  if (event.status !== "open") return { error: "This event is already settled." } as const;
  return { user, event } as const;
}

export async function resolveEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  const eventId = Number(str(fd, "event_id"));
  const rawResult = str(fd, "result");
  const result = Number(rawResult);
  if (!rawResult || !Number.isFinite(result)) return { error: "Enter the actual number." };

  const loaded = await loadManageable(eventId);
  if ("error" in loaded) return { error: loaded.error };
  if (!loaded.user.is_admin && new Date(loaded.event.lock_at) > new Date()) {
    return { error: "You can settle it once betting has closed." };
  }

  const sql = await db();
  const outcome = await sql.begin(async (tx) => {
    const [event] = await tx.unsafe("select status, line from events where id = $1 for update", [eventId]);
    if (event.status !== "open") return { error: "This event is already settled." };

    const bets = await tx.unsafe<{ id: number; user_id: number; side: Side; amount: number }[]>(
      "select id, user_id, side, amount from bets where event_id = $1",
      [eventId],
    );
    const pools = { over: 0, under: 0 };
    for (const b of bets) pools[b.side] += b.amount;
    const total = pools.over + pools.under;
    const winner = winningSide(event.line, result);
    // Refund everyone on a push, or if nobody picked the winning side.
    const refund = winner === null || pools[winner] === 0;

    for (const b of bets) {
      const payout = refund ? b.amount : b.side === winner ? Math.floor((b.amount * total) / pools[winner!]) : 0;
      await tx.unsafe("update bets set payout = $1 where id = $2", [payout, b.id]);
      if (payout > 0) await tx.unsafe("update users set balance = balance + $1 where id = $2", [payout, b.user_id]);
    }
    await tx.unsafe("update events set status = 'resolved', result = $1, resolved_at = now() where id = $2", [
      result,
      eventId,
    ]);
    return {
      ok: refund
        ? "Settled as a push — everyone got their points back."
        : `Settled: ${winner!.toUpperCase()} wins. Payouts sent.`,
    };
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/");
  return outcome;
}

export async function cancelEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  const eventId = Number(str(fd, "event_id"));
  const loaded = await loadManageable(eventId);
  if ("error" in loaded) return { error: loaded.error };

  const sql = await db();
  const outcome = await sql.begin(async (tx) => {
    const [event] = await tx.unsafe("select status from events where id = $1 for update", [eventId]);
    if (event.status !== "open") return { error: "This event is already settled." };
    const bets = await tx.unsafe<{ id: number; user_id: number; amount: number }[]>(
      "select id, user_id, amount from bets where event_id = $1",
      [eventId],
    );
    for (const b of bets) {
      await tx.unsafe("update bets set payout = amount where id = $1", [b.id]);
      await tx.unsafe("update users set balance = balance + $1 where id = $2", [b.amount, b.user_id]);
    }
    await tx.unsafe("update events set status = 'cancelled', resolved_at = now() where id = $1", [eventId]);
    return { ok: "Event cancelled — all bets refunded." };
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/");
  return outcome;
}

// ---------- Admin ----------

export async function setInviteCode(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const code = str(fd, "invite_code");
  const sql = await db();
  if (!code) {
    await sql`delete from settings where key = 'invite_code'`;
    revalidatePath("/admin");
    return { ok: "Signups closed." };
  }
  if (code.length < 4 || code.length > 40) return { error: "Invite code must be 4–40 characters." };
  await sql`
    insert into settings (key, value) values ('invite_code', ${code})
    on conflict (key) do update set value = excluded.value`;
  revalidatePath("/admin");
  return { ok: "Invite code saved." };
}

export async function toggleCreator(fd: FormData) {
  await requireAdmin();
  const sql = await db();
  await sql`update users set can_create = not can_create where id = ${Number(str(fd, "user_id"))}`;
  revalidatePath("/admin");
}

export async function adjustPoints(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = Number(str(fd, "user_id"));
  const delta = Number(str(fd, "delta"));
  if (!Number.isInteger(delta) || delta === 0) return { error: "Enter a whole number, e.g. 500 or -200." };
  const sql = await db();
  await sql`update users set balance = greatest(0, balance + ${delta}) where id = ${userId}`;
  revalidatePath("/admin");
  return { ok: `${delta > 0 ? "Added" : "Removed"} ${Math.abs(delta)} points.` };
}

export async function resetPasscode(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = Number(str(fd, "user_id"));
  const passcode = str(fd, "passcode");
  if (!validPasscode(passcode)) return { error: "Passcode must be at least 4 characters." };
  const sql = await db();
  const hash = await bcrypt.hash(passcode, 10);
  await sql`update users set passcode_hash = ${hash}, failed_attempts = 0, locked_until = null where id = ${userId}`;
  await sql`delete from sessions where user_id = ${userId}`;
  return { ok: "Passcode reset. Tell them the new one." };
}
