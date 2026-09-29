import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { NewEventForm } from "./NewEventForm";

export default async function NewEventPage() {
  const user = await requireUser();
  if (!user.can_create && !user.is_admin) redirect("/");
  return (
    <div className="narrow">
      <h1>New event</h1>
      <p className="muted">
        Set a number. Friends bet whether the real result lands over or under it. Tip: use a .5 line (like 42.5) so it
        can&apos;t tie.
      </p>
      <NewEventForm />
    </div>
  );
}
