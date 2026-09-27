import { Star } from "lucide-react"

import { FeaturedEventCard, type FeaturedEvent } from "@/components/featured-event-card"

/**
 * The "Featured Events" block: a heading and the featured cards, one wide
 * card or two side by side. Used on the homepage and on /events.
 */
export function FeaturedEventsSection({
  events,
  title = "Featured Events",
  intro = "Don't miss these highlighted events handpicked by our community.",
  headingLevel = "h2",
  onTagClick,
}: {
  events: FeaturedEvent[]
  title?: string
  intro?: string
  headingLevel?: "h1" | "h2"
  onTagClick?: (tag: string) => void
}) {
  const Heading = headingLevel
  return (
    <div>
      <div className="text-center mb-8">
        <Heading className="text-3xl sm:text-4xl font-bold text-foreground flex items-center justify-center gap-3">
          <Star className="w-8 h-8 text-amber-500 fill-amber-500" />
          {title}
        </Heading>
        {intro && <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{intro}</p>}
      </div>
      <div className={`mx-auto grid gap-6 ${events.length === 1 ? "max-w-3xl" : "max-w-6xl lg:grid-cols-2"}`}>
        {events.map((event) => (
          <FeaturedEventCard key={event.id} event={event} onTagClick={onTagClick} />
        ))}
      </div>
    </div>
  )
}
