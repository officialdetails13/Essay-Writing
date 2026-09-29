import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getEventSnapshot } from "@/lib/events";

// Polled by the event page for live odds.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const snapshot = await getEventSnapshot(Number((await params).id));
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
