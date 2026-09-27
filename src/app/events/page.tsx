import type { Metadata } from "next";

import type { FeaturedEvent } from "@/components/featured-event-card";
import { FeaturedEventsSection } from "@/components/featured-events-section";
import { hostedEventPath, hostedEvents, type HostedEvent } from "@/lib/hosted-events";

// Upcoming and past move as time passes, not only on deploy.
export const revalidate = 3600;

const description =
  "Open Commons Day, Open Source Village and the other events the Commons Hub Brussels hosts, each with its own programme page.";

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
          {past.length > 0 && (
            <FeaturedEventsSection title="Past events" intro="" events={past.map(toFeatured)} />
          )}
          <p className="text-center">
            <a href="/#events" className="text-primary font-semibold hover:underline">
              All upcoming events at the Commons Hub →
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
