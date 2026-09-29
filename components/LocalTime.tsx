"use client";

import { useEffect, useState } from "react";

function relative(ms: number) {
  const future = ms > 0;
  let s = Math.abs(Math.round(ms / 1000));
  const d = Math.floor(s / 86400);
  s %= 86400;
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  s %= 60;
  const text = d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
  return future ? `in ${text}` : `${text} ago`;
}

/** Renders a timestamp in the viewer's own timezone (or as a live countdown). */
export function LocalTime({ iso, mode = "absolute" }: { iso: string; mode?: "absolute" | "relative" }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const update = () =>
      setText(
        mode === "relative"
          ? relative(new Date(iso).getTime() - Date.now())
          : new Date(iso).toLocaleString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }),
      );
    update();
    if (mode !== "relative") return;
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [iso, mode]);
  return <time dateTime={iso}>{text || "…"}</time>;
}
