"use client";

import { useEffect, useState } from "react";
import { createEvent } from "@/app/actions";
import { useKeepValuesAction } from "@/components/ActionForm";

export function NewEventForm() {
  const { state, pending, onSubmit } = useKeepValuesAction(createEvent);
  const [tz, setTz] = useState("0");
  const [line, setLine] = useState("");
  useEffect(() => setTz(String(new Date().getTimezoneOffset())), []);
  const wholeNumber = line !== "" && Number.isInteger(Number(line));

  return (
    <form onSubmit={(e) => onSubmit(e)} className="card stack">
      <fieldset disabled={pending} className="stack">
        <label>
          What are we betting on?
          <input name="title" required minLength={3} maxLength={120} placeholder="How many beers will Jake drink at the wedding?" />
        </label>
        <label>
          Over / under line
          <input
            name="line"
            type="number"
            step="any"
            inputMode="decimal"
            required
            placeholder="6.5"
            value={line}
            onChange={(e) => setLine(e.target.value)}
          />
        </label>
        {wholeNumber && (
          <p className="hint">Heads up: if the result is exactly {line}, it&apos;s a push and everyone gets refunded.</p>
        )}
        <label>
          Betting closes at
          <input name="lock_at" type="datetime-local" required />
        </label>
        <label>
          How will it be settled? <span className="muted">(optional)</span>
          <input name="resolution_source" maxLength={200} placeholder="Counted by Sarah, final answer" />
        </label>
        <label>
          Details <span className="muted">(optional)</span>
          <textarea name="description" rows={3} maxLength={1000} placeholder="Rules, edge cases, trash talk…" />
        </label>
        <input type="hidden" name="tz_offset" value={tz} />
        <button type="submit" className="primary">
          {pending ? "Creating…" : "Create event"}
        </button>
      </fieldset>
      {state?.error && <p className="msg error">{state.error}</p>}
    </form>
  );
}
