import type { Metadata } from "next";

import type { FeaturedEvent } from "@/components/featured-event-card";
import { FeaturedEventsSection } from "@/components/featured-events-section";
import { UpcomingEventsList } from "@/components/upcoming-events-list";
import { hostedEventPath, hostedEvents, type HostedEvent } from "@/lib/hosted-events";
import { applyHandManagedEvents } from "@/lib/pinned-events";
import { loadUpcomingEvents } from "@/lib/upcoming-events";

/** How far ahead the list of all upcoming events goes. */
const AHEAD_DAYS = 61;

// Read the dataset at request time: prerendered at build, the list would be empty (no dataset in the image).
export const dynamic = "force-dynamic";

const description =
  "Everything happening at the Commons Hub Brussels in the next two months: the events we host (Open Commons Day, Open Source Village…) and the community's workshops, talks and gatherings.";

export const metadata: Metadata = {
  title: "Our events | Commons Hub Brussels",
  description,
  alternates: { canonical: "/events" },
  openGraph: {
    title: "Our events at the Commons Hub Brussels",
    description,
    url: "/events",
    siteName: "Commons Hub Brussels",
    type: "website",
    images: ["/images/ogimage-default.jpg"],
  },
  twitter: { card: "summary_large_image" },
};

function toFeatured(event: HostedEvent): FeaturedEvent {
  return {
    id: `hosted-${event.slug}`,
    name: event.name,
    description: event.tagline || event.description,
    start_at: event.startAt,
    end_at: event.endAt,
    cover_url: event.coverImage || "",
    url: hostedEventPath(event),
    location: event.location,
    isExternal: false,
    tags: event.tags,
  };
}

export default function EventsPage() {
  const now = new Date();
  const upcoming = hostedEvents
    .filter((event) => new Date(event.endAt) >= now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const past = hostedEvents
    .filter((event) => new Date(event.endAt) < now)
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
  const until = now.getTime() + AHEAD_DAYS * 86_400_000;
  const all = applyHandManagedEvents(loadUpcomingEvents(now, AHEAD_DAYS)).filter((e) => Date.parse(e.start_at) <= until);

  return (
    <main className="min-h-screen">
      <section className="pt-32 pb-24 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <FeaturedEventsSection
            headingLevel="h1"
            title="Our events"
            intro={
              upcoming.length > 0
                ? "The events we host ourselves, each with its own programme page."
                : "No event of our own is planned right now. Have a look at the past ones below."
            }
            events={upcoming.map(toFeatured)}
          />
          <section aria-labelledby="all-upcoming">
            <div className="mb-10 text-center">
              <h2 id="all-upcoming" className="text-3xl font-bold text-foreground sm:text-4xl">
                All upcoming events
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                Everything at the hub in the next two months: workshops, talks, gatherings and the events above.
              </p>
            </div>
            {all.length > 0 ? (
              <UpcomingEventsList events={all} />
            ) : (
              <p className="text-center text-muted-foreground">Nothing is planned in the next two months yet. Check back soon!</p>
            )}
          </section>
          {past.length > 0 && (
            <div id="past">
              <FeaturedEventsSection title="Past events we hosted" intro="" events={past.map(toFeatured)} />
            </div>
          )}
          <p className="text-center">
            <a href={`/${now.getFullYear()}/events`} className="text-primary font-semibold hover:underline">
              View past events →
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
