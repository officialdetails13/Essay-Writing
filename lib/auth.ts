import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, type User } from "./db";

const COOKIE = "ou_session";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const sql = await db();
  const [user] = await sql<User[]>`
    select u.id, u.nickname, u.is_admin, u.can_create, u.balance
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hashToken(token)}`;
  return user ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.is_admin) redirect("/");
  return user;
}

export async function startSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  const sql = await db();
  await sql`insert into sessions (token_hash, user_id) values (${hashToken(token)}, ${userId})`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const sql = await db();
    await sql`delete from sessions where token_hash = ${hashToken(token)}`;
  }
  jar.delete(COOKIE);
}
