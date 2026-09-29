import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { logout } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1115",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="brand-mark">⇅</span> {BRAND.name}
          </Link>
          {user && (
            <nav className="nav">
              <Link href="/">Events</Link>
              <Link href="/leaderboard">Leaderboard</Link>
              {(user.can_create || user.is_admin) && <Link href="/events/new">+ New</Link>}
              {user.is_admin && <Link href="/admin">Admin</Link>}
              <Link href={`/users/${user.id}`} className="me">
                {user.nickname} · <strong>{user.balance.toLocaleString()}</strong> pts
              </Link>
              <form action={logout}>
                <button className="linkish" type="submit">
                  Log out
                </button>
              </form>
            </nav>
          )}
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
