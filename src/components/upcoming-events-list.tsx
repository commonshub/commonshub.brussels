"use client";

import { useState } from "react";

import { EventCard, type LumaEvent } from "@/components/events-section";

const STEP = 9;

/** Every upcoming event, a few at a time: "View more" shows the next ones. */
export function UpcomingEventsList({ events }: { events: LumaEvent[] }) {
  const [shown, setShown] = useState(STEP);
  return (
    <div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.slice(0, shown).map((event) => (
          <EventCard key={event.id} event={event} onTagClick={() => {}} />
        ))}
      </div>
      {shown < events.length && (
        <p className="mt-8 text-center">
          <button type="button" onClick={() => setShown((n) => n + STEP)} className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-foreground transition hover:bg-muted">
            View more
          </button>
        </p>
      )}
    </div>
  );
}
