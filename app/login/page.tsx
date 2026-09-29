import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { getUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { login } from "../actions";

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  return (
    <div className="auth-card card">
      <h1>{BRAND.name}</h1>
      <p className="muted">{BRAND.tagline}</p>
      <ActionForm action={login} className="stack">
        <label>
          Nickname
          <input name="nickname" autoComplete="username" required autoFocus />
        </label>
        <label>
          Passcode
          <input name="passcode" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" className="primary">
          Log in
        </button>
      </ActionForm>
      <p className="muted center">
        New here? <Link href="/signup">Join with an invite code</Link>
      </p>
    </div>
  );
}
