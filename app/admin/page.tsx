import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { adjustPoints, resetPasscode, setInviteCode, toggleCreator } from "../actions";

export default async function AdminPage() {
  const me = await requireAdmin();
  const sql = await db();
  const [invite] = await sql`select value from settings where key = 'invite_code'`;
  const users = await sql`
    select id, nickname, balance, is_admin, can_create, created_at
    from users order by created_at`;

  return (
    <>
      <h1>Admin</h1>

      <div className="card stack">
        <h2>Invite code</h2>
        <p className="muted">
          Friends need this code to sign up. Share it with the link to this site. Leave it blank to close signups.
        </p>
        <ActionForm action={setInviteCode} className="row">
          <input name="invite_code" defaultValue={invite?.value ?? ""} placeholder="e.g. boys-2026" />
          <button type="submit" className="primary">
            Save
          </button>
        </ActionForm>
        <p className="small">
          Status: {invite ? <strong className="won">Signups open</strong> : <strong className="lost">Signups closed</strong>}
        </p>
      </div>

      <div className="card">
        <h2>
          Players <span className="count">{users.length}</span>
        </h2>
        <ul className="admin-users">
          {users.map((u) => (
            <li key={u.id}>
              <div className="admin-user-head">
                <strong>{u.nickname}</strong>
                {u.is_admin && <span className="badge muted-badge tiny">admin</span>}
                <span className="muted">{u.balance.toLocaleString()} pts</span>
              </div>
              <div className="admin-user-actions">
                {!u.is_admin && (
                  <form action={toggleCreator}>
                    <input type="hidden" name="user_id" value={u.id} />
                    <button type="submit" className={u.can_create ? "toggle on" : "toggle"}>
                      {u.can_create ? "✓ Can create events" : "Allow creating events"}
                    </button>
                  </form>
                )}
                <details>
                  <summary>Points / passcode</summary>
                  <ActionForm action={adjustPoints} className="row">
                    <input type="hidden" name="user_id" value={u.id} />
                    <input name="delta" type="number" step={1} placeholder="+500 or -200" required />
                    <button type="submit">Adjust points</button>
                  </ActionForm>
                  {u.id !== me.id && (
                    <ActionForm action={resetPasscode} className="row">
                      <input type="hidden" name="user_id" value={u.id} />
                      <input name="passcode" placeholder="New passcode" required minLength={4} />
                      <button type="submit">Reset passcode</button>
                    </ActionForm>
                  )}
                </details>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
