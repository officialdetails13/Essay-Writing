import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { PoolBar } from "@/components/PoolBar";
import { requireUser } from "@/lib/auth";
import { listEvents, type EventSummary } from "@/lib/events";
import { winningSide } from "@/lib/odds";

function EventCard({ e }: { e: EventSummary }) {
  const now = Date.now();
  const locked = e.status === "open" && new Date(e.lock_at).getTime() <= now;
  let badge: React.ReactNode;
  if (e.status === "cancelled") badge = <span className="badge muted-badge">Cancelled</span>;
  else if (e.status === "resolved") {
    const w = winningSide(e.line, e.result!);
    badge = (
      <span className={`badge ${w ?? "muted"}-badge`}>
        {w ? `${w.toUpperCase()} won` : "Push"} · {e.result}
      </span>
    );
  } else if (locked) badge = <span className="badge muted-badge">Awaiting result</span>;
  else
    badge = (
      <span className="badge live-badge">
        Closes <LocalTime iso={e.lock_at} mode="relative" />
      </span>
    );

  return (
    <Link href={`/events/${e.id}`} className="card event-card">
      <div className="event-card-head">
        <h3>{e.title}</h3>
        <span className="line-chip">O/U {e.line}</span>
      </div>
      <PoolBar pools={{ over: e.over_pool, under: e.under_pool }} compact />
      <div className="event-card-foot">
        {badge}
        <span className="muted">
          {e.bettors} {e.bettors === 1 ? "bettor" : "bettors"} · by {e.creator}
        </span>
      </div>
    </Link>
  );
}

function Section({ title, events, empty }: { title: string; events: EventSummary[]; empty: string }) {
  return (
    <section className="section">
      <h2>
        {title} <span className="count">{events.length}</span>
      </h2>
      {events.length ? (
        <div className="grid">
          {events.map((e) => (
            <EventCard key={e.id} e={e} />
          ))}
        </div>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </section>
  );
}

export default async function Home() {
  const user = await requireUser();
  const events = await listEvents();
  const now = Date.now();
  const live = events.filter((e) => e.status === "open" && new Date(e.lock_at).getTime() > now);
  const pending = events.filter((e) => e.status === "open" && new Date(e.lock_at).getTime() <= now);
  const past = events.filter((e) => e.status !== "open").reverse();

  return (
    <>
      <div className="page-head">
        <h1>Events</h1>
        {(user.can_create || user.is_admin) && (
          <Link href="/events/new" className="button primary">
            + New event
          </Link>
        )}
      </div>
      <Section
        title="Open for betting"
        events={live}
        empty={user.can_create || user.is_admin ? "Nothing open. Create the first event!" : "Nothing open right now."}
      />
      {pending.length > 0 && <Section title="Betting closed — awaiting result" events={pending} empty="" />}
      <Section title="Past events" events={past} empty="No settled events yet." />
    </>
  );
}
