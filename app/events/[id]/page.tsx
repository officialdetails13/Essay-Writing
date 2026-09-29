import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEventSnapshot } from "@/lib/events";
import { EventLive } from "./EventLive";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const snapshot = await getEventSnapshot(Number((await params).id));
  if (!snapshot) notFound();
  return (
    <EventLive
      initial={snapshot}
      me={{ id: user.id, balance: user.balance }}
      canManage={user.is_admin || user.id === snapshot.creator_id}
      isAdmin={user.is_admin}
    />
  );
}
