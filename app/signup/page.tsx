import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { getUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { signup } from "../actions";

export default async function SignupPage() {
  if (await getUser()) redirect("/");
  const sql = await db();
  const [{ count }] = await sql`select count(*)::int as count from users`;
  const isFirst = count === 0;
  return (
    <div className="auth-card card">
      <h1>Join {BRAND.name}</h1>
      <p className="muted">
        {isFirst
          ? "You're the first one here, so you'll be the admin. No invite code needed."
          : `Pick a nickname and passcode. You start with ${BRAND.startingBalance.toLocaleString()} points.`}
      </p>
      <ActionForm action={signup} className="stack">
        <label>
          Nickname
          <input name="nickname" autoComplete="username" required minLength={2} maxLength={20} autoFocus />
        </label>
        <label>
          Passcode <span className="muted">(4+ characters)</span>
          <input name="passcode" type="password" autoComplete="new-password" required minLength={4} />
        </label>
        {!isFirst && (
          <label>
            Invite code
            <input name="invite" required autoCapitalize="off" />
          </label>
        )}
        <button type="submit" className="primary">
          {isFirst ? "Create admin account" : "Join"}
        </button>
      </ActionForm>
      <p className="muted center">
        Already joined? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
